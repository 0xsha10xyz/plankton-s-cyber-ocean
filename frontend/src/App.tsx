import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import DocsLayout from "@/components/docs/DocsLayout";
import DocsHome from "@/components/docs/DocsHome";
import DocArticle from "@/components/docs/DocArticle";
import AgentChatPage from "./pages/AgentChatPage";
import LaunchAgentPage from "./pages/LaunchAgentPage";
import Dashboard from "./pages/Dashboard";
import { EvmWalletProviders } from "@/contexts/EvmWalletProviders";
import { AppConfigProvider } from "@/hooks/useAppConfig";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AppConfigProvider>
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
                  {/* Default: open on the professional dashboard experience */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  {/* Marketing / landing content stays available */}
                  <Route path="/home" element={<Index />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/swap" element={<Swap />} />
                  <Route path="/docs" element={<DocsLayout />}>
                    <Route index element={<DocsHome />} />
                    <Route path=":slug" element={<DocArticle />} />
                  </Route>
                  <Route path="/agent-chat" element={<AgentChatPage />} />
                  <Route
                    path="/launch-agent"
                    element={
                      <EvmWalletProviders>
                        <LaunchAgentPage />
                      </EvmWalletProviders>
                    }
                  />
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
      </AppConfigProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
