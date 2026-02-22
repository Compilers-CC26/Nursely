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
import { listPatients } from "@/services/fhirMock";
import type { Patient } from "@/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
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
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setAuthError(error.message);
      }
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: subscriptionData } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setAuthLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscriptionData.subscription.unsubscribe();
    };
  }, []);

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
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(null);

  // Data State
  const [liveCensus, setLiveCensus] = useState<Patient[]>([]);
  const [censusStatus, setCensusStatus] = useState<"loading" | "ready" | "error">("loading");

  // Sync State
  const [preseedStatus, setPreseedStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [preseedProgress, setPreseedProgress] = useState({ synced: 0, total: 0 });

  // --- Effects ---
  // 1. Fetch live census on launch, then 2. Pre-seed Snowflake
  useEffect(() => {
    if (window.electronAPI?.fhir?.getCensus) {
      setCensusStatus("loading");
      window.electronAPI.fhir.getCensus()
        .then((res) => {
          if (res.success && res.census) {
            setLiveCensus(res.census);
            setCensusStatus("ready");

            // Now that we have the census, start the background Snowflake sync
            if (window.electronAPI?.snowflake?.preseedCohort) {
              setPreseedStatus("syncing");
              const patientIds = res.census.map((p: Patient) => p.id);
              setPreseedProgress({ synced: 0, total: patientIds.length });

              window.electronAPI.snowflake.preseedCohort(patientIds)
                .then((syncRes) => {
                  if (syncRes.success) {
                    setPreseedStatus("done");
                    setPreseedProgress({ synced: syncRes.synced, total: syncRes.total });
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
  }, []);

  // --- Data ---
  const filteredPatients = useMemo(() => {
    let base = liveCensus;
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      base = base.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.diagnosis.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.notes.some(n => n.toLowerCase().includes(q))
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
    setSelectedPatient(patient);
    setDetailPatient(patient);
  }, []);

  const handleBackToTable = useCallback(() => {
    setDetailPatient(null);
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

  const handleSignIn = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setAuthError(null);
      setAuthMessage(null);
      setAuthBusy(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message);
      }
      setAuthBusy(false);
    },
    [authEmail, authPassword]
  );

  const handleSignUp = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setAuthError(null);
      setAuthMessage(null);
      setAuthBusy(true);

      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message);
      } else if (data.session) {
        setAuthMessage("Account created. You are now signed in.");
      } else {
        setAuthMessage("Account created. Check your email to confirm your account.");
      }
      setAuthBusy(false);
    },
    [authEmail, authPassword]
  );

  const handleOAuthSignIn = useCallback(async (provider: "google" | "azure") => {
    setAuthError(null);
    setAuthMessage(null);
    setAuthBusy(true);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { skipBrowserRedirect: true },
    });

    if (error) {
      setAuthError(error.message);
      setAuthBusy(false);
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
      return;
    }

    setAuthError("OAuth sign-in could not be started.");
    setAuthBusy(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthError(null);
    setAuthMessage(null);
    setAuthBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthEmail("");
      setAuthPassword("");
      setAuthMode("signin");
    }
    setAuthBusy(false);
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground">Checking authentication...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen grid lg:grid-cols-2 bg-white">
        <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-950 to-neutral-900 p-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
          <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative z-10 w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl backdrop-blur-xl">
            <div className="mb-8 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold">
                N
              </div>
              <div>
                <p className="text-xl font-semibold">Nursely Analyst</p>
                <p className="text-sm text-white/70">Clinical citations assistant</p>
              </div>
            </div>

            <div className="mb-8 max-w-[300px] rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/90">
              Safe IV potassium rate?
            </div>
            <div className="mb-8 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-white/75">
                Includes dosing range
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-white/75">
                Notes renal impairment
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-white/75">
                Cites primary sources
              </span>
            </div>

            <div className="mb-6 h-px bg-white/15" />

            <div className="mb-8 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/70">
                Evidence-backed citations
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/70">
                Dose ranges + contraindications
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/70">
                High-risk medication flags
              </span>
            </div>

            <p className="text-sm text-white/75">
              Evidence-backed answers for bedside decisions.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 lg:p-12">
          <form
            onSubmit={authMode === "signin" ? handleSignIn : handleSignUp}
            className="w-full max-w-md space-y-6"
          >
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {authMode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {authMode === "signin"
                  ? "Sign in to your account to continue."
                  : "Start using Nursely in minutes."}
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-lg justify-start gap-3 px-4 text-[15px] disabled:opacity-100"
                onClick={() => handleOAuthSignIn("google")}
                disabled={authBusy}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                  >
                    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4A9.6 9.6 0 0 0 2.4 12 9.6 9.6 0 0 0 12 21.6c5.5 0 9.2-3.9 9.2-9.3 0-.6-.1-1.1-.2-1.5H12z" />
                    <path fill="#34A853" d="M2.4 7.8l3.2 2.3C6.4 8 9 6 12 6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 8.3 2.4 5 4.5 3.4 7.6z" />
                    <path fill="#FBBC05" d="M12 21.6c2.6 0 4.9-.9 6.5-2.5l-3-2.5c-.8.6-1.9 1-3.5 1-3 0-5.6-2-6.5-4.8l-3.3 2.5A9.6 9.6 0 0 0 12 21.6z" />
                    <path fill="#4285F4" d="M21.2 12.3c0-.6-.1-1.1-.2-1.5H12v3.9h5.5c-.3 1-1 2-2 2.7l3 2.5c1.8-1.7 2.7-4.2 2.7-7.6z" />
                  </svg>
                </span>
                Continue with Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-lg justify-start gap-3 px-4 text-[15px] disabled:opacity-100"
                onClick={() => handleOAuthSignIn("azure")}
                disabled={authBusy}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                  >
                    <path fill="#0078D4" d="M1.5 4.5 9.4 3v8.6H1.5V4.5Zm0 15 7.9 1.5v-8.3H1.5v6.8Zm8.8 1.7 12.2 1.8v-10h-12.2v8.2Zm0-18.4v8.8h12.2V1L10.3 2.8Z"/>
                  </svg>
                </span>
                Continue with Outlook
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {authMode === "signin" ? "or continue with email" : "or sign up with email"}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="auth-email" className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="you@company.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="h-11 rounded-lg border bg-slate-50 transition focus-visible:ring-2 focus-visible:ring-blue-500/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="auth-password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="Enter your password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="h-11 rounded-lg border bg-slate-50 transition focus-visible:ring-2 focus-visible:ring-blue-500/20"
                  required
                />
              </div>
            </div>

            {authError && <div className="text-sm text-red-600">{authError}</div>}
            {authMessage && <div className="text-sm text-emerald-700">{authMessage}</div>}

            <Button
              type="submit"
              className="h-11 w-full rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
              disabled={authBusy}
            >
              {authBusy
                ? authMode === "signin"
                  ? "Signing in..."
                  : "Creating account..."
                : authMode === "signin"
                  ? "Sign in ->"
                  : "Create account ->"}
            </Button>

            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={authBusy}
              onClick={() => {
                setAuthMode((mode) => (mode === "signin" ? "signup" : "signin"));
                setAuthError(null);
                setAuthMessage(null);
              }}
            >
              {authMode === "signin"
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* ═══ Header bar ═══ */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-6">
        <div className="flex items-center gap-3">
          <img src={nurselyLogo} alt="Nursely" className="h-14 mt-2 ml-4"/>
          {censusStatus === "loading" ? (
            <Badge variant="outline" className="text-xs text-muted-foreground animate-pulse">
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
              Pre-seeding Snowflake ({preseedProgress.synced}/{preseedProgress.total})
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
          <span className="text-xs text-muted-foreground">{session.user.email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={authBusy}
          >
            Sign out
          </Button>
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
            <div className={cn("crossfade-layer flex flex-col gap-3 p-4", detailPatient && "hidden-layer")}>
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
            <div className={cn("crossfade-layer", !detailPatient && "hidden-layer")}>
              {detailPatient && (
                <PatientDetailCard patient={detailPatient} onBack={handleBackToTable} />
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
                  <AnalystPanel
                    selectedPatient={selectedPatient}
                    searchQuery={debouncedQuery}
                    onSwitchToChat={switchToChat}
                    liveCensus={liveCensus}
                  />
                </div>
              ) : (
                <ChatPanel
                  selectedPatient={selectedPatient}
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
