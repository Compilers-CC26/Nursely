import React, { useState, useMemo, useCallback, useEffect } from "react";
import PatientTable from "@/components/PatientTable";
import type { ColumnDef } from "@/components/PatientTable";
import PatientDetailCard from "@/components/PatientDetailCard";
import AnalystPanel from "@/components/AnalystPanel";
import ChatPanel from "@/components/ChatPanel";
import ColumnPicker from "@/components/ColumnPicker";
import QueryColumnModal from "@/components/QueryColumnModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listPatients, searchPatients } from "@/services/fhirMock";
import type { Patient } from "@/types";
import type { FilterCommand } from "@/services/chatMock";
import {
  ANTIBIOTIC_KEYWORDS,
  FALL_RISK_MED_KEYWORDS,
} from "@/services/chatMock";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { TableProperties, Search, Activity, RefreshCw } from "lucide-react";
import nurselyLogo from "../assets/images/Nursely_Logo.svg";

type RightPanelTab = "analyst" | "chat";

// Default columns
const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Patient", visible: true, width: "w-[185px]" },
  { key: "mrn", label: "MRN", visible: true, width: "w-[125px]" },
  { key: "room", label: "Room", visible: true, width: "w-[85px]" },
  {
    key: "diagnosis",
    label: "Diagnosis",
    visible: true,
    // flex-1 — takes all remaining width so text is never clipped
    render: (p: Patient) => {
      const dx = p.diagnosis;
      const empty = !dx || /no active|unknown|undocumented/i.test(dx);
      return empty ? (
        <span className="text-muted-foreground/50 text-xs italic">
          No conditions
        </span>
      ) : (
        <span className="text-foreground">{dx}</span>
      );
    },
  },
  {
    key: "riskScore",
    label: "Risk Score",
    visible: true,
    width: "w-[105px]",
    render: (p: Patient) => {
      const s = p.riskScore;
      const cls =
        s > 0.65
          ? "bg-red-50 text-red-700 border-red-200"
          : s > 0.4
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200";
      return (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
            cls,
          )}
        >
          {s.toFixed(3)}
        </span>
      );
    },
  },
  { key: "summary", label: "Summary", visible: false },
  { key: "age", label: "Age", visible: false, width: "w-[70px]" },
  { key: "sex", label: "Sex", visible: false, width: "w-[60px]" },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function App() {
  // --- State ---
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [detailPatient, setDetailPatient] = useState<Patient | null>(null);
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [sortKey, setSortKey] = useState("riskScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCommand | null>(null);
  const [rightTab, setRightTab] = useState<RightPanelTab>("analyst");
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(
    null,
  );

  // Data State
  const [liveCensus, setLiveCensus] = useState<Patient[]>([]);
  const [censusStatus, setCensusStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  // Sync State
  const [preseedStatus, setPreseedStatus] = useState<
    "idle" | "syncing" | "done" | "error"
  >("idle");
  const [preseedProgress, setPreseedProgress] = useState({
    synced: 0,
    total: 0,
  });

  // --- Effects ---
  // 1. Fetch live census on launch, then 2. Pre-seed Snowflake
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.fhir?.getCensus) {
      setCensusStatus("loading");

      // Subscribe to progressive updates before calling getCensus
      if (window.electronAPI.fhir.onPatientUpdate) {
        unsubscribe = window.electronAPI.fhir.onPatientUpdate(
          (patient: Patient) => {
            setCensusStatus("ready"); // Show table as soon as one patient is available
            setLiveCensus((prev) => {
              // Check if patient already exists (e.g. from an earlier partial load)
              const exists = prev.some((p) => p.id === patient.id);
              if (exists) {
                return prev.map((p) => (p.id === patient.id ? patient : p));
              }
              // Append and maintain risk score sorting
              const next = [...prev, patient];
              return next.sort((a, b) => b.riskScore - a.riskScore);
            });
          },
        );
      }

      window.electronAPI.fhir
        .getCensus()
        .then((res) => {
          if (res.success && res.census) {
            setLiveCensus(res.census);
            setCensusStatus("ready");

            // Now that we have the census, start the background Snowflake sync
            if (window.electronAPI?.snowflake?.preseedCohort) {
              setPreseedStatus("syncing");
              const patientIds = res.census.map((p: Patient) => p.id);
              setPreseedProgress({ synced: 0, total: patientIds.length });

              window.electronAPI.snowflake
                .preseedCohort(patientIds)
                .then((syncRes) => {
                  if (syncRes.success) {
                    setPreseedStatus("done");
                    setPreseedProgress({
                      synced: syncRes.synced,
                      total: syncRes.total,
                    });
                  } else {
                    setPreseedStatus("error");
                  }
                })
                .catch(() => setPreseedStatus("error"));
            }
          } else {
            console.warn("Failed to get live census, using mock fallback.");
            setLiveCensus(listPatients());
            setCensusStatus("ready");
          }
        })
        .catch(() => {
          setLiveCensus(listPatients());
          setCensusStatus("ready");
        });
    } else {
      // Browser environment fallback
      setLiveCensus(listPatients());
      setCensusStatus("ready");
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // --- Data ---
  const filteredPatients = useMemo(() => {
    let base = liveCensus;
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      base = base.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.mrn.toLowerCase().includes(q) ||
          p.diagnosis.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q) ||
          p.notes.some((n) => n.toLowerCase().includes(q)),
      );
    }
    // Chat-driven filter applied on top of text search
    if (activeFilter) {
      switch (activeFilter.type) {
        case "risk":
          base = base.filter(
            (p) =>
              (activeFilter.riskMin == null ||
                p.riskScore >= activeFilter.riskMin) &&
              (activeFilter.riskMax == null ||
                p.riskScore <= activeFilter.riskMax),
          );
          break;
        case "flag":
          base = base.filter((p) => {
            const meds = p.meds.map((m) => m.toLowerCase());
            if (activeFilter.flag === "antibiotics")
              return meds.some((m) =>
                ANTIBIOTIC_KEYWORDS.some((kw) => m.includes(kw)),
              );
            if (activeFilter.flag === "fall-risk")
              return meds.some((m) =>
                FALL_RISK_MED_KEYWORDS.some((kw) => m.includes(kw)),
              );
            if (activeFilter.flag === "critical-labs")
              return p.labs.some((l) => l.flag === "critical");
            if (activeFilter.flag === "high-risk") return p.riskScore > 0.65;
            return true;
          });
          break;
        case "search":
          if (activeFilter.text) {
            const q = activeFilter.text.toLowerCase();
            base = base.filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                p.diagnosis.toLowerCase().includes(q) ||
                p.summary.toLowerCase().includes(q) ||
                p.meds.some((m) => m.toLowerCase().includes(q)),
            );
          }
          break;
        // 'clear' type: no filtering, just reset (handled by setActiveFilter(null))
      }
    }
    return [...base].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [liveCensus, debouncedQuery, sortKey, sortDir, activeFilter]);

  // --- Handlers ---
  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey],
  );

  const handleToggleColumn = useCallback((key: string) => {
    setColumns((cols) =>
      cols.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)),
    );
  }, []);

  const handleQueryColumnReady = useCallback(
    (label: string, results: Map<string, string>) => {
      const id = `query_${Date.now()}`;
      const LABEL_COLORS: Record<string, string> = {
        YES: "bg-red-50 text-red-700 border-red-200",
        POSSIBLE: "bg-amber-50 text-amber-700 border-amber-200",
        NO: "bg-emerald-50 text-emerald-700 border-emerald-200",
        HIGH: "bg-red-50 text-red-700 border-red-200",
        MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
        LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
      const newCol: ColumnDef = {
        key: id,
        label,
        visible: true,
        width: "w-[90px]",
        render: (p: Patient) => {
          const rawLabel = results.get(p.name);
          if (!rawLabel)
            return <span className="text-muted-foreground/40 text-xs">—</span>;
          const upper = rawLabel.toUpperCase();
          const cls =
            LABEL_COLORS[upper] ??
            "bg-muted/30 text-muted-foreground border-border/50";
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                cls,
              )}
            >
              {rawLabel}
            </span>
          );
        },
      };
      setColumns((cols) => [...cols, newCol]);
    },
    [],
  );

  const handleApplyFilter = useCallback((filter: FilterCommand | null) => {
    setActiveFilter(filter?.type === "clear" ? null : filter);
  }, []);

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setDetailPatient(patient);
  }, []);

  const handleBackToTable = useCallback(() => {
    setDetailPatient(null);
    setSelectedPatient(null);
  }, []);

  // Cross-panel navigation: switch to Chat tab with a pre-filled message
  const switchToChat = useCallback((message?: string) => {
    if (message) setPendingChatMessage(message);
    setRightTab("chat");
  }, []);

  // Chat can update the search query to filter the table
  const handleSearchFromChat = useCallback((query: string) => {
    setSearchQuery(query);
    setRightTab("analyst");
  }, []);

  // Refresh a single patient's clinical data from Snowflake/BFF
  const refreshPatient = useCallback(
    async (patientId: string) => {
      if (!window.electronAPI?.fhir?.getPatient) return;

      try {
        const { getPatientDetail } = await import("@/services/fhirMock");
        const freshPatient = await getPatientDetail(patientId);

        if (freshPatient) {
          setLiveCensus((prev) =>
            prev.map((p) =>
              p.id === patientId ? { ...p, ...freshPatient } : p,
            ),
          );
          // If this patient is currently selected/detailed, update them too
          if (selectedPatient?.id === patientId) {
            setSelectedPatient((prev) =>
              prev ? { ...prev, ...freshPatient } : freshPatient,
            );
          }
          if (detailPatient?.id === patientId) {
            setDetailPatient((prev) =>
              prev ? { ...prev, ...freshPatient } : freshPatient,
            );
          }
          console.log(`[UI] Refresh complete for patient ${patientId}`);
        }
      } catch (err) {
        console.warn(`[UI] Failed to refresh patient ${patientId}:`, err);
      }
    },
    [selectedPatient?.id, detailPatient?.id],
  );

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {showSplash ? (
        <motion.div
          key="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <LoadingAnimation onComplete={() => setShowSplash(false)} />
        </motion.div>
      ) : showOnboarding ? (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <OnboardingFlow onComplete={handleOnboardingComplete} />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex h-screen flex-col bg-muted/30"
        >
          {/* ═══ Header bar ═══ */}
          <header className="flex items-center justify-between border-b bg-white px-5 py-2.5">
            <div className="flex items-center gap-3">
              <img src={nurselyLogo} alt="Nursely" className="h-9" />
              {censusStatus === "loading" ? (
                <Badge
                  variant="outline"
                  className="text-xs text-muted-foreground animate-pulse"
                >
                  <RefreshCw className="mr-1 h-3 w-3 animate-spin inline" />
                  Loading FHIR Census...
                </Badge>
              ) : (
                <Badge variant="success" className="text-xs">
                  Live Census
                </Badge>
              )}

              {preseedStatus === "syncing" && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-[10px] font-medium text-amber-700 animate-pulse">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  Pre-seeding Snowflake ({preseedProgress.synced}/
                  {preseedProgress.total})
                </div>
              )}
              {preseedStatus === "done" && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-medium text-emerald-700">
                  <Activity className="h-2.5 w-2.5" />
                  Snowflake DB hydrated
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                {filteredPatients.length.toLocaleString()} results
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setQueryModalOpen(true)}
              >
                <TableProperties className="h-4 w-4" />
                Add Smart Column
              </Button>
              <ColumnPicker columns={columns} onToggle={handleToggleColumn} />
            </div>
          </header>

          {/* Query column modal */}
          <QueryColumnModal
            open={queryModalOpen}
            onClose={() => setQueryModalOpen(false)}
            liveCensus={liveCensus}
            onColumnReady={handleQueryColumnReady}
          />

          {/* ═══ Main content: table + analyst panel ═══ */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left pane */}
            <div className="flex-1 min-w-0 p-4">
              <div className="relative h-full rounded-2xl border border-border/50 bg-card shadow-lg overflow-hidden">
                {/* Layer 1 — Table view */}
                <div
                  className={cn(
                    "crossfade-layer flex flex-col gap-3 p-4",
                    detailPatient && "hidden-layer",
                  )}
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search patients by name, diagnosis, MRN, or notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <PatientTable
                    patients={filteredPatients}
                    columns={columns}
                    selectedId={selectedPatient?.id ?? null}
                    onSelect={handleSelectPatient}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </div>
                {/* Layer 2 — Patient detail card */}
                <div
                  className={cn(
                    "crossfade-layer",
                    !detailPatient && "hidden-layer",
                  )}
                >
                  {detailPatient && (
                    <PatientDetailCard
                      patient={detailPatient}
                      onBack={handleBackToTable}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right pane */}
            <div className="w-[460px] shrink-0 p-4">
              <div className="flex h-full flex-col rounded-2xl border border-border/50 bg-card shadow-lg">
                {/* Tab bar */}
                <div className="flex border-b border-border/50 rounded-t-2xl overflow-hidden">
                  <button
                    onClick={() => setRightTab("analyst")}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                      rightTab === "analyst"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Analyst
                  </button>
                  <button
                    onClick={() => setRightTab("chat")}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                      rightTab === "chat"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Chat
                  </button>
                </div>
                {/* Tab content */}
                <div className="flex-1 overflow-hidden">
                  {rightTab === "analyst" ? (
                    <div className="h-full overflow-y-auto">
                      <AnalystPanel
                        selectedPatient={selectedPatient}
                        searchQuery={debouncedQuery}
                        onSwitchToChat={switchToChat}
                        liveCensus={liveCensus}
                        onSyncComplete={refreshPatient}
                      />
                    </div>
                  ) : (
                    <ChatPanel
                      selectedPatient={selectedPatient}
                      liveCensus={liveCensus}
                      pendingMessage={pendingChatMessage}
                      onPendingMessageConsumed={() =>
                        setPendingChatMessage(null)
                      }
                      onSearchUpdate={handleSearchFromChat}
                      activeFilter={activeFilter}
                      onApplyFilter={handleApplyFilter}
                      onSelectPatient={handleSelectPatient}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
