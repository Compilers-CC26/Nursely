import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  ExternalLink,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";
import {
  generateResponse,
  getSuggestions,
  type ChatMessage,
  type Citation,
  type FilterCommand,
} from "@/services/chatMock";

interface ChatPanelProps {
  selectedPatient: Patient | null;
  liveCensus: Patient[];
  /** Pre-filled message sent from the Analyst panel */
  pendingMessage?: string | null;
  /** Called after the pending message has been consumed */
  onPendingMessageConsumed?: () => void;
  /** Called when the chat suggests updating the search/filter in the table */
  onSearchUpdate?: (query: string) => void;
  /** Current active filter applied to the patient table */
  activeFilter?: FilterCommand | null;
  /** Called when the chat response contains a filter command */
  onApplyFilter?: (filter: FilterCommand | null) => void;
  /** Called when the chat detects a named patient to pull up their chart */
  onSelectPatient?: (patient: Patient) => void;
}

export default function ChatPanel({
  selectedPatient,
  liveCensus,
  pendingMessage,
  onPendingMessageConsumed,
  onSearchUpdate,
  activeFilter,
  onApplyFilter,
  onSelectPatient,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your **Nurse Analyst assistant**. I can help with clinical protocols, medication questions, patient assessments, SBAR reports, and more.\n\nTry asking me anything, or use one of the quick prompts below.",
      citations: [
        {
          title: "Clinical Knowledge Base",
          source: "Internal Guidelines",
          url: "#",
        },
      ],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTableSearch, setShowTableSearch] = useState(false);
  const [tableSearchInput, setTableSearchInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastConsumedPending = useRef<string | null>(null);

  const suggestions = getSuggestions(selectedPatient);

  // Scroll so the latest message starts near the top of the viewport
  useEffect(() => {
    if (lastMsgRef.current) {
      lastMsgRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const messageText = typeof text === "string" ? text : input;
      if (!messageText.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: messageText.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const { response, matchedPatient } = await generateResponse(
          messageText.trim(),
          selectedPatient,
          messages,
          liveCensus,
        );

        if (matchedPatient && onSelectPatient) {
          onSelectPatient(matchedPatient);
        }

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.content,
          citations: response.citations,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Apply any filter command the LLM detected in the user's message
        if (response.filterCommand) {
          onApplyFilter?.(response.filterCommand);
        }
      } catch (err) {
        console.error("Chat error:", err);
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "Sorry, I encountered an error connecting to the analytics service. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, isLoading, selectedPatient, messages, liveCensus, onSelectPatient],
  );

  // Handle pending message from Analyst panel — guard against double-fire
  useEffect(() => {
    if (
      pendingMessage &&
      !isLoading &&
      pendingMessage !== lastConsumedPending.current
    ) {
      lastConsumedPending.current = pendingMessage;
      sendMessage(pendingMessage);
      onPendingMessageConsumed?.();
    }
  }, [pendingMessage, isLoading, sendMessage, onPendingMessageConsumed]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Header ── */}
      <div className="border-b border-border/50 px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Nurse Assistant
          </h1>
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground truncate">
          {selectedPatient
            ? `Context: ${selectedPatient.name}`
            : "Unit View (All Patients)"}
        </p>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5"
      >
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            ref={i === messages.length - 1 ? lastMsgRef : undefined}
            className="flex flex-col gap-1.5"
          >
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="rounded-2xl bg-primary/10 px-4 py-2.5 text-[13px] leading-relaxed text-foreground max-w-[88%]">
                  <MessageContent content={msg.content} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
                <div className="flex gap-2.5">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </div>
                  <div className="text-[13px] leading-relaxed text-foreground min-w-0 flex-1">
                    <MessageContent content={msg.content} />
                  </div>
                </div>
              </div>
            )}

            {/* Citations */}
            {msg.role === "assistant" &&
              msg.citations &&
              msg.citations.length > 0 && (
                <div className="ml-3">
                  <CitationBlock citations={msg.citations} />
                </div>
              )}
          </div>
        ))}

        {isLoading && (
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
            <div className="flex gap-2.5">
              <div className="flex-shrink-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-1 pt-1">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* ── Quick Prompts ── */}
        {messages.length <= 2 && !isLoading && (
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 mt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Quick prompts
            </p>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="rounded-lg border border-border/50 bg-background px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:bg-muted hover:text-foreground hover:border-border"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Active filter indicator ── */}
      {activeFilter && activeFilter.type !== "clear" && (
        <div className="flex items-center gap-2 border-t border-border/50 bg-primary/5 px-4 py-2">
          <Filter className="h-3 w-3 shrink-0 text-primary" />
          <span className="flex-1 text-[11px] font-medium text-primary truncate">
            Table showing: {activeFilter.label}
          </span>
          <button
            onClick={() => onApplyFilter?.(null)}
            className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
            title="Clear filter"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Table search shortcut ── */}
      {onSearchUpdate && (
        <div className="border-t border-border/50 px-4 py-2">
          {showTableSearch ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (tableSearchInput.trim()) {
                  onSearchUpdate(tableSearchInput.trim());
                  setTableSearchInput("");
                  setShowTableSearch(false);
                }
              }}
              className="flex items-center gap-2"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Input
                autoFocus
                value={tableSearchInput}
                onChange={(e) => setTableSearchInput(e.target.value)}
                placeholder="Filter patient table..."
                className="h-7 text-xs"
                onBlur={() => {
                  if (!tableSearchInput.trim()) setShowTableSearch(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowTableSearch(false);
                    setTableSearchInput("");
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                disabled={!tableSearchInput.trim()}
              >
                <Send className="h-3 w-3" />
              </Button>
            </form>
          ) : (
            <button
              onClick={() => setShowTableSearch(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Search className="h-3 w-3" />
              Search patient table from here...
            </button>
          )}
        </div>
      )}

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-border/50 px-5 pb-5 pt-3">
        <div className="flex items-end gap-2 rounded-xl border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none"
            style={{ minHeight: "36px", maxHeight: "80px" }}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 rounded-md"
            disabled={!input.trim() || isLoading}
            onClick={() => sendMessage(input)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
          AI assistant — always verify with clinical guidelines
        </p>
      </div>
    </div>
  );
}

/** Collapsible citation block shown below assistant messages */
function CitationBlock({ citations }: { citations: Citation[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] font-medium text-primary/70 hover:text-primary transition-colors"
      >
        <BookOpen className="h-3 w-3" />
        {citations.length} source{citations.length !== 1 ? "s" : ""}
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1 rounded-lg border bg-muted/30 p-2">
          {citations.map((cite, i) => (
            <a
              key={i}
              href={cite.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted group"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {cite.title}
                </span>
                <span className="block text-[10px] text-muted-foreground truncate">
                  {cite.source}
                </span>
              </div>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50 group-hover:text-primary mt-0.5" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Simple markdown-like renderer for bold text and newlines */
function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
