import { useEffect, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";

/** Inactivity threshold before we ask user to reconnect (default 30 minutes) */
const INACTIVITY_MS = 30 * 60 * 1000;

/**
 * When the user leaves the tab/browser and comes back, or after a period of
 * inactivity, we disconnect the wallet and show the connect modal so they
 * must log back in.
 */
export function WalletReconnectHandler() {
  const { connected, disconnect } = useWallet();
  const { openWalletModal } = useWalletModal();
  const lastActivityAt = useRef(Date.now());
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadHidden = useRef(false);

  const disconnectAndShowModal = useCallback(() => {
    disconnect().catch(() => {});
    openWalletModal();
  }, [disconnect, openWalletModal]);

  const resetInactivityTimer = useCallback(() => {
    lastActivityAt.current = Date.now();
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
    if (!connected) return;
    inactivityTimer.current = setTimeout(() => {
      inactivityTimer.current = null;
      disconnectAndShowModal();
    }, INACTIVITY_MS);
  }, [connected, disconnectAndShowModal]);

  // Page visibility: when user returns to tab (hidden → visible), require reconnect
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hadHidden.current = true;
        return;
      }
      if (document.visibilityState === "visible" && hadHidden.current && connected) {
        disconnectAndShowModal();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [connected, disconnectAndShowModal]);

  // Inactivity: reset timer on activity; after INACTIVITY_MS disconnect and show modal
  useEffect(() => {
    if (!connected) return;
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const;
    events.forEach((ev) => document.addEventListener(ev, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, resetInactivityTimer));
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    };
  }, [connected, resetInactivityTimer]);

  return null;
}
