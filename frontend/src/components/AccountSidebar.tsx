import { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAccount } from "@/contexts/AccountContext";
import { User, Wallet, Loader2, Camera } from "lucide-react";

const LAMPORTS_PER_SOL = 1e9;

type AccountSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AccountSidebar({ open, onOpenChange }: AccountSidebarProps) {
  const { publicKey, disconnect } = useWallet();
  const { profile, setUsername, setAvatarUrl, loadProfileForWallet } = useAccount();
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const address = publicKey?.toBase58() ?? "";
  const endpoint =
    (typeof import.meta.env !== "undefined" && import.meta.env.VITE_SOLANA_RPC_URL) ||
    "https://api.mainnet-beta.solana.com";

  useEffect(() => {
    if (open && address) {
      loadProfileForWallet(address);
    }
  }, [open, address, loadProfileForWallet]);

  useEffect(() => {
    if (open && profile) {
      setUsernameInput(profile.username);
    }
  }, [open, profile?.username]);

  useEffect(() => {
    if (!open || !publicKey) return;
    let cancelled = false;
    setBalanceLoading(true);
    const connection = new Connection(endpoint);
    connection
      .getBalance(publicKey)
      .then((lamports) => {
        if (!cancelled) setBalanceLamports(lamports);
      })
      .catch(() => {
        if (!cancelled) setBalanceLamports(null);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, publicKey, endpoint]);

  const handleSaveUsername = () => {
    setSavingUsername(true);
    setUsername(usernameInput.trim());
    setSavingUsername(false);
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const balanceSol =
    balanceLamports != null ? (balanceLamports / LAMPORTS_PER_SOL).toFixed(4) : null;

  const initials = profile?.username?.trim()
    ? profile.username.slice(0, 2).toUpperCase()
    : address
      ? address.slice(0, 2).toUpperCase()
      : "?";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User size={20} />
            Account
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-6 pt-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-border">
                {profile?.avatarUrl ? (
                  <AvatarImage src={profile.avatarUrl} alt="Avatar" />
                ) : null}
                <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground p-1.5 shadow-lg hover:bg-primary/90 transition-colors"
                aria-label="Change avatar"
              >
                <Camera size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
            </div>
            <p className="text-xs text-muted-foreground">Click camera to change avatar</p>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Username</label>
            <div className="flex gap-2">
              <Input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter username"
                className="flex-1"
                maxLength={32}
              />
              <Button
                size="sm"
                onClick={handleSaveUsername}
                disabled={savingUsername || usernameInput.trim() === profile?.username}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Balance */}
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet size={16} />
              <span>SOL Balance</span>
            </div>
            {balanceLoading ? (
              <div className="flex items-center gap-2 text-lg font-mono">
                <Loader2 size={18} className="animate-spin" />
                Loading…
              </div>
            ) : balanceSol != null ? (
              <p className="text-xl font-bold font-mono text-foreground">{balanceSol} SOL</p>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load balance</p>
            )}
          </div>

          {/* Wallet address */}
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground mb-1">Connected wallet</p>
            <p className="text-xs font-mono text-foreground break-all">{address}</p>
          </div>

          {/* Disconnect */}
          <div className="mt-auto pt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                disconnect();
              }}
            >
              Disconnect wallet
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
