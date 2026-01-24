"use client";

import type { LucideIcon } from "lucide-react";
import { 
  Info, 
  User, 
  Store, 
  FileCode, 
  CreditCard, 
  LayoutDashboard, 
  Bot 
} from "lucide-react";

// Icon map for server component compatibility
const iconMap: Record<string, LucideIcon> = {
  user: User,
  store: Store,
  "file-code": FileCode,
  "credit-card": CreditCard,
  "layout-dashboard": LayoutDashboard,
  bot: Bot,
};

interface PageHeaderProps {
  icon?: LucideIcon | string;
  title: string;
  description: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "outline";
  };
  notice?: {
    text: string;
    link?: {
      href: string;
      label: string;
    };
  };
  children?: React.ReactNode;
}

export function PageHeader({
  icon,
  title,
  description,
  badge,
  notice,
  children,
}: PageHeaderProps) {
  // Resolve icon - either from string name or direct component
  const Icon = typeof icon === "string" ? iconMap[icon] : icon;
  
  return (
    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-background via-background to-muted/30 p-6 mb-6">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
      <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
      
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {badge && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    badge.variant === "secondary"
                      ? "bg-secondary text-secondary-foreground"
                      : badge.variant === "outline"
                      ? "border border-border text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {badge.text}
                </span>
              )}
            </div>
            <p className="text-muted-foreground max-w-2xl">{description}</p>
          </div>
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
      
      {notice && (
        <div className="relative mt-4 flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0" />
          <span>{notice.text}</span>
          {notice.link && (
            <a
              href={notice.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300"
            >
              {notice.link.label}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
