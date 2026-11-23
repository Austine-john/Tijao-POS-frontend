import React from "react";
import ReactDOM from "react-dom/client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ApiError } from "@/lib/api";
import { ME_KEY } from "@/hooks/useAuth";
import App from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

// Any request that finds the session gone sends the user back to the login screen.
const onAuthLost = (error: unknown) => {
  if (error instanceof ApiError && error.kind === "auth") queryClient.setQueryData(ME_KEY, null);
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onAuthLost }),
  mutationCache: new MutationCache({ onError: onAuthLost }),
  defaultOptions: {
    queries: {
      retry: (count, error) => error instanceof ApiError && error.kind === "network" && count < 2,
      refetchOnWindowFocus: true,
    },
    // Never auto-retry writes: a sale must only be retried with the same client_ref, by the user.
    mutations: { retry: false },
  },
});

// The app lives under /pos. Opening the bare dev URL (http://localhost:5173/) would
// otherwise render nothing, so send any other path to /pos.
const BASE = "/pos";
if (window.location.pathname !== BASE && !window.location.pathname.startsWith(`${BASE}/`)) {
  window.history.replaceState(null, "", BASE);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/pos" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
