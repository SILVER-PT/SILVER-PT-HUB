import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

export function usePolling(callback: () => void, intervalMs: number = 60000) {
  const appState = useRef(AppState.currentState);
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (appState.current === "active") {
      savedCallback.current();
    }

    const interval = setInterval(() => {
      if (appState.current === "active") {
        savedCallback.current();
      }
    }, intervalMs);

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        savedCallback.current();
      }
      appState.current = nextAppState;
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMs]);
}
