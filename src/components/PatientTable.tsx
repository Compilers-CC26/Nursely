import React, { useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Patient } from "@/types";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
  width?: string;
  render?: (patient: Patient) => React.ReactNode;
}

interface PatientTableProps {
  patients: Patient[];
  columns: ColumnDef[];
  selectedId: string | null;
  onSelect: (patient: Patient) => void;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}

const ROW_HEIGHT = 64;

export default function PatientTable({
  patients,
  columns,
  selectedId,
  onSelect,
  sortKey,
  sortDir,
  onSort,
}: PatientTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const visibleCols = useMemo(() => columns.filter((c) => c.visible), [columns]);

  const virtualizer = useVirtualizer({
    count: patients.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const getCellValue = useCallback((patient: Patient, col: ColumnDef) => {
    if (col.render) return col.render(patient);
    const val = (patient as any)[col.key];
    if (col.key === "riskScore") return (val as number).toFixed(3);
    return val ?? "—";
  }, []);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey)
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />
    );
  };

  return (
    <div ref={parentRef} className="flex-1 overflow-auto rounded-lg border bg-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex border-b bg-muted/40 backdrop-blur">
        {/* Row expand indicator column */}
        <div className="flex w-8 shrink-0 items-center justify-center" />
        {visibleCols.map((col) => (
          <button
            key={col.key}
            onClick={() => onSort(col.key)}
            className={cn(
              "flex items-center gap-0.5 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors",
              col.width ?? "flex-1"
            )}
          >
            {col.label}
            <SortIcon colKey={col.key} />
          </button>
        ))}
      </div>

      {/* Virtualized rows */}
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const patient = patients[virtualRow.index];
          const isSelected = patient.id === selectedId;
          return (
            <div
              key={patient.id}
              role="row"
              tabIndex={0}
              onClick={() => onSelect(patient)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(patient);
              }}
              className={cn(
                "absolute left-0 right-0 flex cursor-pointer items-center border-b transition-colors",
                isSelected
                  ? "bg-primary/5 border-l-2 border-l-primary"
                  : "hover:bg-muted/30"
              )}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* Expand indicator */}
              <div className="flex w-8 shrink-0 items-center justify-center">
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-muted-foreground/40 transition-transform",
                    isSelected && "rotate-90 text-primary"
                  )}
                />
              </div>
              {visibleCols.map((col) => (
                <div
                  key={col.key}
                  className={cn(
                    "truncate px-4 py-2 text-sm",
                    col.width ?? "flex-1",
                    col.key === "name" && "font-medium text-foreground",
                    col.key === "riskScore" && "font-mono tabular-nums"
                  )}
                  title={String((patient as any)[col.key] ?? "")}
                >
                  {getCellValue(patient, col)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {patients.length === 0 && (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          No patients match your search.
        </div>
      )}
    </div>
  );
}
