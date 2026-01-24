"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { PlusIcon, SidebarLeftIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";

function PureChatHeader({
  chatId,
  isReadonly,
  onToggleChatHistory,
  showChatHistory,
}: {
  chatId: string;
  isReadonly: boolean;
  onToggleChatHistory?: () => void;
  showChatHistory?: boolean;
}) {
  const router = useRouter();
  const { open } = useSidebar();

  const { width: windowWidth } = useWindowSize();

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      {/* Toggle Chat History Button */}
      <Button
        onClick={onToggleChatHistory}
        variant="outline"
        className="h-fit p-2"
        title="Toggle Chat History"
      >
        <SidebarLeftIcon size={16} />
        <span className="sr-only">Toggle Chat History</span>
      </Button>

      {(!open || windowWidth < 768) && (
        <Button
          className="order-2 ml-auto h-8 px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
          onClick={() => {
            router.push("/chat");
            router.refresh();
          }}
          variant="outline"
        >
          <PlusIcon />
          <span className="md:sr-only">New Chat</span>
        </Button>
      )}

    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.showChatHistory === nextProps.showChatHistory
  );
});
