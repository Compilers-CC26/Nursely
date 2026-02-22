import React, {
  useRef,
  useMemo,
  useCallback,
  useState,
  useEffect,
} from "react";
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
  /** Optional sort accessor — used when the column data lives only in the render closure */
  sortValue?: (patient: Patient) => string | number;
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

const ROW_HEIGHT = 52;
const EXPAND_COL_W = 32;
const MIN_COL_W = 60;

function initialWidth(col: ColumnDef): number {
  if (col.width) {
    const m = col.width.match(/w-\[(\d+)px\]/);
    if (m) return parseInt(m[1], 10);
  }
  const defaults: Record<string, number> = {
    name: 190,
    mrn: 130,
    room: 95,
    diagnosis: 230,
    riskScore: 105,
  };
  return defaults[col.key] ?? 130;
}

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
  const visibleCols = useMemo(
    () => columns.filter((c) => c.visible),
    [columns],
  );

  // Column widths (px)
  const [colWidths, setColWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.key, initialWidth(c)])),
  );

  useEffect(() => {
    setColWidths((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const col of columns) {
        if (!(col.key in next)) {
          next[col.key] = initialWidth(col);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columns]);

  // Track container width so last column fills remaining space
  const [containerW, setContainerW] = useState(0);
  useEffect(() => {
    if (!parentRef.current) return;
    const ro = new ResizeObserver(([entry]) =>
      setContainerW(entry.contentRect.width),
    );
    ro.observe(parentRef.current);
    setContainerW(parentRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Drag-to-resize
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{
    key: string;
    startX: number;
    startW: number;
  } | null>(null);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, key: string) => {
      e.preventDefault();
      e.stopPropagation();
      dragState.current = {
        key,
        startX: e.clientX,
        startW: colWidths[key] ?? 120,
      };
      setIsDragging(true);
    },
    [colWidths],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const { key, startX, startW } = dragState.current;
      const newW = Math.max(MIN_COL_W, startW + (e.clientX - startX));
      setColWidths((prev) => ({ ...prev, [key]: newW }));
    };
    const onUp = () => {
      if (!dragState.current) return;
      dragState.current = null;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Last column stretches to fill container; all others are fixed px
  const lastCol = visibleCols[visibleCols.length - 1];
  const fixedW =
    EXPAND_COL_W +
    visibleCols.slice(0, -1).reduce((s, c) => s + (colWidths[c.key] ?? 120), 0);
  const lastColMinW = lastCol ? (colWidths[lastCol.key] ?? 120) : 0;
  const lastColW = lastCol ? Math.max(lastColMinW, containerW - fixedW) : 0;
  const totalW = fixedW + lastColW;

  const getColW = (col: ColumnDef) =>
    col.key === lastCol?.key ? lastColW : (colWidths[col.key] ?? 120);

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
      return (
        <ArrowUpDown className="ml-1 h-3 w-3 shrink-0 text-muted-foreground/50" />
      );
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 shrink-0 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 shrink-0 text-primary" />
    );
  };

  return (
    <>
      {/* Full-screen overlay during drag — captures all pointer events, prevents sidebar interaction */}
      {isDragging && (
        <div
          className="fixed inset-0 z-[9999] cursor-col-resize"
          style={{ userSelect: "none" }}
        />
      )}

      <div
        ref={parentRef}
        className="flex-1 overflow-auto rounded-lg border bg-white"
      >
        {/* Sticky header */}
        <div
          className="sticky top-0 z-10 flex border-b bg-muted/40 backdrop-blur"
          style={{ width: totalW, minWidth: "100%" }}
        >
          <div className="shrink-0" style={{ width: EXPAND_COL_W }} />
          {visibleCols.map((col) => (
            <div
              key={col.key}
              className="relative flex shrink-0 items-center"
              style={{ width: getColW(col) }}
            >
              <button
                onClick={() => onSort(col.key)}
                className="flex min-w-0 flex-1 items-center gap-0.5 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="truncate">{col.label}</span>
                <SortIcon colKey={col.key} />
              </button>
              {/* No drag handle on last column — it auto-fills */}
              {col.key !== lastCol?.key && (
                <div
                  onMouseDown={(e) => onResizeMouseDown(e, col.key)}
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none hover:bg-primary/20 active:bg-primary/30 transition-colors"
                />
              )}
            </div>
          ))}
        </div>

        {/* Virtualized rows */}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
            width: totalW,
            minWidth: "100%",
          }}
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
                  "absolute left-0 flex cursor-pointer items-center border-b transition-colors",
                  isSelected
                    ? "bg-primary/5 border-l-2 border-l-primary"
                    : "hover:bg-muted/30",
                )}
                style={{
                  width: totalW,
                  minWidth: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="flex shrink-0 items-center justify-center"
                  style={{ width: EXPAND_COL_W }}
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted-foreground/40 transition-transform",
                      isSelected && "rotate-90 text-primary",
                    )}
                  />
                </div>
                {visibleCols.map((col) => (
                  <div
                    key={col.key}
                    className={cn(
                      "shrink-0 truncate px-3 py-2 text-sm",
                      col.key === "name" && "font-medium text-foreground",
                    )}
                    style={{ width: getColW(col) }}
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
    </>
  );
}
