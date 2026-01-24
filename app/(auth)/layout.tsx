import { SolanaWalletProvider } from "@/lib/solana/wallet-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SolanaWalletProvider>
      {children}
    </SolanaWalletProvider>
  );
}
