import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

const STORAGE_PREFIX = "plankton_account_";

export type AccountProfile = {
  username: string;
  avatarUrl: string | null; // data URL or external URL
};

function loadProfile(walletAddress: string): AccountProfile {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + walletAddress);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccountProfile>;
      return {
        username: typeof parsed.username === "string" ? parsed.username : "",
        avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : null,
      };
    }
  } catch {
    // ignore
  }
  return { username: "", avatarUrl: null };
}

function saveProfile(walletAddress: string, profile: AccountProfile) {
  try {
    localStorage.setItem(STORAGE_PREFIX + walletAddress, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

type AccountContextValue = {
  profile: AccountProfile | null;
  setUsername: (username: string) => void;
  setAvatarUrl: (url: string | null) => void;
  loadProfileForWallet: (walletAddress: string) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<AccountProfile>({ username: "", avatarUrl: null });

  const loadProfileForWallet = useCallback((address: string) => {
    setWalletAddress(address);
    setProfile(loadProfile(address));
  }, []);

  const setUsername = useCallback(
    (username: string) => {
      setProfile((prev) => {
        const next = { ...prev, username };
        if (walletAddress) saveProfile(walletAddress, next);
        return next;
      });
    },
    [walletAddress]
  );

  const setAvatarUrl = useCallback(
    (url: string | null) => {
      setProfile((prev) => {
        const next = { ...prev, avatarUrl: url };
        if (walletAddress) saveProfile(walletAddress, next);
        return next;
      });
    },
    [walletAddress]
  );

  const value: AccountContextValue = {
    profile,
    setUsername,
    setAvatarUrl,
    loadProfileForWallet,
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
