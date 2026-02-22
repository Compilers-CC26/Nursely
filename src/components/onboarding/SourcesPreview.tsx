import {
  BookOpen,
  ShieldCheck,
  FileText,
  ExternalLink,
} from "lucide-react";

const SOURCES = [
  {
    name: "CDC Clinical Guidelines",
    type: "Government",
    description:
      "Sepsis prevention and management protocols from the Centers for Disease Control and Prevention.",
    icon: ShieldCheck,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    name: "NIH Clinical Protocols",
    type: "Research",
    description:
      "Evidence-based treatment pathways and drug interaction data from the National Institutes of Health.",
    icon: BookOpen,
    color: "text-primary",
    bgColor: "bg-primary/5",
  },
  {
    name: "WHO Nursing Standards",
    type: "International",
    description:
      "Global nursing best practices, patient safety standards, and clinical assessment frameworks.",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
];

export function SourcesPreview() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Simulated response card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-foreground/5">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-5 py-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              className="text-primary"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <span className="text-sm font-medium text-foreground">
            AI Response
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            Verified sources
          </span>
        </div>

        {/* Answer preview */}
        <div className="border-b border-border px-5 py-4">
          <p className="text-sm leading-relaxed text-foreground">
            {"For a patient presenting with "}
            <strong>drug overdose</strong>
            {" and a risk score of 0.931, the recommended initial protocol includes airway management, naloxone administration if opioid-related, and continuous vital sign monitoring per "}
            <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-primary">
              CDC-2024-SP-0847
              <ExternalLink className="h-3 w-3" />
            </span>
            {". Ensure IV access and prepare for potential..."}
          </p>
        </div>

        {/* Sources grid */}
        <div className="bg-muted/20 px-5 py-4">
          <div className="mb-3 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Referenced Sources
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {SOURCES.map((source) => {
              const Icon = source.icon;
              return (
                <div
                  key={source.name}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3.5 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${source.bgColor}`}
                    >
                      <Icon className={`h-4 w-4 ${source.color}`} />
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Verified
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      {source.name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {source.type}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {source.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
