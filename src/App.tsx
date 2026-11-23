import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Lock, WifiOff } from "lucide-react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { ToastProvider } from "@/components/Toast";
import { Button, EmptyState, Spinner } from "@/components/ui";
import LoginPage from "@/pages/LoginPage";
import SellPage from "@/pages/SellPage";
import StockPage from "@/pages/StockPage";
import ReceivePage from "@/pages/ReceivePage";
import CountPage from "@/pages/CountPage";
import SalesPage from "@/pages/SalesPage";
import SettingsPage from "@/pages/SettingsPage";
import ShiftPage from "@/pages/ShiftPage";

// Charts are heavy; load them only when the owner opens Summary.
const SummaryPage = lazy(() => import("@/pages/SummaryPage"));

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<SellPage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="shift" element={<ShiftPage />} />
            <Route path="count" element={<CountPage />} />
            <Route path="receive" element={<OwnerOnly><ReceivePage /></OwnerOnly>} />
            <Route path="summary" element={<OwnerOnly><Suspense fallback={<Spinner />}><SummaryPage /></Suspense></OwnerOnly>} />
            <Route path="settings" element={<OwnerOnly><SettingsPage /></OwnerOnly>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading, error, refetch } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Opening Tijao POS…" />;
  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <EmptyState icon={<WifiOff className="h-12 w-12" />} title="Can't reach the shop system">
          Check that the laptop's Tijao POS server is running, then try again.
          <div className="mt-5">
            <Button size="lg" onClick={refetch}>Try again</Button>
          </div>
        </EmptyState>
      </div>
    );
  }
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!me.is_cashier) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <EmptyState icon={<Lock className="h-12 w-12" />} title="This account can't use the till">
          Ask the owner to give you the Tijao Cashier or Tijao Owner role.
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}

function OwnerOnly({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  if (!me?.is_owner) {
    return (
      <EmptyState icon={<Lock className="h-12 w-12" />} title="Owner only">
        Only the shop owner can open this page.
      </EmptyState>
    );
  }
  return <>{children}</>;
}
