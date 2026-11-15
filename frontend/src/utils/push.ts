import { api } from "@/src/api";

export async function registerPushNotifications() {
  // 1. Controllo di sicurezza per evitare il crash su Vercel (SSR)
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Le Web Push non sono supportate o siamo in fase di rendering iniziale.");
    return;
  }

  try {
    // 2. Registra il Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    
    // 3. Chiedi il permesso all'utente
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log("Permesso notifiche negato dall'utente.");
      return;
    }

    // 4. Prendi la chiave pubblica dalle variabili d'ambiente di Vercel
    const publicVapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      console.error("Manca la variabile EXPO_PUBLIC_VAPID_PUBLIC_KEY su Vercel");
      return;
    }

    const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

    // 5. Crea la sottoscrizione
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    // 6. Invia la sottoscrizione al backend FastAPI su Render
    await api("/notifications/subscribe", {
      method: "POST",
      body: {
        email: "lorenzosilvestri@hotmail.it",
        subscription: subscription
      }
    });

    console.log("Notifiche Web Push attivate con successo!");
  } catch (error) {
    console.error("Errore durante la registrazione delle push:", error);
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(0);
  }
  return outputArray;
}
