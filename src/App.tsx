import React, { useState, useMemo, useCallback, useEffect } from "react";
import PatientTable from "@/components/PatientTable";
import type { ColumnDef } from "@/components/PatientTable";
import AnalystPanel from "@/components/AnalystPanel";
import ChatPanel from "@/components/ChatPanel";
import ColumnPicker from "@/components/ColumnPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPatients, searchPatients } from "@/services/fhirMock";
import type { Patient } from "@/types";
import { cn } from "@/lib/utils";
import { Plus, Search } from "lucide-react";

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
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [sortKey, setSortKey] = useState("riskScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [queryColCount, setQueryColCount] = useState(0);
  const [rightTab, setRightTab] = useState<RightPanelTab>("analyst");

  // --- Data ---
  const filteredPatients = useMemo(() => {
    const base = debouncedQuery ? searchPatients(debouncedQuery) : listPatients();
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
  }, [debouncedQuery, sortKey, sortDir]);

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
    [sortKey]
  );

  const handleToggleColumn = useCallback((key: string) => {
    setColumns((cols) =>
      cols.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
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
      render: (p: Patient) => (p.riskScore * (0.85 + Math.random() * 0.1)).toFixed(3),
    };
    setColumns((cols) => [...cols, newCol]);
  }, [queryColCount]);

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient((prev) => (prev?.id === patient.id ? null : patient));
  }, []);

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* ═══ Header bar ═══ */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Search results
          </h1>
          <Badge variant="success" className="text-xs">
            Ready
          </Badge>
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
        {/* Left pane — 70% */}
        <div className="flex w-[70%] flex-col gap-3 p-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patients by name, diagnosis, MRN, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Patient table */}
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

        {/* Right pane — 30% with tabs */}
        <div className="flex w-[30%] flex-col border-l bg-white">
          {/* Tab bar */}
          <div className="flex border-b">
            <button
              onClick={() => setRightTab("analyst")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                rightTab === "analyst"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
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
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Chat
            </button>
          </div>
          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === "analyst" ? (
              <div className="h-full overflow-y-auto">
                <AnalystPanel selectedPatient={selectedPatient} />
              </div>
            ) : (
              <ChatPanel selectedPatient={selectedPatient} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
