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

- **Header** (fixed): Logo, nav links (Dashboard, **Swap**, Research, Screener, PAP (Plankton Autonomous Protocol) Governance, Subscription, Roadmap, Docs), Connect Wallet / connected state, Account (when connected), mobile menu.
- **Swap** opens the dedicated Swap page (`/swap`). Other nav links scroll to sections on the same page.
- **Scroll spy** highlights the current section in the header (on the home page).

### 2. Total Users

- The app displays a **Total Users** count (unique wallets that have connected).
- Shown in the hero (prominent card), in a stats strip below the hero, in the footer, and on the Swap page.
- When a user connects their wallet, the frontend calls `POST /api/stats/connect`; the count updates immediately and is polled periodically for all visitors.

### 3. Connect wallet

- **Connect Wallet** opens a modal with supported wallets (Phantom, Solflare).
- After a successful connection, the modal closes automatically.
- When connected: header shows truncated address and a dropdown with **Account** and **Disconnect**.
- Wallet state is from `@solana/wallet-adapter-react`; modal state from `WalletModalContext`.

### 4. Account (when connected)

- **Account** in the header or dropdown opens the **Account sidebar** (sheet from the left).
- **Account sidebar** includes:
  - **Avatar** — Upload image (stored per wallet in `localStorage`).
  - **Username** — Edit and save (stored per wallet).
  - **Assets** — SOL and all SPL token balances for the connected wallet. Amounts use full decimal precision (smallest unit visible) so even tiny balances are readable. Known symbols (SOL, USDC, USDT) are shown by name; other mints show a truncated address.
  - **Connected wallet** — Full address.
  - **Disconnect** — Disconnects and closes the sidebar.
- Profile is keyed by wallet address (`plankton_account_<address>` in `localStorage`).

### 5. Autonomous Agent Protocol

- **Command Center** section: **AITerminal** (scrolling logs) and **AutoPilot** (Autonomous Agent card).
- **AutoPilot** card:
  - Title: “Autonomous Agent Protocol”; subtitle: “Auto Pilot - Your Agent Partner”.
  - When **not** connected: message and “Connect Wallet” button.
  - When **connected**: toggle, P/L (24h, Total), risk slider, and SOON.

### 6. AI Agent Chat (when connected)

- **Floating button** (bot icon) at bottom-right opens **AI Agent Chat** (sheet from the right).
- **Chat** includes:
  - Welcome message from the agent.
  - User and agent messages (user right, agent left).
  - Text input + Send; Enter to send, Shift+Enter for new line.
  - Mock AI replies based on keywords (portfolio, risk, market, agent, PAP, help, etc.).
- **Quick actions**:
  - `Check Balance` / `Check another wallet` → shows **Balance details** with `SOL <amount>` and lines like `TOKEN_NAME <amount>` (mint/contract not shown).
  - `Buy` / `Sell` → also shows **Balance details**, but each SPL token line includes the token contract (mint) in short form: `TOKEN_NAME <amount> | <mint>`.
- Only visible when the wallet is connected.

### 7. Swap

- **Swap** link in the header opens the **Swap** page (`/swap`).
- **Trading chart** — Time ranges 1H, 4H, 1D, 1W for the selected pair (e.g. SOL/USDC).
- **Manual swap form** — From/To token select (SOL, USDC, USDT), amount input, **Get quote** (Jupiter API), then **Swap** to execute. Success link to Solscan.
- Requires wallet connection. Provides manual trading until the autonomous agent is fully live.

### 8. Other sections

- **Dashboard** — Hero, Total Users card, stats strip, Research & Screening (feeds, screener), PAP (Plankton Autonomous Protocol) Tokenomics, Subscription Tiers, **Roadmap** (Phase 0–8: Narrative, Foundation, Development LIVE; Pre Launch, Security, Token Launch, Expansion, Governance, Full Launch SOON), Docs.
- **Footer** — Total Users, social links (X: Planktonomous), copyright.

## Key files

| Path | Purpose |
|------|--------|
| `src/App.tsx` | Root layout, providers (Solana, WalletModal, Account, ErrorBoundary) |
| `src/contexts/WalletContext.tsx` | Solana ConnectionProvider + WalletProvider |
| `src/contexts/WalletModalContext.tsx` | Modal open/close state |
| `src/contexts/AccountContext.tsx` | Profile (username, avatar) per wallet |
| `src/components/Header.tsx` | Nav, wallet button, Account trigger |
| `src/components/WalletModal.tsx` | Connect wallet modal; auto-closes when connected |
| `src/components/AccountSidebar.tsx` | Account sheet (Assets: SOL + SPL tokens, username, avatar) |
| `src/lib/assets.ts` | Asset formatting (full decimal precision), token symbols |
| `src/components/AgentChat.tsx` | AI agent chat sheet |
| `src/components/AutoPilot.tsx` | Autonomous Agent card |
| `src/components/TotalUsersStat.tsx` | Total Users display (hero, strip, default) |
| `src/contexts/StatsContext.tsx` | User count fetch, poll, register wallet on connect |
| `src/pages/Swap.tsx` | Swap page (chart + Jupiter swap form) |
| `src/lib/jupiter.ts` | Jupiter v6 quote and swap API client |
| `src/pages/Index.tsx` | Main page, sections, AI chat FAB when connected |

## Theming

- **CSS variables** in `src/index.css` (e.g. `--background`, `--primary`, `--accent`).
- **Glass card** style: `glass-card`, `glow-text`, `neon-button`.
- **Scroll margin** on sections for fixed header: `scroll-mt-24`.
