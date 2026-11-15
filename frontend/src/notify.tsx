import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useTheme } from "@/src/theme";

const webNotif = () => (Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window ? (window as any).Notification : null);

export const browserNotifSupported = () => !!webNotif();
export const browserNotifGranted = () => webNotif()?.permission === "granted";

export async function enableBrowserNotif() {
  const N = webNotif();
  if (!N) return "unsupported";
  
  const permission = await N.requestPermission();
  if (permission === "granted" && "serviceWorker" in navigator && "PushManager" in window) {
    try {
      // 1. Registra il Service Worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 2. Prendi la chiave pubblica VAPID da Vercel
      const publicVapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
      if (publicVapidKey) {
        const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);
        
        // 3. Crea la sottoscrizione Web Push
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });

        // 4. Invia la sottoscrizione al backend FastAPI su Render
        await api("/notifications/subscribe", {
          method: "POST",
          body: {
            email: "lorenzosilvestri@hotmail.it",
            subscription: subscription,
          },
        });
        console.log("Web Push registrate e salvate sul backend con successo!");
      }
    } catch (e) {
      console.error("Errore durante la registrazione delle push avanzate:", e);
    }
  }
  return permission;
}

// Funzione di servizio per convertire la chiave VAPID
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(0);
  }
  return outputArray;
}

let shared = { count: 0 };
const seen = new Set<string>();

// Bell with red badge; polls in-app notifications and mirrors new ones as browser notifications on web.
export function NotifBell() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [count, setCount] = useState(shared.count);
  const first = useRef(seen.size === 0);
  useEffect(() => {
    listeners.add(setCount);
    return () => { listeners.delete(setCount); };
  }, []);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await api<{ count: number; latest: any[] }>("/notifications/unread");
        if (!alive) return;
        shared.count = r.count;
        setCount(r.count);
        for (const n of r.latest) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          if (!first.current && browserNotifGranted()) {
            try { new (webNotif())(n.title, { body: n.body, icon: "/favicon.ico" }); } catch {}
          }
        }
        first.current = false;
      } catch {}
    };
    tick();
    const t = setInterval(tick, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);
  return (
    <Pressable testID="notif-bell" onPress={() => router.push("/notifications")} hitSlop={6} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={count ? "notifications" : "notifications-outline"} size={24} color={count ? colors.brandPrimary : colors.onSurface} />
      {count ? (
        <View testID="notif-badge" style={{ position: "absolute", top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.onBrandPrimary, fontSize: 10, fontWeight: "900" }}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function resetBellCount() {
  shared.count = 0;
  listeners.forEach((f) => f(0));
}
const listeners = new Set<(n: number) => void>();
