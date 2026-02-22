import React from "react";
import type { Patient, Lab } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Activity,
  Pill,
  AlertTriangle,
  FileText,
  FlaskConical,
} from "lucide-react";

interface PatientDetailCardProps {
  patient: Patient;
  onBack: () => void;
}

const FLAG_STYLES: Record<Lab["flag"], string> = {
  normal: "bg-emerald-100 text-emerald-700",
  high: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
  critical: "bg-red-100 text-red-700",
};

function VitalCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null;
  unit: string;
}) {
  const isMissing = value === null || value === undefined || value === 0 || value === "null/null";

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border px-4 py-3 transition-opacity",
      isMissing ? "bg-muted/10 opacity-50" : "bg-muted/30"
    )}>
      <Icon className={cn("h-5 w-5 shrink-0", isMissing ? "text-muted-foreground" : "text-primary/70")} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums">
          {isMissing ? "N/A" : value} {!isMissing && <span className="font-normal text-muted-foreground">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

export default function PatientDetailCard({ patient, onBack }: PatientDetailCardProps) {
  const { vitals } = patient;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 border-b px-6 py-5">
        <Button variant="ghost" size="sm" className="mt-0.5 -ml-2 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h2 className="truncate text-xl font-semibold">{patient.name}</h2>
            <Badge variant={patient.riskScore >= 0.7 ? "destructive" : patient.riskScore >= 0.4 ? "default" : "success"}>
              Risk {patient.riskScore.toFixed(3)}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{patient.age}y {patient.sex}</span>
            <span>MRN {patient.mrn}</span>
            <span>Room {patient.room}</span>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Diagnosis & Summary */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Diagnosis
          </h3>
          <Badge variant="outline" className="mb-2">{patient.diagnosis}</Badge>
          <p className="text-sm leading-relaxed text-foreground/80">{patient.summary}</p>
        </section>

        {/* Vitals */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vitals
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <VitalCard icon={Heart} label="Heart Rate" value={vitals.hr} unit="bpm" />
            <VitalCard
              icon={Activity}
              label="Blood Pressure"
              value={vitals.bpSys && vitals.bpDia ? `${vitals.bpSys}/${vitals.bpDia}` : null}
              unit="mmHg"
            />
            <VitalCard icon={Wind} label="Resp. Rate" value={vitals.rr} unit="/min" />
            <VitalCard
              icon={Thermometer}
              label="Temperature"
              value={vitals.temp !== null ? vitals.temp.toFixed(1) : null}
              unit="°F"
            />
            <VitalCard icon={Droplets} label="SpO2" value={vitals.spo2} unit="%" />
          </div>
          {vitals.timestamp && (
            <p className="mt-2 text-xs text-muted-foreground">
              Recorded {new Date(vitals.timestamp).toLocaleString()}
            </p>
          )}
        </section>

        {/* Labs */}
        {patient.labs.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" /> Labs
            </h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left font-semibold">Test</th>
                    <th className="px-3 py-2 text-left font-semibold">Value</th>
                    <th className="px-3 py-2 text-left font-semibold">Unit</th>
                    <th className="px-3 py-2 text-left font-semibold">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.labs.map((lab, i) => (
                    <tr key={i} className={cn("border-b last:border-b-0", i % 2 === 0 ? "bg-white" : "bg-muted/20")}>
                      <td className="px-3 py-2 font-medium">{lab.name}</td>
                      <td className="px-3 py-2 tabular-nums">{lab.value}</td>
                      <td className="px-3 py-2 text-muted-foreground">{lab.unit}</td>
                      <td className="px-3 py-2">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", FLAG_STYLES[lab.flag])}>
                          {lab.flag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Medications */}
        {patient.meds.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Pill className="h-3.5 w-3.5" /> Medications
            </h3>
            <div className="flex flex-wrap gap-2">
              {patient.meds.map((med, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{med}</Badge>
              ))}
            </div>
          </section>
        )}

        {/* Allergies */}
        {patient.allergies.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Allergies
            </h3>
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((allergy, i) => (
                <Badge key={i} variant="destructive" className="text-xs">{allergy}</Badge>
              ))}
            </div>
          </section>
        )}

        {/* Notes */}
        {patient.notes.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Notes
            </h3>
            <ul className="space-y-2">
              {patient.notes.map((note, i) => (
                <li key={i} className="rounded-lg border bg-muted/20 px-4 py-3 text-sm leading-relaxed">
                  {note}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
