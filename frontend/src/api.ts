import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { storage } from "@/src/utils/storage";
import { uploadForm } from "@/src/utils/upload";

export const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
let token = "";
let isLoaded = false;

export async function setToken(t: string | null) {
  token = t || "";
  isLoaded = true;
  if (t) await storage.secureSet("token", t);
  else await storage.secureRemove("token");
}

export async function loadToken() {
  if (!token || !isLoaded) {
    token = (await storage.secureGet("token", "")) || "";
    isLoaded = true;
  }
  return token;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  // Assicuriamoci che il token sia sempre caricato prima di fare una fetch
  if (!token) {
    await loadToken();
  }

  const r = await fetch(API + path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const txt = await r.text();
  let data: any = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = null;
  }

  if (!r.ok) {
    const d = data?.detail;
    throw new Error(typeof d === "string" ? d : d ? "Dati non validi" : `Errore ${r.status}`);
  }
  return data as T;
}

export const fileUrl = (path: string) => `${API}/files/${path}?token=${token}`;

export async function uploadFile(asset: { uri: string; fileName?: string | null; mimeType?: string | null }, fallbackName: string) {
  if (!token) await loadToken();
  const res = await uploadForm(`${API}/upload`, {
    headers: { Authorization: `Bearer ${token}` },
    files: { file: { uri: asset.uri, name: asset.fileName || fallbackName, mimeType: asset.mimeType || undefined } },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Caricamento non riuscito");
  return data.path as string;
}

export function useFetch<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return { data, loading, error, reload, setData };
}

// Parse user-typed numbers accepting the Italian decimal comma ("79,5").
export const num = (v: any) => {
  const x = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(x) ? 0 : x;
};

export function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtDate(iso: string, withTime = false) {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}
