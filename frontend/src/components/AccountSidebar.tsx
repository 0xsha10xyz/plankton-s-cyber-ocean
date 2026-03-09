import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAccount } from "@/contexts/AccountContext";
import { User, Loader2, Camera, Coins } from "lucide-react";
import { formatAssetAmount, getTokenSymbol } from "@/lib/assets";

const LAMPORTS_PER_SOL = 1e9;

/** SPL Token program ID (mainnet) */
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

type TokenAsset = { mint: string; decimals: number; rawAmount: string };

type AccountSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AccountSidebar({ open, onOpenChange }: AccountSidebarProps) {
  const { publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const { profile, setUsername, setAvatarUrl, loadProfileForWallet } = useAccount();
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(false);
  const [tokenAssets, setTokenAssets] = useState<TokenAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const address = publicKey?.toBase58() ?? "";

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
    setBalanceError(false);
    setBalanceLoading(true);
    setAssetsLoading(true);

    connection
      .getBalance(publicKey)
      .then((lamports) => {
        if (!cancelled) {
          setBalanceLamports(lamports);
          setBalanceError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBalanceLamports(null);
          setBalanceError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });

    connection
      .getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })
      .then(({ value }) => {
        if (cancelled) return;
        const assets: TokenAsset[] = value
          .map(({ account }) => {
            const data = account.data;
            if (typeof data !== "object" || data === null || "parsed" in data === false)
              return null;
            const parsed = (data as { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number } } } }).parsed;
            const info = parsed?.info;
            if (!info?.tokenAmount) return null;
            const { amount, decimals } = info.tokenAmount;
            if (amount === "0") return null;
            return { mint: info.mint, decimals, rawAmount: amount };
          })
          .filter((a): a is TokenAsset => a !== null);
        setTokenAssets(assets);
      })
      .catch(() => {
        if (!cancelled) setTokenAssets([]);
      })
      .finally(() => {
        if (!cancelled) setAssetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, publicKey, connection]);

  const retryAssets = useCallback(() => {
    if (!publicKey) return;
    setBalanceError(false);
    setBalanceLamports(null);
    setTokenAssets([]);
    setBalanceLoading(true);
    setAssetsLoading(true);

    connection
      .getBalance(publicKey)
      .then((lamports) => {
        setBalanceLamports(lamports);
        setBalanceError(false);
      })
      .catch(() => {
        setBalanceLamports(null);
        setBalanceError(true);
      })
      .finally(() => setBalanceLoading(false));

    connection
      .getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })
      .then(({ value }) => {
        const assets: TokenAsset[] = value
          .map(({ account }) => {
            const data = account.data;
            if (typeof data !== "object" || data === null || "parsed" in data === false)
              return null;
            const parsed = (data as { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number } } } }).parsed;
            const info = parsed?.info;
            if (!info?.tokenAmount) return null;
            const { amount, decimals } = info.tokenAmount;
            if (amount === "0") return null;
            return { mint: info.mint, decimals, rawAmount: amount };
          })
          .filter((a): a is TokenAsset => a !== null);
        setTokenAssets(assets);
      })
      .catch(() => setTokenAssets([]))
      .finally(() => setAssetsLoading(false));
  }, [publicKey, connection]);

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
    balanceLamports != null ? formatAssetAmount(String(balanceLamports), 9) : null;
  const loadingAssets = balanceLoading || assetsLoading;

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

          {/* Assets (SOL + SPL tokens) */}
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coins size={16} />
              <span>Assets</span>
            </div>
            {loadingAssets ? (
              <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                Loading…
              </div>
            ) : (
              <div className="space-y-2">
                {/* SOL */}
                <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-sm font-medium text-foreground">SOL</span>
                  {balanceSol != null ? (
                    <span className="text-sm font-mono text-foreground tabular-nums" title={`${balanceSol} SOL`}>
                      {balanceSol} SOL
                    </span>
                  ) : balanceError ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive">Unable to load</span>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={retryAssets}>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm font-mono text-muted-foreground">—</span>
                  )}
                </div>
                {/* SPL tokens */}
                {tokenAssets.map(({ mint, decimals, rawAmount }) => (
                  <div
                    key={mint}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0"
                    title={mint}
                  >
                    <span className="text-sm font-medium text-foreground">{getTokenSymbol(mint)}</span>
                    <span className="text-sm font-mono text-foreground tabular-nums">
                      {formatAssetAmount(rawAmount, decimals)}
                    </span>
                  </div>
                ))}
                {!loadingAssets && tokenAssets.length === 0 && balanceSol != null && (
                  <p className="text-xs text-muted-foreground py-1">SOL only (no other tokens)</p>
                )}
              </div>
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
