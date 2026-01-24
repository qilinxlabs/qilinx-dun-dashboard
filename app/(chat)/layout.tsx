import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SolanaWalletProvider } from "@/lib/solana/wallet-provider";
import { auth } from "../(auth)/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <SolanaWalletProvider>
          <Suspense fallback={<div className="flex h-dvh" />}>
            <LayoutWrapper>{children}</LayoutWrapper>
          </Suspense>
        </SolanaWalletProvider>
      </DataStreamProvider>
    </>
  );
}

async function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  // Default to open (true) unless explicitly set to "false"
  const isOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Always show sidebar in the (chat) route group
  return (
    <SidebarProvider defaultOpen={isOpen}>
      <AppSidebar user={session?.user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
