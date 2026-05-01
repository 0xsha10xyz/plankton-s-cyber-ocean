import { Link } from "react-router-dom";

const XIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
  </svg>
);

const socials = [
  { name: "X (Twitter)", icon: XIcon, href: "https://x.com/Planktonomous" },
  { name: "Telegram", icon: TelegramIcon, href: "https://t.me/planktonomous" },
  { name: "Discord", icon: DiscordIcon, href: "#" },
];

const Footer = () => {
  return (
    <footer className="relative mt-24 border-t border-border/50 bg-gradient-to-b from-transparent to-[hsl(222_47%_3%/0.92)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/25 to-transparent" />
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 py-12 md:py-14">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 min-w-0">
            <Link to="/" className="flex items-center gap-3 shrink-0 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring/60">
            <img
              src="/brand/plankton-token-logo.png"
              alt="Plankton logo"
              width={28}
              height={28}
              className="shrink-0 rounded-full ring-1 ring-border/50"
              loading="lazy"
              decoding="async"
            />
            <span className="brand-wordmark text-base font-bold">PLANKTON</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              <Link to="/dashboard" className="hover:text-signal transition-colors">
                Dashboard
              </Link>
              <Link to="/swap" className="hover:text-signal transition-colors">
                Swap
              </Link>
              <Link to="/agent-chat" className="hover:text-signal transition-colors">
                Launch agent
              </Link>
              <a href="/docs" target="_blank" rel="noopener noreferrer" className="hover:text-intel transition-colors">
                Docs
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target={s.href.startsWith("http") ? "_blank" : undefined}
                rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="w-10 h-10 rounded-xl bg-secondary/35 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-signal hover:border-signal/35 hover:shadow-[0_0_16px_-6px_hsl(var(--signal)/0.35)] hover:-translate-y-0.5 transition-all duration-300"
                title={s.name}
              >
                <s.icon />
              </a>
            ))}
          </div>
        </div>

        <div className="text-center mt-10 pt-8 border-t border-border/40">
          <p className="text-[11px] font-mono text-muted-foreground/80 tracking-wide">
            © 2026 Plankton · Market intelligence & execution tools
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
