"use client";

import { isToday, isYesterday, subMonths, subWeeks, format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type { Chat } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";
import { LoaderIcon, PlusIcon, TrashIcon, MessageIcon } from "./icons";

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export type ChatHistory = {
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

function ChatCard({ 
  chat, 
  onDelete 
}: { 
  chat: Chat; 
  onDelete: (id: string) => void;
}) {
  const formattedDate = format(new Date(chat.createdAt), "MMM d, h:mm a");

  return (
    <div className="rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors group">
      <Link href={`/chat/${chat.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-md bg-primary/10 shrink-0">
              <MessageIcon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium truncate">{chat.title}</h3>
              <p className="text-sm text-muted-foreground">{formattedDate}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(chat.id);
            }}
          >
            <TrashIcon size={14} />
          </Button>
        </div>
      </Link>
    </div>
  );
}

function ChatGroup({ 
  title, 
  chats, 
  onDelete 
}: { 
  title: string; 
  chats: Chat[]; 
  onDelete: (id: string) => void;
}) {
  if (chats.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {chats.map((chat) => (
          <ChatCard key={chat.id} chat={chat} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

export function ChatHistoryList() {
  const router = useRouter();
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

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = () => {
    const chatToDelete = deleteId;
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
        return "Chat deleted successfully";
      },
      error: "Failed to delete chat",
    });
  };

  const handleNewChat = () => {
    router.push("/chat/new");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={handleNewChat}>
            <PlusIcon />
            <span className="ml-2">New Chat</span>
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin">
            <LoaderIcon size={24} />
          </div>
        </div>
      </div>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={handleNewChat}>
            <PlusIcon />
            <span className="ml-2">New Chat</span>
          </Button>
        </div>
        <div className="rounded-lg border bg-card p-12 text-center">
          <MessageIcon size={48} />
          <h3 className="mt-4 text-lg font-medium">No chats yet</h3>
          <p className="mt-2 text-muted-foreground">
            Start a new conversation with the AI assistant to get help with payments.
          </p>
          <Button className="mt-4" onClick={handleNewChat}>
            Start your first chat
          </Button>
        </div>
      </div>
    );
  }

  const chatsFromHistory = paginatedChatHistories?.flatMap(
    (paginatedChatHistory) => paginatedChatHistory.chats
  ) || [];

  const groupedChats = groupChatsByDate(chatsFromHistory);

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={handleNewChat}>
            <PlusIcon />
            <span className="ml-2">New Chat</span>
          </Button>
        </div>

        <div className="space-y-8">
          <ChatGroup 
            title="Today" 
            chats={groupedChats.today} 
            onDelete={(id) => {
              setDeleteId(id);
              setShowDeleteDialog(true);
            }} 
          />
          <ChatGroup 
            title="Yesterday" 
            chats={groupedChats.yesterday} 
            onDelete={(id) => {
              setDeleteId(id);
              setShowDeleteDialog(true);
            }} 
          />
          <ChatGroup 
            title="Last 7 days" 
            chats={groupedChats.lastWeek} 
            onDelete={(id) => {
              setDeleteId(id);
              setShowDeleteDialog(true);
            }} 
          />
          <ChatGroup 
            title="Last 30 days" 
            chats={groupedChats.lastMonth} 
            onDelete={(id) => {
              setDeleteId(id);
              setShowDeleteDialog(true);
            }} 
          />
          <ChatGroup 
            title="Older" 
            chats={groupedChats.older} 
            onDelete={(id) => {
              setDeleteId(id);
              setShowDeleteDialog(true);
            }} 
          />
        </div>

        {!hasReachedEnd && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              onClick={() => setSize((size) => size + 1)}
              disabled={isValidating}
            >
              {isValidating ? (
                <>
                  <span className="animate-spin mr-2">
                    <LoaderIcon />
                  </span>
                  Loading...
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}

        {hasReachedEnd && chatsFromHistory.length > 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            You have reached the end of your chat history.
          </p>
        )}
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
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
