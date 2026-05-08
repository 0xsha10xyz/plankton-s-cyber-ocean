import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2, LogOut, Wallet } from "lucide-react";
import { PRIVY_SOCIAL_LOGIN_OPTIONS } from "@/components/PrivySocialLoginButtons";

const privyLogo = (
  <img
    src="/logos/privy.svg"
    alt=""
    width={14}
    height={14}
    className="h-3.5 w-3.5 shrink-0 object-contain opacity-95"
    draggable={false}
    aria-hidden
  />
);

function truncateId(id: string, chars = 6): string {
  if (id.length <= chars * 2) return id;
  return `${id.slice(0, chars)}…${id.slice(-chars)}`;
}

type InnerProps = {
  /** Opens the Solana wallet modal — grouped under Login when Privy is enabled. */
  onConnectWallet?: () => void;
};

/**
 * Shown in the header when `VITE_PRIVY_APP_ID` is set. Uses Privy login/logout; optional server check via `POST /api/health?mode=privy-verify`.
 */
function PrivyAuthControlsInner({ onConnectWallet }: InnerProps): JSX.Element {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Privy
      </span>
    );
  }

  if (authenticated && user) {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="hidden sm:inline text-[11px] font-mono text-muted-foreground max-w-[100px] truncate"
          title={user.id}
        >
          {truncateId(user.id)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs border-border/60"
          onClick={() => void logout()}
          aria-label="Sign out of Privy"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Sign out</span>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 border-border/60 text-foreground min-w-[88px]"
          aria-haspopup="menu"
          aria-label="Login — choose sign-in method"
        >
          <span className="font-medium">Login</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          Sign in with
        </DropdownMenuLabel>
        {PRIVY_SOCIAL_LOGIN_OPTIONS.map(({ provider, shortLabel, Icon }) => (
          <DropdownMenuItem
            key={provider}
            disabled={!ready}
            className="gap-2 cursor-pointer"
            onSelect={() => {
              if (!ready) return;
              login({ loginMethods: [provider] });
            }}
          >
            {!ready ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
            ) : (
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            )}
            <span>{shortLabel}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          aria-label="More sign-in options (email, wallet, passkey)"
          className="gap-2 cursor-pointer border-intel/30 focus:bg-intel/10"
          disabled={!ready}
          onSelect={() => {
            void login();
          }}
        >
          {privyLogo}
          <span className="font-medium text-intel">More</span>
        </DropdownMenuItem>
        {onConnectWallet ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-primary focus:text-primary"
              onSelect={() => {
                onConnectWallet();
              }}
            >
              <Wallet className="h-4 w-4 shrink-0" aria-hidden />
              Connect Wallet
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Verify access token against same-origin health handler (Vercel Hobby: shares `/api/health`, no extra function). */
export async function verifyPrivyAccessTokenOnServer(): Promise<{ ok: boolean; userId?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false };
  const res = await fetch("/api/health?mode=privy-verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return { ok: false };
  const data = (await res.json()) as { userId?: string };
  return { ok: true, userId: data.userId };
}

export type PrivyAuthControlsProps = {
  onConnectWallet?: () => void;
};

export function PrivyAuthControls({ onConnectWallet }: PrivyAuthControlsProps = {}): JSX.Element | null {
  if (!import.meta.env.VITE_PRIVY_APP_ID?.trim()) {
    return null;
  }
  return <PrivyAuthControlsInner onConnectWallet={onConnectWallet} />;
}
