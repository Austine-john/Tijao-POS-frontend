import { useRef, useState } from "react";
import { useRefreshAfterWrite } from "@/hooks/queries";
import { ApiError, api } from "@/lib/api";
import { kes, niceName } from "@/lib/format";
import type { ImportResult } from "@/lib/types";
import { usePaperWidth } from "@/components/Receipt";
import { Banner, Button, Card, PageHeader, Segmented, Steps, cx } from "@/components/ui";

const TEMPLATE_URL = "/assets/tijao_pos/templates/tijao_master_data_template.xlsx";

type Stage = "idle" | "uploading" | "checking" | "checked" | "importing" | "done";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Products and prices, the receipt printer, and staff." />
      <ImportCard />
      <PrinterCard />
      <StaffCard />
    </div>
  );
}

function ImportCard() {
  const refresh = useRefreshAfterWrite();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [check, setCheck] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [dragging, setDragging] = useState(false);

  function reset() {
    setFile(null);
    setFileUrl(null);
    setCheck(null);
    setResult(null);
    setError(null);
    setStage("idle");
    if (input.current) input.current.value = "";
  }

  async function checkFile(f: File) {
    reset();
    if (!/\.xlsx$/i.test(f.name)) {
      setError(new ApiError("Please choose the Excel template (.xlsx).", "server"));
      return;
    }
    setFile(f);
    try {
      setStage("uploading");
      const url = await api.uploadFile(f);
      setFileUrl(url);
      setStage("checking");
      setCheck(await api.importMasterData(url, true)); // dry run: writes nothing
      setStage("checked");
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Could not check the file.", "server"));
      setStage("idle");
    }
  }

  async function importNow() {
    if (!fileUrl) return;
    setStage("importing");
    setError(null);
    try {
      setResult(await api.importMasterData(fileUrl, false));
      setStage("done");
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Import failed. Nothing was saved.", "server"));
      setStage("checked");
    }
  }

  const busy = stage === "uploading" || stage === "checking" || stage === "importing";
  const current = stage === "done" ? 3 : stage === "checked" || stage === "importing" ? 3 : file ? 2 : 0;

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Products and prices</h2>
      <p className="mb-4 text-ink-soft">Add new drinks, change prices or set opening stock using the Excel template. Nothing changes until you press Import.</p>
      <Steps steps={["Download the template", "Fill it in Excel", "Choose the file", "Check and import"]} current={current} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <a href={TEMPLATE_URL} download className="inline-flex h-10 items-center rounded-md border border-line px-4 font-medium hover:bg-canvas">
          Download blank template
        </a>
        <span className="text-sm text-ink-soft">or use the file you already filled in.</span>
      </div>

      <div
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) void checkFile(f);
        }}
        className={cx("flex flex-wrap items-center gap-3 rounded-md border border-dashed px-4 py-5", dragging ? "border-brand-600 bg-brand-50" : "border-line")}
      >
        <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => e.target.files?.[0] && checkFile(e.target.files[0])} />
        <Button size="lg" onClick={() => input.current?.click()} loading={stage === "uploading" || stage === "checking"}>
          {stage === "uploading" ? "Uploading…" : stage === "checking" ? "Checking…" : "Choose Excel file"}
        </Button>
        <span className="text-ink-soft">{file ? file.name : "or drop the file here"}</span>
      </div>

      {error && (
        <div className="mt-4">
          <Banner tone={error.kind === "network" ? "offline" : "error"} title="Problem with the file" onClose={() => setError(null)}>
            {error.message}
          </Banner>
        </div>
      )}

      {check && stage !== "done" && <CheckResult check={check} importing={stage === "importing"} onImport={importNow} onCancel={reset} />}

      {result && stage === "done" && (
        <div className="mt-4">
          <Banner tone="success" title="Import finished">
            {result.summary.create} new products · {result.summary.update} updated · opening stock added for {result.summary.opening_to_post}
            {result.summary.opening_skipped ? ` (${result.summary.opening_skipped} skipped: they already had stock)` : ""}.
          </Banner>
          <Button variant="secondary" className="mt-3" onClick={reset}>
            Import another file
          </Button>
        </div>
      )}
    </Card>
  );
}

