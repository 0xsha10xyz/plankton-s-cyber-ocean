import { useState } from "react";
import { useLoginWithOAuth, type OAuthProviderType } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Github, Linkedin, Loader2, Twitter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SOCIAL: {
  provider: OAuthProviderType;
  label: string;
  shortLabel: string;
  Icon: typeof Twitter;
}[] = [
  { provider: "twitter", label: "Continue with X", shortLabel: "X", Icon: Twitter },
  { provider: "github", label: "Continue with GitHub", shortLabel: "GitHub", Icon: Github },
  { provider: "linkedin", label: "Continue with LinkedIn", shortLabel: "LinkedIn", Icon: Linkedin },
];

type Layout = "compact" | "stack";

type Props = {
  layout: Layout;
  className?: string;
};

/**
 * Headless OAuth entry points for Privy (must match providers enabled in the Privy dashboard).
 */
export function PrivySocialLoginButtons({ layout, className }: Props): JSX.Element {
  const [pending, setPending] = useState<OAuthProviderType | null>(null);
  const { initOAuth, loading } = useLoginWithOAuth({
    onComplete: () => {
      setPending(null);
      toast.success("Signed in");
    },
    onError: (err) => {
      setPending(null);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Sign-in failed", {
        description:
          "Privy Dashboard → App settings → Advanced: Allowed OAuth redirect URLs must exactly match your URL (https, trailing slash). Domains tab must list this origin.",
        duration: 10_000,
      });
    },
  });

  const handle = (provider: OAuthProviderType) => {
    setPending(provider);
    void initOAuth({ provider }).catch(() => setPending(null));
  };

  const busy = loading || pending !== null;

  if (layout === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)} role="group" aria-label="Sign in with social account">
        {SOCIAL.map(({ provider, shortLabel, Icon }) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 border-border/60"
            disabled={busy}
            onClick={() => handle(provider)}
            aria-label={`Sign in with ${shortLabel}`}
            title={`Sign in with ${shortLabel}`}
          >
            {pending === provider ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Icon className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)} role="group" aria-label="Sign in with social account">
      {SOCIAL.map(({ provider, label, Icon }) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full gap-2 min-h-11 border-border/55 justify-start font-medium"
          disabled={busy}
          onClick={() => handle(provider)}
        >
          {pending === provider ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          ) : (
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          )}
          <span>{label}</span>
        </Button>
      ))}
    </div>
  );
}
