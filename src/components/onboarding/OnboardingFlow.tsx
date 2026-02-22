import { useState, useCallback } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "./StepIndicator";
import { OnboardingStep } from "./OnboardingStep";
import { ScreenshotFrame } from "./ScreenshotFrame";
import { SourcesPreview } from "./SourcesPreview";
import nurselyLogo from "../../../assets/images/Nursely_Logo.svg";

const TOTAL_PAGES = 4;

const FEATURE_STEPS = [
  {
    label: "Patients",
    title: "Your entire census, one glance",
    description:
      "View every patient on your unit with real-time risk scores, diagnoses, room assignments, and vitals — all synced from your facility's database.",
  },
  {
    label: "AI Chat",
    title: "Ask questions, get real answers",
    description:
      "Chat with an AI assistant that knows your patients. Ask about medications, protocols, assessments, or have it write an SBAR — all grounded in actual patient data.",
  },
  {
    label: "Sources",
    title: "Backed by official guidelines",
    description:
      "Every AI response is grounded in evidence from CDC, NIH, WHO, and peer-reviewed clinical protocols — so you can trust what you read.",
  },
] as const;

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | "none">(
    "none",
  );

  const goToStep = useCallback(
    (step: number) => {
      if (step === currentStep) return;
      setDirection(step > currentStep ? "right" : "left");
      setCurrentStep(step);
    },
    [currentStep],
  );

  const nextStep = useCallback(() => {
    if (currentStep < TOTAL_PAGES - 1) {
      setDirection("right");
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  }, [currentStep, onComplete]);

  const isWelcome = currentStep === 0;
  const isLastStep = currentStep === TOTAL_PAGES - 1;

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header - hidden on welcome page */}
      <header
        className={cn(
          "flex flex-shrink-0 items-center justify-between px-8 py-4 transition-all duration-500",
          isWelcome ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <div className="flex items-center gap-2">
          <img
            src={nurselyLogo}
            alt="Nursely logo"
            className="h-8 w-auto object-contain"
          />
        </div>
        <button
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={onComplete}
        >
          Skip
        </button>
      </header>

      {/* Main content area */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {/* Welcome page (step 0) */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out",
            currentStep === 0
              ? "translate-x-0 opacity-100"
              : "-translate-x-full opacity-0 pointer-events-none",
          )}
          aria-hidden={currentStep !== 0}
        >
          <div className="flex flex-col items-center gap-8 px-6 text-center">
            <img
              src={nurselyLogo}
              alt="Nursely logo"
              className="h-20 w-auto object-contain"
            />
            <div className="flex flex-col items-center gap-4">
              <h1 className="max-w-lg text-balance text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
                Your AI-powered nursing assistant
              </h1>
              <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground lg:text-lg">
                Access patient data, get clinical guidance, and find trusted
                medical information — all in one place.
              </p>
            </div>
            <Button
              onClick={nextStep}
              size="lg"
              className="mt-2 gap-2 rounded-full bg-foreground px-8 py-6 text-base font-medium text-background hover:bg-foreground/90"
            >
              Take a quick tour
              <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={onComplete}
            >
              Skip intro
            </button>
          </div>
        </div>

        {/* Feature steps (steps 1-3) */}
        {FEATURE_STEPS.map((step, index) => {
          const pageIndex = index + 1;
          const stepDirection =
            pageIndex === currentStep
              ? "none"
              : pageIndex < currentStep
                ? "left"
                : "right";

          return (
            <OnboardingStep
              key={index}
              stepNumber={index + 1}
              label={step.label}
              title={step.title}
              description={step.description}
              isActive={pageIndex === currentStep}
              direction={stepDirection}
            >
              {index === 0 && (
                <ScreenshotFrame
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-02-22%20at%209.37.04%E2%80%AFAM-Usk6Feh68IqgrCsEB3I8qJXClarRCc.png"
                  alt="Nursely patient census view showing a table of patients with names, MRN numbers, room assignments, diagnoses, and risk scores alongside an AI chat panel"
                />
              )}
              {index === 1 && (
                <div className="mx-auto flex w-full max-w-4xl gap-4">
                  <div className="flex-1">
                    <ScreenshotFrame
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-02-22%20at%209.37.13%E2%80%AFAM-Rbxyo7OjcVejwfGmp7wzMyp5X6jLIK.png"
                      alt="Nursely patient detail view showing diagnosis, vitals, lab results, and medications"
                    />
                  </div>
                  <div className="hidden w-72 flex-shrink-0 lg:block">
                    <ChatPreview />
                  </div>
                </div>
              )}
              {index === 2 && <SourcesPreview />}
            </OnboardingStep>
          );
        })}
      </main>

      {/* Footer - hidden on welcome page */}
      <footer
        className={cn(
          "flex flex-shrink-0 items-center justify-between border-t border-border px-8 py-5 transition-all duration-500",
          isWelcome
            ? "pointer-events-none translate-y-full opacity-0"
            : "translate-y-0 opacity-100",
        )}
      >
        <StepIndicator
          totalSteps={TOTAL_PAGES - 1}
          currentStep={currentStep - 1}
          onStepClick={(step) => goToStep(step + 1)}
        />
        <Button
          onClick={nextStep}
          size="lg"
          className="gap-2 rounded-full bg-foreground px-7 font-medium text-background hover:bg-foreground/90"
        >
          {isLastStep ? (
            <>
              Get Started
              <Check className="h-4 w-4" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </footer>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-foreground/5">
      {/* Chat header tabs */}
      <div className="flex border-b border-border">
        <div className="flex-1 px-4 py-3 text-center text-sm text-muted-foreground">
          Analyst
        </div>
        <div className="flex-1 border-b-2 border-primary px-4 py-3 text-center text-sm font-medium text-primary">
          Chat
        </div>
      </div>

      {/* Chat content */}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Nurse Assistant
          </h3>
          <p className="text-xs text-muted-foreground">
            Context: Tressa Bergstrom
          </p>
        </div>

        {/* AI Message */}
        <div className="flex gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xs leading-relaxed text-foreground">
            {"Hi! I'm your "}
            <strong>Nurse Analyst assistant</strong>
            {". I can help with clinical protocols, medication questions, patient assessments, SBAR reports, and more."}
          </p>
        </div>

        {/* Quick prompts */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Quick Prompts
          </span>
          {[
            "What should I watch for with Drug overdose?",
            "Any medication interactions?",
            "Help me write an SBAR",
          ].map((prompt) => (
            <div
              key={prompt}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
            >
              {prompt}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
