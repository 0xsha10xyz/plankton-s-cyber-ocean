import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Props = {
  onDismiss: () => void;
};

function WalletModalPrivyInner({ onDismiss }: Props): JSX.Element {
  const { ready, authenticated, login } = usePrivy();

  const handlePrivy = () => {
    onDismiss();
    void login();
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
        Starting Privy…
      </div>
    );
  }

  if (authenticated) {
    return (
      <p className="text-xs text-center text-muted-foreground py-3 leading-relaxed">
        You’re signed in with Privy. Use the header to sign out or link wallets.
      </p>
    );
  }

  return (
    <>
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t border-border/55" />
        </div>
        <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-wider">
          <span className="glass-card px-3 py-0.5 text-muted-foreground">Or</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 min-h-11 border-intel/45 text-intel hover:bg-intel/10 font-medium"
        onClick={handlePrivy}
      >
        <img
          src="/logos/privy.svg"
          alt=""
          width={18}
          height={18}
          className="h-4 w-4 shrink-0 object-contain opacity-95"
          draggable={false}
          aria-hidden
        />
        Sign in with Privy
      </Button>
      <p className="text-[11px] text-muted-foreground text-center mt-2.5 leading-snug">
        Email, social, passkey, or embedded wallet — powered by Privy
      </p>
    </>
  );
}

/** Shown at the bottom of the Connect Wallet modal when `VITE_PRIVY_APP_ID` is set. */
export function WalletModalPrivyBlock(props: Props): JSX.Element | null {
  if (!import.meta.env.VITE_PRIVY_APP_ID?.trim()) {
    return null;
  }
  return <WalletModalPrivyInner {...props} />;
}
