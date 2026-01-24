import { Suspense } from "react";
import { ChatLayoutClient } from "@/components/chat-layout-client";
import { SigningModeProvider } from "@/lib/x402/signing-mode-context";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SigningModeProvider>
      <ChatLayoutClient>
        {children}
      </ChatLayoutClient>
    </SigningModeProvider>
  );
}