function CheckResult({ check, importing, onImport, onCancel }: { check: ImportResult; importing: boolean; onImport: () => void; onCancel: () => void }) {
  if (!check.ok) {
    return (
      <div className="mt-4">
        <Banner tone="error" title={`Fix ${check.errors.length === 1 ? "this problem" : `these ${check.errors.length} problems`} in Excel, then choose the file again`}>
          <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-md border border-line bg-white">
            {check.errors.map((e, i) => (
              <li key={i} className="px-3 py-2">
                <span className="font-medium">
                  {e.sheet}
                  {e.row ? `, row ${e.row}` : ""}
                  {e.column ? ` (${e.column})` : ""}:
                </span>{" "}
                {e.message}
              </li>
            ))}
          </ul>
        </Banner>
      </div>
    );
  }
  const s = check.summary;
  return (
    <div className="mt-4 space-y-3">
      {check.warnings.length > 0 && (
        <Banner tone="warning" title={`Please double-check ${check.warnings.length === 1 ? "one thing" : `${check.warnings.length} things`}`}>
          <ul className="mt-1 list-disc pl-5">
            {check.warnings.slice(0, 8).map((w, i) => (
              <li key={i}>
                Row {w.row}: {w.message}
              </li>
            ))}
          </ul>
        </Banner>
      )}
      <div className="rounded-md border border-line p-4">
        <div className="font-semibold">The file looks good: {s.items_total} products</div>
        <div className="text-ink-soft">
          {s.create} new · {s.update} will be updated · opening stock for {s.opening_to_post}
          {s.opening_skipped ? ` · ${s.opening_skipped} already have stock (skipped)` : ""}
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="lg" onClick={onCancel} disabled={importing}>
            Cancel
          </Button>
          <Button size="lg" onClick={onImport} loading={importing}>
            Import {s.items_total} products
          </Button>
        </div>
      </div>
      <details className="rounded-md border border-line px-4 py-3">
        <summary className="cursor-pointer font-medium">See all {s.items_total} products</summary>
        <div className="mt-3 max-h-96 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-sm text-ink-soft">
                <th className="py-1 font-medium">Product</th>
                <th className="py-1 font-medium">Sells at</th>
                <th className="py-1 font-medium">Bought as</th>
                <th className="py-1 font-medium">Opening stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {check.items.map((it) => (
                <tr key={it.item_code}>
                  <td className="py-1.5">
                    {niceName(it.item_name)} {it.action === "create" && <span className="text-sm text-brand-700">new</span>}
                  </td>
                  <td className="tabular py-1.5">{kes(it.selling_price)}</td>
                  <td className="py-1.5">{it.bulk_uom ? `${it.bulk_uom} of ${it.units_per_bulk}` : it.sale_uom}</td>
                  <td className="py-1.5">{it.opening === "post" ? it.opening_qty : it.opening === "skip_has_stock" ? "already set" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function PrinterCard() {
  const [width, setWidth] = usePaperWidth();
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Receipt paper</h2>
        <p className="text-ink-soft">The width of the receipt printer roll on this computer.</p>
      </div>
      <Segmented
        label="Paper width"
        value={width}
        onChange={setWidth}
        options={[
          { value: 58, label: "58mm" },
          { value: 80, label: "80mm" },
        ]}
      />
    </Card>
  );
}

function StaffCard() {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Staff</h2>
      <p className="mt-1 text-ink-soft">
        Staff logins are created by the administrator in ERPNext: Users → New user, then give the role <b className="text-ink">Tijao Cashier</b> or <b className="text-ink">Tijao Owner</b>.
      </p>
    </Card>
  );
}
