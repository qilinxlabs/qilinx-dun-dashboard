"use client";

import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Chat } from "@/lib/db/schema";
import { fetcher, cn } from "@/lib/utils";
import { LoaderIcon, PlusIcon, TrashIcon } from "./icons";

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats
  );
};

function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `/api/history?limit=${PAGE_SIZE}`;
  }

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) {
    return null;
  }

  return `/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

function ChatItem({
  chat,
  isActive,
  onDelete,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
        isActive && "bg-accent"
      )}
    >
      <Link href={`/chat/${chat.id}`} className="flex-1 truncate">
        {chat.title}
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(chat.id);
        }}
      >
        <TrashIcon size={14} />
      </Button>
    </div>
  );
}

function ChatGroup({
  title,
  chats,
  activeChatId,
  onDelete,
}: {
  title: string;
  chats: Chat[];
  activeChatId: string | null;
  onDelete: (id: string) => void;
}) {
  if (chats.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1">
        {chats.map((chat) => (
          <ChatItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === activeChatId}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeChatId = pathname?.startsWith("/chat/") 
    ? pathname.split("/")[2] 
    : null;

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    fallbackData: [],
  });

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const handleDelete = () => {
    const chatToDelete = deleteId;
    const isCurrentChat = pathname === `/chat/${chatToDelete}`;

    setShowDeleteDialog(false);

    const deletePromise = fetch(`/api/chat?id=${chatToDelete}`, {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Deleting chat...",
      success: () => {
        mutate((chatHistories) => {
          if (chatHistories) {
            return chatHistories.map((chatHistory) => ({
              ...chatHistory,
              chats: chatHistory.chats.filter(
                (chat) => chat.id !== chatToDelete
              ),
            }));
          }
        });

        if (isCurrentChat) {
          router.replace("/chat");
        }

        return "Chat deleted successfully";
      },
      error: "Failed to delete chat",
    });
  };

  const handleNewChat = () => {
    router.push("/chat/new");
  };

  const chatsFromHistory =
    paginatedChatHistories?.flatMap(
      (paginatedChatHistory) => paginatedChatHistory.chats
    ) || [];

  const groupedChats = groupChatsByDate(chatsFromHistory);

  return (
    <>
      <div className="w-80 border-r bg-muted/30 flex flex-col h-full">
        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Chat History</h2>
          <Button size="sm" variant="ghost" onClick={handleNewChat}>
            <PlusIcon />
          </Button>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="animate-spin">
                  <LoaderIcon />
                </span>
              </div>
            ) : chatsFromHistory.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <p>No chats yet</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={handleNewChat}
                >
                  Start a new chat
                </Button>
              </div>
            ) : (
              <>
                <ChatGroup
                  title="Today"
                  chats={groupedChats.today}
                  activeChatId={activeChatId}
                  onDelete={(id) => {
                    setDeleteId(id);
                    setShowDeleteDialog(true);
                  }}
                />
                <ChatGroup
                  title="Yesterday"
                  chats={groupedChats.yesterday}
                  activeChatId={activeChatId}
                  onDelete={(id) => {
                    setDeleteId(id);
                    setShowDeleteDialog(true);
                  }}
                />
                <ChatGroup
                  title="Last 7 days"
                  chats={groupedChats.lastWeek}
                  activeChatId={activeChatId}
                  onDelete={(id) => {
                    setDeleteId(id);
                    setShowDeleteDialog(true);
                  }}
                />
                <ChatGroup
                  title="Last 30 days"
                  chats={groupedChats.lastMonth}
                  activeChatId={activeChatId}
                  onDelete={(id) => {
                    setDeleteId(id);
                    setShowDeleteDialog(true);
                  }}
                />
                <ChatGroup
                  title="Older"
                  chats={groupedChats.older}
                  activeChatId={activeChatId}
                  onDelete={(id) => {
                    setDeleteId(id);
                    setShowDeleteDialog(true);
                  }}
                />

                {!hasReachedEnd && (
                  <div className="py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSize((size) => size + 1)}
                      disabled={isValidating}
                    >
                      {isValidating ? (
                        <span className="animate-spin mr-2">
                          <LoaderIcon />
                        </span>
                      ) : null}
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
