import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import React, { useEffect } from "react";

import Login from "@/pages/login";
import Onboarding from "@/pages/onboarding";
import SellerDashboard from "@/pages/seller-dashboard";
import CollectorDashboard from "@/pages/collector-dashboard";
import DistributorDashboard from "@/pages/distributor-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AuthGuard({ children, requireRole }: { children: React.ReactNode; requireRole?: string }) {
  const [, setLocation] = useLocation();
  const userId = localStorage.getItem("milkLedgerUserId");
  const { data: user, isLoading, error } = useGetMe({ userId: userId || "" }, { query: { enabled: !!userId, retry: false } });

  useEffect(() => {
    if (!userId || error) setLocation("/login");
    else if (user && !user.role) setLocation("/onboarding");
    else if (user && requireRole && user.role !== requireRole) setLocation(`/${user.role}-dashboard`);
  }, [userId, user, error, setLocation, requireRole]);

  if (!userId) return null;
  if (isLoading) return (
    <div className="min-h-screen bg-[#eaf4fb] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1a73e8] border-t-transparent" />
    </div>
  );
  if (!user) return null;
  if (requireRole && user.role !== requireRole) return null;
  return <>{children}</>;
}

function RootRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/login"); }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={RootRedirect} />
      <Route path="/onboarding"><AuthGuard><Onboarding /></AuthGuard></Route>
      <Route path="/seller-dashboard"><AuthGuard requireRole="seller"><SellerDashboard /></AuthGuard></Route>
      <Route path="/collector-dashboard"><AuthGuard requireRole="collector"><CollectorDashboard /></AuthGuard></Route>
      <Route path="/distributor-dashboard"><AuthGuard requireRole="distributor"><DistributorDashboard /></AuthGuard></Route>
      <Route path="/admin-dashboard"><AuthGuard requireRole="admin"><AdminDashboard /></AuthGuard></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
