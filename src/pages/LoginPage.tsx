import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { Banner, Button } from "@/components/ui";

const input = "h-12 w-full rounded-md border border-line bg-white px-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

export default function LoginPage() {
  const { me, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  if (me) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!usr.trim() || !pwd) {
      setError(new ApiError("Enter your username and password.", "auth"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(usr.trim(), pwd);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Something went wrong. Please try again.", "server"));
      setPwd("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Brand panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-brand-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-xl font-black text-brand-800" aria-hidden>
            T
          </div>
          <span className="text-xl font-bold">Tijao POS</span>
        </div>
        <div>
          <h2 className="max-w-sm text-4xl font-bold leading-tight tracking-tight">Sell, restock and close the day with confidence.</h2>
          <ul className="mt-6 space-y-2 text-white/75">
            <li>Every sale updates the stock straight away.</li>
            <li>Cash and M-Pesa totals for every shift.</li>
            <li>Know what's running low before it runs out.</li>
          </ul>
        </div>
        <p className="text-sm text-white/50">Awendo · Soda and water</p>
        {/* Soft bottle-cap circles: a quiet nod to the shop, not decoration for its own sake. */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-[28px] border-white/5" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 right-10 h-80 w-80 rounded-full border-[28px] border-white/5" aria-hidden />
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-4">
        <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-lg border border-line bg-white p-7 shadow-lift">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
          <p className="mb-6 mt-1 text-ink-soft">Log in to open the till.</p>

          {error && (
            <div className="mb-4">
              <Banner tone={error.kind === "network" ? "offline" : "error"} title={error.kind === "network" ? "No connection" : "Can't log in"}>
                {error.message}
              </Banner>
            </div>
          )}

          <label htmlFor="usr" className="mb-1 block text-sm font-medium">
            Username or email
          </label>
          <input id="usr" autoComplete="username" autoCapitalize="none" autoFocus value={usr} onChange={(e) => setUsr(e.target.value)} className={`${input} mb-4`} />

          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="pwd" className="text-sm font-medium">
              Password
            </label>
            <button type="button" onClick={() => setShow((s) => !s)} className="text-sm font-medium text-brand-700 hover:underline">
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <input id="pwd" type={show ? "text" : "password"} autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} className={`${input} mb-6`} />

          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Log in
          </Button>
          <p className="mt-4 text-sm text-ink-soft">Forgot your password? Ask the shop owner to reset it.</p>
        </form>
      </div>
    </div>
  );
}
