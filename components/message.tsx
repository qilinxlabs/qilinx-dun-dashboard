"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import dynamic from "next/dynamic";
import equal from "fast-deep-equal";
import { memo, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";

// Lazy load DunToolExecutor since it imports heavy crypto libraries
const DunToolExecutor = dynamic(
  () => import("./chat/dun-tool-executor").then(mod => ({ default: mod.DunToolExecutor })),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center p-4">Loading...</div>
  }
);

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  isHistorical,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  isHistorical: boolean;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  return (
    <div
      className="group/message fade-in w-full animate-in duration-200"
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim()
            ),
            "w-full":
              (message.role === "assistant" &&
                (message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                ) ||
                  message.parts?.some((p) => p.type.startsWith("tool-")))) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === "reasoning" && part.text?.trim().length > 0) {
              return (
                <MessageReasoning
                  isLoading={isLoading}
                  key={key}
                  reasoning={part.text}
                />
              );
            }

            if (type === "text") {
              if (mode === "view") {
                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "wrap-break-word w-fit rounded-2xl px-3 py-2 text-right text-white":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                      style={
                        message.role === "user"
                          ? { backgroundColor: "#006cff" }
                          : undefined
                      }
                    >
                      <Response>{sanitizeText(part.text)}</Response>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            // Generic MCP tool rendering
            if (type.startsWith("tool-")) {
              const toolPart = part as {
                toolCallId: string;
                state: "input-streaming" | "input-available" | "approval-requested" | "approval-responded" | "output-available" | "output-error" | "output-denied";
                input?: unknown;
                output?: unknown;
              };
              const { toolCallId, state } = toolPart;

              // Check if this is a Dun tool that requires client execution
              const isDunTool = type.startsWith("tool-checkShieldedBalance") || 
                                type.startsWith("tool-wrapSol") ||
                                type.startsWith("tool-unwrapSol") ||
                                type.startsWith("tool-depositToShieldedPool") ||
                                type.startsWith("tool-withdrawFromShieldedPool") ||
                                type.startsWith("tool-createPaymentRequest") ||
                                type.startsWith("tool-getMyPaymentRequests") ||
                                type.startsWith("tool-payPaymentRequest") ||
                                type.startsWith("tool-getPaymentRequestDetails");
              const output = toolPart.output as Record<string, unknown> | undefined;
              const requiresClientExecution = output?.requiresClientExecution === true;
              
              // CRITICAL: Only render DunToolExecutor for NEW messages (not historical)
              // Historical messages were already executed when they were created
              if (isDunTool && state === "output-available" && requiresClientExecution && !isHistorical) {
                return (
                  <div className="w-full" key={toolCallId}>
                    <DunToolExecutor
                      toolCall={output as any}
                      toolCallId={toolCallId}
                      onComplete={async (result) => {
                        // Save the result to database
                        try {
                          await fetch('/api/tool-result', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              messageId: message.id,
                              toolCallId,
                              result,
                            }),
                          });
                          
                          // Update local message state immediately
                          setMessages((currentMessages) => 
                            currentMessages.map((msg) => {
                              if (msg.id === message.id) {
                                return {
                                  ...msg,
                                  parts: msg.parts.map((part: any) => {
                                    if (part.toolCallId === toolCallId) {
                                      return {
                                        ...part,
                                        output: {
                                          ...part.output,
                                          ...result,
                                        },
                                      };
                                    }
                                    return part;
                                  }),
                                };
                              }
                              return msg;
                            })
                          );
                        } catch (error) {
                          console.error('Failed to save tool result:', error);
                        }
                      }}
                    />
                  </div>
                );
              }

              // Render custom UI for Dun tools with results
              const isDunToolWithResult = isDunTool && state === "output-available" && output;
              
              if (isDunToolWithResult) {
                const hasSuccess = output.success === true;
                const hasError = output.error;
                
                return (
                  <div className="w-full" key={toolCallId}>
                    <Tool className="w-full" defaultOpen={true}>
                      <ToolHeader state={state} type={type as `tool-${string}`} />
                      <ToolContent>
                        {hasError ? (
                          <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                            <div className="font-medium">Error</div>
                            <div className="mt-1">{String(output.error)}</div>
                          </div>
                        ) : hasSuccess ? (
                          <div className="rounded border border-green-200 bg-green-50 p-3 text-green-700 text-sm">
                            <div className="font-medium">{String(output.message || 'Success')}</div>
                            {(output.signature && typeof output.signature === 'string') ? (
                              <div className="mt-2 font-mono text-xs">
                                Signature: {output.signature.slice(0, 8)}...{output.signature.slice(-8)}
                              </div>
                            ) : null}
                            {output.totalBalance ? (
                              <div className="mt-2">
                                Balance: {String(output.totalBalance)} SOL
                              </div>
                            ) : null}
                            {(output.commitments && Array.isArray(output.commitments) && output.commitments.length > 0) ? (
                              <div className="mt-2">
                                <div className="font-medium">Commitments:</div>
                                <ul className="mt-1 list-disc list-inside">
                                  {output.commitments.slice(0, 3).map((c: any, i: number) => (
                                    <li key={i}>
                                      {c.amount} SOL - {c.isSpent ? 'Spent' : 'Unspent'}
                                    </li>
                                  ))}
                                  {output.commitments.length > 3 && (
                                    <li>... and {output.commitments.length - 3} more</li>
                                  )}
                                </ul>
                              </div>
                            ) : null}
                            {output.paymentUrl ? (
                              <div className="mt-2">
                                <div className="font-medium">Payment URL:</div>
                                <div className="mt-1 break-all font-mono text-xs bg-white p-2 rounded border">
                                  {String(output.paymentUrl)}
                                </div>
                              </div>
                            ) : null}
                            {(output.requests && Array.isArray(output.requests) && output.requests.length > 0) ? (
                              <div className="mt-2">
                                <div className="font-medium mb-2">Payment Requests:</div>
                                {output.requests.map((req: any, i: number) => (
                                  <div key={i} className="mb-3 p-2 bg-white rounded border">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <div className="font-medium">{req.amount} SOL</div>
                                        <div className="text-xs text-gray-600">Status: {req.status}</div>
                                      </div>
                                      <div className={`text-xs px-2 py-1 rounded ${
                                        req.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                        req.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {req.status}
                                      </div>
                                    </div>
                                    <div className="mt-1 text-xs text-gray-600">
                                      Created: {new Date(req.createdAt).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      Expires: {new Date(req.expiresAt).toLocaleString()}
                                    </div>
                                    {req.paymentUrl && (
                                      <div className="mt-2">
                                        <div className="text-xs font-medium">Payment URL:</div>
                                        <div className="mt-1 break-all font-mono text-xs bg-gray-50 p-1 rounded">
                                          {req.paymentUrl}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {output.requestId ? (
                              <div className="mt-2 space-y-1 text-xs">
                                <div><span className="font-medium">Request ID:</span> {String(output.requestId)}</div>
                                {output.amount ? <div><span className="font-medium">Amount:</span> {String(output.amount)} SOL</div> : null}
                                {output.status ? <div><span className="font-medium">Status:</span> {String(output.status)}</div> : null}
                                {output.payee ? <div><span className="font-medium">Payee:</span> {String(output.payee)}</div> : null}
                                {output.createdAt ? <div><span className="font-medium">Created:</span> {new Date(output.createdAt as any).toLocaleString()}</div> : null}
                                {output.expiresAt ? <div><span className="font-medium">Expires:</span> {new Date(output.expiresAt as any).toLocaleString()}</div> : null}
                                {output.paidAt ? <div><span className="font-medium">Paid:</span> {new Date(output.paidAt as any).toLocaleString()}</div> : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap text-sm">
                            {JSON.stringify(output, null, 2)}
                          </pre>
                        )}
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              return (
                <div className="w-full" key={toolCallId}>
                  <Tool className="w-full" defaultOpen={true}>
                    <ToolHeader state={state} type={type as `tool-${string}`} />
                    <ToolContent>
                      {(state === "input-available" || state === "input-streaming") && toolPart.input ? (
                        <ToolInput input={toolPart.input} />
                      ) : null}
                      {state === "output-available" && toolPart.output ? (
                        <ToolOutput
                          errorText={undefined}
                          output={
                            typeof toolPart.output === "object" && toolPart.output !== null && "error" in toolPart.output ? (
                              <div className="rounded border p-2 text-red-500">
                                Error: {String((toolPart.output as { error: unknown }).error)}
                              </div>
                            ) : (
                              <pre className="whitespace-pre-wrap text-sm">
                                {typeof toolPart.output === "string"
                                  ? toolPart.output
                                  : JSON.stringify(toolPart.output, null, 2)}
                              </pre>
                            )
                          }
                        />
                      ) : null}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            return null;
          })}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.message.id === nextProps.message.id &&
      prevProps.requiresScrollPadding === nextProps.requiresScrollPadding &&
      equal(prevProps.message.parts, nextProps.message.parts) &&
      equal(prevProps.vote, nextProps.vote)
    ) {
      return true;
    }
    return false;
  }
);

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message fade-in w-full animate-in duration-300"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <div className="animate-pulse">
            <SparklesIcon size={14} />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="flex items-center gap-1 p-0 text-muted-foreground text-sm">
            <span className="animate-pulse">Thinking</span>
            <span className="inline-flex">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
