import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, LogOut } from "lucide-react";

function truncateId(id: string, chars = 6): string {
  if (id.length <= chars * 2) return id;
  return `${id.slice(0, chars)}…${id.slice(-chars)}`;
}

/**
 * Shown in the header when `VITE_PRIVY_APP_ID` is set. Uses Privy login/logout; optional server check via `POST /api/privy/verify`.
 */
function PrivyAuthControlsInner(): JSX.Element {
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-xs border-intel/40 text-intel hover:bg-intel/10"
      onClick={() => void login()}
      aria-label="Sign in with Privy"
    >
      <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="font-medium">Sign in</span>
    </Button>
  );
}

/** Dev-only: verify access token against Vercel `api/privy/verify` (requires server env). */
export async function verifyPrivyAccessTokenOnServer(): Promise<{ ok: boolean; userId?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false };
  const res = await fetch("/api/privy/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return { ok: false };
  const data = (await res.json()) as { userId?: string };
  return { ok: true, userId: data.userId };
}

export function PrivyAuthControls(): JSX.Element | null {
  if (!import.meta.env.VITE_PRIVY_APP_ID?.trim()) {
    return null;
  }
  return <PrivyAuthControlsInner />;
}
