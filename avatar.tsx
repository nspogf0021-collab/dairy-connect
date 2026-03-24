import React from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const userId = localStorage.getItem("milkLedgerUserId");

  const { data: user } = useGetMe(
    { userId: userId || "" },
    { query: { enabled: !!userId, staleTime: Infinity } }
  );

  const handleLogout = () => {
    localStorage.removeItem("milkLedgerUserId");
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-[#eaf4fb] flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-[400px]">
        {children}
      </div>
    </div>
  );
}

export function useLogout() {
  const [, setLocation] = useLocation();
  return () => {
    localStorage.removeItem("milkLedgerUserId");
    setLocation("/login");
  };
}
