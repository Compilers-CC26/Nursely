import React, { useState, useMemo, useCallback, useEffect } from "react";
import PatientTable from "@/components/PatientTable";
import type { ColumnDef } from "@/components/PatientTable";
import PatientDetailCard from "@/components/PatientDetailCard";
import AnalystPanel from "@/components/AnalystPanel";
import ChatPanel from "@/components/ChatPanel";
import ColumnPicker from "@/components/ColumnPicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listPatients, searchPatients } from "@/services/fhirMock";
import type { Patient } from "@/types";
import { cn } from "@/lib/utils";
import { Plus, Search, Activity, RefreshCw } from "lucide-react";
import nurselyLogo from "../assets/images/Nursely_Logo.svg";

type RightPanelTab = "analyst" | "chat";

// Default columns — matches screenshot layout
const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Patient", visible: true, width: "w-[200px]" },
  { key: "mrn", label: "MRN", visible: true, width: "w-[120px]" },
  { key: "diagnosis", label: "Diagnosis", visible: true, width: "w-[160px]" },
  { key: "summary", label: "Summary", visible: true },
  { key: "riskScore", label: "Risk Score", visible: true, width: "w-[110px]" },
  { key: "age", label: "Age", visible: false, width: "w-[70px]" },
  { key: "sex", label: "Sex", visible: false, width: "w-[60px]" },
  { key: "room", label: "Room", visible: false, width: "w-[90px]" },
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
  const [queryColCount, setQueryColCount] = useState(0);
  const [rightTab, setRightTab] = useState<RightPanelTab>("analyst");
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
  }, [liveCensus, debouncedQuery, sortKey, sortDir]);

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

  const handleAddQueryColumn = useCallback(() => {
    const n = queryColCount + 1;
    setQueryColCount(n);
    const newCol: ColumnDef = {
      key: `query_${n}`,
      label: `Query ${n + 1} Score`,
      visible: true,
      width: "w-[120px]",
      render: (p: Patient) =>
        (p.riskScore * (0.85 + Math.random() * 0.1)).toFixed(3),
    };
    setColumns((cols) => [...cols, newCol]);
  }, [queryColCount]);

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

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* ═══ Header bar ═══ */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-6">
        <div className="flex items-center gap-3">
          <img src={nurselyLogo} alt="Nursely" className="h-14 mt-2 ml-4" />
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
            onClick={handleAddQueryColumn}
          >
            <Plus className="h-4 w-4" />
            Add query column
          </Button>
          <ColumnPicker columns={columns} onToggle={handleToggleColumn} />
        </div>
      </header>

      {/* ═══ Main content: table + analyst panel ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane — 70% bubbled card */}
        <div className="w-[70%] p-6">
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

        {/* Right pane — 30% floating bubbled card */}
        <div className="w-[28%] p-6">
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
                  onPendingMessageConsumed={() => setPendingChatMessage(null)}
                  onSearchUpdate={handleSearchFromChat}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
