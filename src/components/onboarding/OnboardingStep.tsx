import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface OnboardingStepProps {
  stepNumber: number;
  label: string;
  title: string;
  description: string;
  isActive: boolean;
  direction: "left" | "right" | "none";
  children: ReactNode;
}

export function OnboardingStep({
  stepNumber,
  label,
  title,
  description,
  isActive,
  direction,
  children,
}: OnboardingStepProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto transition-all duration-500 ease-out",
        isActive
          ? "translate-x-0 opacity-100"
          : direction === "left"
            ? "-translate-x-full opacity-0 pointer-events-none"
            : "translate-x-full opacity-0 pointer-events-none",
      )}
      aria-hidden={!isActive}
    >
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-8">
        <div className="flex w-full max-w-5xl flex-col items-center gap-6">
          {/* Text content */}
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium tracking-wide text-primary uppercase">
              Step {stepNumber} &middot; {label}
            </span>
            <h1 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
              {title}
            </h1>
            <p className="max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground lg:text-base">
              {description}
            </p>
          </div>

          {/* Content */}
          <div className="w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}
