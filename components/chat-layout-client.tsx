"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";

type ChatHistoryContextType = {
  showChatHistory: boolean;
  toggleChatHistory: () => void;
};

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(undefined);

export function useChatHistory() {
  const context = useContext(ChatHistoryContext);
  if (!context) {
    throw new Error("useChatHistory must be used within ChatLayoutClient");
  }
  return context;
}

export function ChatLayoutClient({
  children,
}: {
  children: ReactNode;
}) {
  const [showChatHistory, setShowChatHistory] = useState(true);

  const toggleChatHistory = () => setShowChatHistory(!showChatHistory);

  return (
    <ChatHistoryContext.Provider value={{ showChatHistory, toggleChatHistory }}>
      <div className="flex h-[calc(100dvh-0px)] overflow-hidden">
        {/* Chat History Sidebar */}
        {showChatHistory && <ChatSidebar />}
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </ChatHistoryContext.Provider>
  );
}
