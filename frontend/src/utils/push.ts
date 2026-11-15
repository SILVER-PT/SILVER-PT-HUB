import { api } from "@/src/api";

export async function registerPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Le Web Push non sono supportate da questo browser.");
    return;
  }

  try {
    // 1. Registra il Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    
    // 2. Chiedi il permesso all'utente
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log("Permesso notifiche negato.");
      return;
    }

    // 3. Prendi la chiave pubblica dalle variabili d'ambiente di Vercel
    const publicVapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      console.error("Manca la EXPO_PUBLIC_VAPID_PUBLIC_KEY");
      return;
    }

    // Converti la chiave in Uint8Array come richiesto dal browser
    const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

    // 4. Crea la sottoscrizione
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    // 5. Invia la sottoscrizione al backend FastAPI per salvarla nel database
    await api("/notifications/subscribe", {
      method: "POST",
      body: subscription
    });

    console.log("Notifiche Web Push attivate con successo!");
  } catch (error) {
    console.error("Errore durante la registrazione delle push:", error);
  }
}

// Funzione di servizio per convertire la chiave VAPID
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
