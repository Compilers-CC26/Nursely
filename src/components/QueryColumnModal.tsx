import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, X, ChevronRight } from "lucide-react";
import type { Patient } from "@/types";
import { runQueryColumnBatch } from "@/services/chatMock";

interface Props {
  open: boolean;
  onClose: () => void;
  liveCensus: Patient[];
  onColumnReady: (label: string, results: Map<string, string>) => void;
}

const EXAMPLE_QUESTIONS = [
  "Does this patient likely need a sepsis reassessment?",
  "Is this patient at high fall risk?",
  "Does this patient show signs of dehydration?",
  "Is this patient a candidate for early discharge?",
  "Does this patient need a pain management review?",
];

export default function QueryColumnModal({
  open,
  onClose,
  liveCensus,
  onColumnReady,
}: Props) {
  const [question, setQuestion] = useState("");
  const [label, setLabel] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 80);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const q = question.trim();
    if (!q) return;
    setIsRunning(true);
    setError(null);

    const { results, error: err } = await runQueryColumnBatch(q, liveCensus);
    setIsRunning(false);

    if (err && results.size === 0) {
      setError(err);
      return;
    }

    const colLabel = label.trim() || (q.length > 32 ? q.slice(0, 29) + "…" : q);
    onColumnReady(colLabel, results);
    setQuestion("");
    setLabel("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[500px] rounded-2xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Score patients by clinical question
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Clinical Question
            </label>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Is this patient at high fall risk?"
              className="mt-1.5 w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
              rows={3}
              disabled={isRunning}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cortex will label every patient{" "}
              <span className="font-semibold text-red-600">YES</span>,{" "}
              <span className="font-semibold text-amber-600">POSSIBLE</span>,{" "}
              <span className="font-semibold text-emerald-600">NO</span>, or{" "}
              <span className="font-semibold text-muted-foreground">N/A</span>{" "}
              and add a ranked column to the table. Press{" "}
              <kbd className="rounded border border-border/80 bg-muted px-1 py-0.5 font-mono text-[10px]">
                ⌘ Enter
              </kbd>{" "}
              to run.
            </p>
          </div>

          {/* Optional label */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Column Label{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Auto-generated from question if blank"
              className="mt-1.5 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
              disabled={isRunning}
            />
          </div>

          {/* Example questions */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Example questions
            </p>
            <div className="space-y-1">
              {EXAMPLE_QUESTIONS.map((eq) => (
                <button
                  key={eq}
                  onClick={() => setQuestion(eq)}
                  disabled={isRunning}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <ChevronRight className="h-3 w-3 shrink-0 text-primary/60" />
                  {eq}
                </button>
              ))}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 px-5 py-3.5">
          <span className="text-[11px] text-muted-foreground">
            {liveCensus.length} patients will be scored
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isRunning}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!question.trim() || isRunning}
              className="gap-1.5"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Scoring {liveCensus.length} patients…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Score Patients
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
