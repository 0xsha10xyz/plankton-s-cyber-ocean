import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SolanaWalletProviders } from "@/contexts/WalletContext";
import { WalletModalProvider } from "@/contexts/WalletModalContext";
import { AccountProvider } from "@/contexts/AccountContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SolanaWalletProviders>
        <WalletModalProvider>
          <AccountProvider>
            <SubscriptionProvider>
            <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </TooltipProvider>
            </SubscriptionProvider>
          </AccountProvider>
        </WalletModalProvider>
      </SolanaWalletProviders>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
