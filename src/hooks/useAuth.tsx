import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, login as apiLogin, logout as apiLogout } from "@/lib/api";
import type { Me } from "@/lib/types";

interface AuthValue {
  me: Me | null;
  loading: boolean;
  /** Set when we couldn't even ask the server who is logged in. */
  error: ApiError | null;
  login: (usr: string, pwd: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export const ME_KEY = ["me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const meQuery = useQuery<Me | null, ApiError>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.me();
      } catch (e) {
        if (e instanceof ApiError && (e.kind === "auth" || e.kind === "forbidden")) return null;
        throw e;
      }
    },
    retry: (count, e) => e.kind === "network" && count < 2,
    staleTime: 5 * 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ usr, pwd }: { usr: string; pwd: string }) => {
      await apiLogin(usr, pwd);
      const me = await api.me();
      qc.setQueryData(ME_KEY, me);
    },
  });

  const value: AuthValue = {
    me: meQuery.data ?? null,
    loading: meQuery.isLoading,
    error: meQuery.data === undefined ? (meQuery.error ?? null) : null,
    login: (usr, pwd) => loginMutation.mutateAsync({ usr, pwd }),
    logout: async () => {
      try {
        await apiLogout();
      } finally {
        qc.clear();
        qc.setQueryData(ME_KEY, null);
      }
    },
    refetch: () => void meQuery.refetch(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
