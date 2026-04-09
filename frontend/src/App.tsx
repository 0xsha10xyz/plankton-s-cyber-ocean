import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MotionConfig } from "framer-motion";
import { SolanaWalletProviders } from "@/contexts/WalletContext";
import { StatsProvider, StatsWalletTracker } from "@/contexts/StatsContext";
import { WalletModalProvider } from "@/contexts/WalletModalContext";
import { AccountProvider } from "@/contexts/AccountContext";
import { WalletBalancesProvider } from "@/contexts/WalletBalancesContext";
import { TokenSymbolProvider } from "@/contexts/TokenSymbolContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Swap from "./pages/Swap";
import Docs from "./pages/Docs";
import AgentChatPage from "./pages/AgentChatPage";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SolanaWalletProviders>
        <StatsProvider>
          <WalletModalProvider>
            <AccountProvider>
            <WalletBalancesProvider>
            <TokenSymbolProvider>
            <SubscriptionProvider>
            <TooltipProvider>
            <Toaster />
            <Sonner />
            <MotionConfig reducedMotion="always">
              <BrowserRouter
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
              >
                <ScrollToTop />
                <StatsWalletTracker />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/swap" element={<Swap />} />
                  <Route path="/docs" element={<Docs />} />
                  <Route path="/agent-chat" element={<AgentChatPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </MotionConfig>
            </TooltipProvider>
            </SubscriptionProvider>
            </TokenSymbolProvider>
            </WalletBalancesProvider>
          </AccountProvider>
        </WalletModalProvider>
        </StatsProvider>
      </SolanaWalletProviders>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
