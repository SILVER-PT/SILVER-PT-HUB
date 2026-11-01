import React, { createContext, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken } from "@/src/api";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "trainer" | "client" | "nutritionist";
  invite_code?: string;
  trainer_id?: string;
  avatar?: string;
  visibility?: { measurements?: boolean; photos?: boolean; nutrition?: boolean };
  nutritionist_id?: string;
  subscription?: Record<string, any> | null;
  staff?: { whatsapp?: string; bio?: string; title?: string };
  profile?: Record<string, any>;
};

type Ctx = {
  user: User | null;
  ready: boolean;
  signIn: (path: "/auth/login" | "/auth/register", body: any) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (await loadToken()) {
        try {
          setUser(await api<User>("/auth/me"));
        } catch {
          await setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const signIn = async (path: string, body: any) => {
    const r = await api(path, { method: "POST", body });
    await setToken(r.access_token);
    setUser(r.user);
  };
  const logout = async () => {
    await setToken(null);
    setUser(null);
  };
  const refresh = async () => setUser(await api<User>("/auth/me"));

  return <AuthCtx.Provider value={{ user, ready, signIn: signIn as any, logout, refresh }}>{ready ? children : null}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
