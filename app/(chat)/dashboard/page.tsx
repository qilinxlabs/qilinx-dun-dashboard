import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/app/(auth)/auth";
import { PageHeader } from "@/components/ui/page-header";
import { 
  MessageSquare, 
  User, 
  Store, 
  Bot, 
  FileCode, 
  LayoutDashboard as LayoutDashboardIcon,
  CreditCard,
  ArrowRight,
  Shield
} from "lucide-react";

interface QuickActionProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function QuickAction({ href, icon, title, description }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group rounded-lg border bg-card p-4 hover:bg-accent hover:border-primary/20 transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-medium group-hover:text-primary transition-colors">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <PageHeader
        icon="layout-dashboard"
        title="Dun Dashboard"
        description={session?.user?.walletAddress ? `Wallet: ${session.user.walletAddress.slice(0, 4)}...${session.user.walletAddress.slice(-4)}` : "Connect your wallet to get started"}
      />

      {/* Agent Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm font-medium text-muted-foreground">x402 Agents</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickAction
            href="/chat"
            icon={<MessageSquare className="h-5 w-5" />}
            title="Chats"
            description="Start a conversation with the AI assistant"
          />
          <QuickAction
            href="/account"
            icon={<User className="h-5 w-5" />}
            title="My Account"
            description="Manage your profile, wallet, and API tokens"
          />
        </div>
      </div>

      {/* Solana Privacy Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm font-medium text-muted-foreground">Privacy Tools</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickAction
            href="/shielded-pool"
            icon={<Shield className="h-5 w-5" />}
            title="Shielded Pool"
            description="Private SOL transfers using zero-knowledge proofs"
          />
          <QuickAction
            href="/x402-payment"
            icon={<CreditCard className="h-5 w-5" />}
            title="x402 Payments"
            description="Privacy-preserving payment requests on Solana"
          />
        </div>
      </div>
    </div>
  );
}
