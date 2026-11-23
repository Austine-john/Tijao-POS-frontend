import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, ClipboardCheck, Clock, LogOut, ReceiptText, Settings, ShoppingBasket, Truck, Warehouse } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCounts, useCurrentShift } from "@/hooks/queries";
import { useOnline } from "@/hooks/useOnline";
import { longDate } from "@/lib/format";
import { cx } from "./ui";

export const NAV = [
  { to: "/", label: "Sell", icon: ShoppingBasket, owner: false, end: true },
  { to: "/stock", label: "Stock", icon: Warehouse, owner: false },
  { to: "/receive", label: "Delivery", icon: Truck, owner: true },
  { to: "/count", label: "Count", icon: ClipboardCheck, owner: false },
  { to: "/sales", label: "Sales", icon: ReceiptText, owner: false },
  { to: "/shift", label: "Shift", icon: Clock, owner: false },
  { to: "/summary", label: "Summary", icon: BarChart3, owner: true },
  { to: "/settings", label: "Settings", icon: Settings, owner: true },
] as const;

export function Layout() {
  const { me, logout } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const shift = useCurrentShift();
  const pendingCounts = useCounts("Pending").data?.length ?? 0;

  const items = NAV.filter((n) => !n.owner || me?.is_owner);
  const badges: Record<string, number> = me?.is_owner ? { "/count": pendingCounts } : {};

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Sidebar (laptop / tablet landscape) */}
      <aside className="no-print sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-brand-900 text-white md:flex">
        <div className="flex items-center gap-3 px-5 pb-5 pt-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-lg font-black text-brand-800" aria-hidden>
            T
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold leading-tight">Tijao POS</div>
            <div className="truncate text-sm text-white/60">{me?.shop_name}</div>
          </div>
        </div>
        <nav className="flex flex-col px-2" aria-label="Main">
          {items.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={"end" in rest}
              className={({ isActive }) =>
                cx(
                  "relative flex h-11 items-center gap-3 rounded-md px-3 text-[15px] transition-colors",
                  isActive
                    ? "bg-white/15 font-semibold text-white before:absolute before:inset-y-2 before:-left-2 before:w-1 before:rounded-r before:bg-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {label}
              {!!badges[to] && (
                <span className="ml-auto rounded bg-amber-400 px-1.5 text-xs font-bold text-brand-900" aria-label={`${badges[to]} waiting`}>
                  {badges[to]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 px-5 py-4 text-sm">
          <div className="font-semibold">{me?.full_name}</div>
          <div className="text-white/60">{me?.is_owner ? "Owner" : "Cashier"}</div>
          <button
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
            className="mt-3 inline-flex items-center gap-2 text-white/70 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-5 border-b border-line bg-white px-4 text-sm md:px-6">
          <span className={cx("flex items-center gap-1.5", online ? "text-ink-soft" : "font-semibold text-warn-700")}>
            <span className={cx("h-2 w-2 rounded-full", online ? "bg-brand-500" : "bg-warn-600")} aria-hidden />
            {online ? "Online" : "No connection: sales can't be saved"}
          </span>
          {shift.isSuccess && (
            <Link
              to="/shift"
              className={cx(
                "rounded-full px-3 py-1 font-medium",
                shift.data ? "bg-brand-50 text-brand-800 hover:bg-brand-100" : "bg-warn-50 font-semibold text-warn-700 hover:bg-warn-100",
              )}
            >
              {shift.data ? `Till open · ${shift.data.cashier_name} since ${shift.data.opened_at.slice(11, 16)}` : "Till closed: open a shift to sell"}
            </Link>
          )}
          <span className="ml-auto hidden text-ink-soft lg:inline">{longDate()}</span>
          <button
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
            className="ml-auto text-ink-soft hover:text-danger-700 md:hidden"
          >
            Log out
          </button>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Bottom bar (narrow screens) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line bg-white md:hidden" aria-label="Main">
        {items.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={"end" in rest}
            className={({ isActive }) => cx("flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2 text-xs", isActive ? "font-semibold text-brand-800" : "text-ink-soft")}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
