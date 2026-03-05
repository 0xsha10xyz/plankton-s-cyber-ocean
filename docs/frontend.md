# Frontend

The Plankton frontend is a single-page app (Vite + React + TypeScript) with wallet connection, account management, and an AI agent chat.

## Tech stack

- **Vite** — Build and dev server  
- **React 18** — UI  
- **TypeScript** — Typing  
- **Tailwind CSS** — Styling  
- **shadcn/ui** — Components (Sheet, Button, Input, Avatar, etc.)  
- **Framer Motion** — Animations  
- **React Router** — Routing  
- **Solana wallet adapter** — Phantom, Solflare (connect/disconnect, balance)  
- **TanStack Query** — Optional for server state (not required for current mock data)

## Main features

### 1. Navigation

- **Header** (fixed): Logo, nav links (Dashboard, Research, Screener, $PATTIES Governance, Docs, Subscription), Connect Wallet / connected state, Account (when connected), mobile menu.
- **Nav links** scroll to sections on the same page; **Docs** scrolls to the Docs section.
- **Scroll spy** highlights the current section in the header.

### 2. Connect wallet

- **Connect Wallet** opens a modal with supported wallets (Phantom, Solflare).
- After a successful connection, the modal closes automatically.
- When connected: header shows truncated address and a dropdown with **Account** and **Disconnect**.
- Wallet state is from `@solana/wallet-adapter-react`; modal state from `WalletModalContext`.

### 3. Account (when connected)

- **Account** in the header or dropdown opens the **Account sidebar** (sheet from the left).
- **Account sidebar** includes:
  - **Avatar** — Upload image (stored per wallet in `localStorage`).
  - **Username** — Edit and save (stored per wallet).
  - **SOL balance** — Fetched from Solana RPC.
  - **Connected wallet** — Full address.
  - **Disconnect** — Disconnects and closes the sidebar.
- Profile is keyed by wallet address (`plankton_account_<address>` in `localStorage`).

### 4. Autonomous Agent Protocols

- **Command Center** section: **AITerminal** (scrolling logs) and **AutoPilot** (Autonomous Agent card).
- **AutoPilot** card:
  - Title: “Autonomous Agent Protocols”; subtitle: “Auto Pilot - Your Agent Partner”.
  - When **not** connected: message and “Connect Wallet” button.
  - When **connected**: toggle, P/L (24h, Total), risk slider, and accordions: **How to set it up**, **How it works**, **Benefits**.

### 5. AI Agent Chat (when connected)

- **Floating button** (bot icon) at bottom-right opens **AI Agent Chat** (sheet from the right).
- **Chat** includes:
  - Welcome message from the agent.
  - User and agent messages (user right, agent left).
  - Text input + Send; Enter to send, Shift+Enter for new line.
  - Mock AI replies based on keywords (portfolio, risk, market, agent, PATTIES, help, etc.).
- Only visible when the wallet is connected.

### 6. Other sections

- **Dashboard** — Hero and intro.
- **Research & Screening** — ResearchFeed (whale, launches, volume) and ChartPlaceholder (screener).
- **$PATTIES Tokenomics** — TokenSection (token info + Burn dashboard).
- **Subscription Tiers** — PricingSection (Free, Pro, Autonomous).
- **Roadmap** — Roadmap component.
- **Docs** — In-app docs section (overview and links to repo `docs/`).

## Key files

| Path | Purpose |
|------|--------|
| `src/App.tsx` | Root layout, providers (Solana, WalletModal, Account, ErrorBoundary) |
| `src/contexts/WalletContext.tsx` | Solana ConnectionProvider + WalletProvider |
| `src/contexts/WalletModalContext.tsx` | Modal open/close state |
| `src/contexts/AccountContext.tsx` | Profile (username, avatar) per wallet |
| `src/components/Header.tsx` | Nav, wallet button, Account trigger |
| `src/components/WalletModal.tsx` | Connect wallet modal; auto-closes when connected |
| `src/components/AccountSidebar.tsx` | Account sheet (balance, username, avatar) |
| `src/components/AgentChat.tsx` | AI agent chat sheet |
| `src/components/AutoPilot.tsx` | Autonomous Agent card |
| `src/pages/Index.tsx` | Main page, sections, AI chat FAB when connected |

## Theming

- **CSS variables** in `src/index.css` (e.g. `--background`, `--primary`, `--accent`).
- **Glass card** style: `glass-card`, `glow-text`, `neon-button`.
- **Scroll margin** on sections for fixed header: `scroll-mt-24`.
