import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  totalSteps: number;
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function StepIndicator({
  totalSteps,
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div
      className="flex items-center gap-2"
      role="tablist"
      aria-label="Onboarding steps"
    >
      {Array.from({ length: totalSteps }, (_, i) => (
        <button
          key={i}
          onClick={() => onStepClick(i)}
          className={cn(
            "h-2 rounded-full transition-all duration-500 ease-out",
            i === currentStep
              ? "w-8 bg-foreground"
              : i < currentStep
                ? "w-2 bg-foreground/30"
                : "w-2 bg-border hover:bg-muted-foreground/40",
          )}
          role="tab"
          aria-label={`Go to step ${i + 1}`}
          aria-selected={i === currentStep}
          aria-current={i === currentStep ? "step" : undefined}
        />
      ))}
    </div>
  );
}
