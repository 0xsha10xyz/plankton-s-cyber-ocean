import { usePrivy, type OAuthProviderType } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Github, Linkedin, Loader2, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared with header login menu — keep provider list in one place. */
export const PRIVY_SOCIAL_LOGIN_OPTIONS: {
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
 * OAuth via Privy’s **login modal** (not headless `initOAuth`).
 * Privy documents that embedded-wallet `createOnLogin` and the supported login path apply to
 * modal login — not to `useLoginWithOAuth`, which was causing `exited_auth_flow` / 401 for many setups.
 *
 * Requires Twitter/GitHub/LinkedIn enabled in the Privy dashboard for this app.
 */
export function PrivySocialLoginButtons({ layout, className }: Props): JSX.Element {
  const { login, ready } = usePrivy();

  const openProvider = (provider: OAuthProviderType) => {
    if (!ready) return;
    login({ loginMethods: [provider] });
  };

  if (layout === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)} role="group" aria-label="Sign in with social account">
        {PRIVY_SOCIAL_LOGIN_OPTIONS.map(({ provider, shortLabel, Icon }) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 border-border/60"
            disabled={!ready}
            onClick={() => openProvider(provider)}
            aria-label={`Sign in with ${shortLabel}`}
            title={`Sign in with ${shortLabel}`}
          >
            {!ready ? (
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
      {PRIVY_SOCIAL_LOGIN_OPTIONS.map(({ provider, label, Icon }) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full gap-2 min-h-11 border-border/55 justify-start font-medium"
          disabled={!ready}
          onClick={() => openProvider(provider)}
        >
          {!ready ? (
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
