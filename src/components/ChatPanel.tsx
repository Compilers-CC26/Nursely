import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Loader2, Sparkles, ExternalLink, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";
import {
  generateResponse,
  getSuggestions,
  type ChatMessage,
  type Citation,
} from "@/services/chatMock";

interface ChatPanelProps {
  selectedPatient: Patient | null;
}

export default function ChatPanel({ selectedPatient }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your **Nurse Analyst assistant**. I can help with clinical protocols, medication questions, patient assessments, SBAR reports, and more.\n\nTry asking me anything, or use one of the quick prompts below.",
      citations: [
        { title: "Clinical Knowledge Base", source: "Internal Guidelines", url: "#" },
      ],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = getSuggestions(selectedPatient);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const response = await generateResponse(
          text,
          selectedPatient,
          messages
        );
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content,
          citations: response.citations,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [isLoading, selectedPatient, messages]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Nurse Assistant</h3>
          <p className="text-xs text-muted-foreground">
            {selectedPatient
              ? `Context: ${selectedPatient.name}`
              : "No patient selected"}
          </p>
        </div>
        {isLoading && (
          <Loader2 className="ml-auto h-4 w-4 animate-spin text-primary" />
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-1.5">
            <div
              className={cn(
                "flex gap-2.5",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground"
                )}
              >
                <MessageContent content={msg.content} />
              </div>
              {msg.role === "user" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Citations */}
            {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
              <div className="ml-8">
                <CitationBlock citations={msg.citations} />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="rounded-xl bg-muted/60 px-3.5 py-2.5">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* Quick suggestions */}
        {messages.length <= 2 && !isLoading && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground">
              Quick prompts:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2 rounded-lg border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about protocols, medications, patients..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none"
            style={{ maxHeight: "80px" }}
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
