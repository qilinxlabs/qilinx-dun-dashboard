import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { LandingPage } from "@/components/landing-page";
import { redirect } from "next/navigation";
import { SolanaWalletProvider } from "@/lib/solana/wallet-provider";

async function PageContent() {
  const session = await auth();
  
  // If user is logged in (regular or wallet), redirect to dashboard
  if (session?.user && (session.user.type === "regular" || session.user.type === "wallet")) {
    redirect("/dashboard");
  }
  
  return <LandingPage />;
}

export default function Page() {
  // Show landing page for guests and unauthenticated users (no sidebar)
  return (
    <SolanaWalletProvider>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
        <PageContent />
      </Suspense>
    </SolanaWalletProvider>
  );
}
