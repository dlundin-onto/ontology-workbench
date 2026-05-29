import { useState, useEffect, useRef, useCallback } from "react";
import type { Entity, Relation, Principle, ModelRecord, ModelVersion, Persona, WorkContext } from "./types";
import { T, hexToRgb } from "./tokens";
import { subscribeToActiveTasks, type ActiveTask } from "./lib/api";
import { SAMPLE_ENTITIES, SAMPLE_RELATIONS } from "./data/sample";
import { DEFAULT_SYSTEM, DEFAULT_PRINCIPLES } from "./data/principles";
import { PARADIGMS } from "./data/paradigms";
import { PERSONAS as DEFAULT_PERSONAS } from "./data/personas";
import { makeVersion, makeModelRecord, getAutoSave, MAX_VERSIONS, getWorkContext, saveWorkContext, getCustomPersonas, saveCustomPersonas } from "./lib/storage";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { AIPanel } from "./components/AIPanel";
import { ModeTab } from "./components/ModeTab";
// LinkedView and OperationalView are deprecated — kept in /components for possible reinstatement
import { SkillsEditor } from "./components/SkillsEditor";
import { SettingsModal } from "./components/SettingsModal";
import { PrinciplesPanel } from "./components/PrinciplesPanel";
import { SwarmPanel } from "./components/SwarmPanel";
import { PlatformValidator } from "./components/PlatformValidator";
import { PersonasModal } from "./components/PersonasModal";
import { ExportPanel } from "./components/ExportPanel";
import { ImportPanel } from "./components/ImportPanel";
import { ModelLibraryPanel } from "./components/ModelLibraryPanel";
// ApiKeyGate removed — the tool runs without an API key; AI features self-lock when none is set
import { TaxonomyView } from "./components/TaxonomyView";
import type { ValidationResult, SwarmSession } from "./types";

const AUTOSAVE_DEBOUNCE_MS = 2500;

function WorkbenchApp() {
  const [showSettings, setShowSettings] = useState(false);
  const [showPersonas, setShowPersonas] = useState(false);
  const [workContext, setWorkContextState] = useState<WorkContext>(getWorkContext);
  const [personas, setPersonasState] = useState<Persona[]>(() => getCustomPersonas() || DEFAULT_PERSONAS);
  const [mode, setMode] = useState("conceptual");
  const [entities, setEntities] = useState<Entity[]>(SAMPLE_ENTITIES);
  const [relations, setRelations] = useState<Relation[]>(SAMPLE_RELATIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(true);
  const [showSkills, setShowSkills] = useState(false);
  const [showSwarm, setShowSwarm] = useState(false);
  const [showValidator, setShowValidator] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showTaxonomy, setShowTaxonomy] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM);
  const [principles, setPrinciples] = useState<Principle[]>(DEFAULT_PRINCIPLES);
  const [paradigm, setParadigm] = useState("owl");
  const [showPrinciples, setShowPrinciples] = useState(false);
  const [swarmSessions, setSwarmSessions] = useState<SwarmSession[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [currentModelName, setCurrentModelName] = useState("Untitled Model");
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [, setTick] = useState(0); // forces re-render to update elapsed times

  // Subscribe to live API task list
  useEffect(() => subscribeToActiveTasks(setActiveTasks), []);

  // Tick every second while tasks are running to update elapsed display
  useEffect(() => {
    if (activeTasks.length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeTasks.length]);

  // ── Refs for stale-closure-free version snapshots ──────────────────────
  const isRestoringRef = useRef(false);
  const isInitialRef = useRef(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-current state mirror used inside callbacks to avoid stale closures
  const stateRef = useRef({
    entities,
    relations,
    swarmSessions,
    validationResults,
    paradigm,
    principles,
    versions,
    currentModelId,
    currentModelName,
  });
  useEffect(() => {
    stateRef.current = {
      entities,
      relations,
      swarmSessions,
      validationResults,
      paradigm,
      principles,
      versions,
      currentModelId,
      currentModelName,
    };
  });

  // ── Core version management ────────────────────────────────────────────
  const addVersion = useCallback((trigger: ModelVersion["trigger"], label: string) => {
    const s = stateRef.current;
    const v = makeVersion(trigger, label, s.entities, s.relations, s.swarmSessions, s.validationResults, s.paradigm, s.principles);
    setVersions((prev) => {
      const updated = [v, ...prev].slice(0, MAX_VERSIONS);
      // Also persist to localStorage if this model is saved
      if (s.currentModelId) {
        try {
          const record = makeModelRecord(
            s.currentModelId,
            s.currentModelName,
            s.entities,
            s.relations,
            s.principles,
            s.paradigm,
            s.swarmSessions,
            s.validationResults,
            updated
          );
          localStorage.setItem(`owb:model:${s.currentModelId}`, JSON.stringify(record));
        } catch {
          // storage full — just keep in memory
        }
      }
      return updated;
    });
  }, []);

  // ── Autosave effect ─────────────────────────────────────────────────────
  useEffect(() => {
    // Skip the very first render (initial load)
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }
    // Skip if we're in the middle of restoring a version or loading a model
    if (isRestoringRef.current) return;
    // Read the current autosave setting from localStorage (may have changed in Settings)
    if (!getAutoSave()) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      addVersion("autosave", "Autosave");
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [entities, relations, addVersion]);

  // Also autosave when swarm sessions are added
  useEffect(() => {
    if (isInitialRef.current) return;
    if (isRestoringRef.current) return;
    if (!getAutoSave()) return;
    if (swarmSessions.length === 0) return;
    addVersion("swarm", "Swarm session applied");
    // Intentionally not debounced — swarm is an explicit user action
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swarmSessions.length]);

  // ── Load / restore ─────────────────────────────────────────────────────
  function handleLoad(m: ModelRecord) {
    isRestoringRef.current = true;
    setEntities(m.entities || []);
    setRelations(m.relations || []);
    setPrinciples(m.principles || DEFAULT_PRINCIPLES);
    setParadigm(m.paradigm || "owl");
    setSwarmSessions(m.swarmSessions || []);
    setValidationResults(m.validationResults || []);
    setVersions(m.versions || []);
    setCurrentModelId(m.id);
    setCurrentModelName(m.name);
    setShowLibrary(false);
    setTimeout(() => { isRestoringRef.current = false; }, 100);
  }

  function handleRestore(v: ModelVersion) {
    isRestoringRef.current = true;
    setEntities(v.entities);
    setRelations(v.relations);
    setPrinciples(v.principles);
    setParadigm(v.paradigm);
    setSwarmSessions(v.swarmSessions);
    setValidationResults(v.validationResults);
    // Don't wipe versions — add a "restore" entry at the top
    setTimeout(() => {
      isRestoringRef.current = false;
      addVersion("restore", `Restored: ${v.label || relativeTime(v.savedAt)}`);
    }, 150);
  }

  function handleCommit(label: string) {
    addVersion("manual", label);
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const selectedEntity = entities.find((e) => e.id === selectedId);
  const selectedRelation = relations.find((r) => r.id === selectedId);

  const MODES = [
    { id: "conceptual", label: "Conceptual", icon: "ti-topology-star-3" },
    { id: "logical",    label: "Logical",    icon: "ti-table-column" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily: "DM Sans,sans-serif",
        overflow: "hidden",
      }}
    >
      <h2 className="sr-only">Ontology Modeling Workbench</h2>

      {/* ── Modals ── */}
      {showSkills && (
        <SkillsEditor systemPrompt={systemPrompt} setSystemPrompt={setSystemPrompt} onClose={() => setShowSkills(false)} />
      )}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onContextChange={(ctx) => {
            setWorkContextState(ctx);
            saveWorkContext(ctx);
          }}
        />
      )}
      {showPrinciples && (
        <PrinciplesPanel
          principles={principles}
          setPrinciples={setPrinciples}
          paradigm={paradigm}
          setParadigm={setParadigm}
          onClose={() => setShowPrinciples(false)}
        />
      )}
      {showPersonas && (
        <PersonasModal
          personas={personas}
          onSave={(updated) => {
            setPersonasState(updated);
            saveCustomPersonas(updated);
          }}
          onClose={() => setShowPersonas(false)}
        />
      )}
      {showSwarm && (
        <SwarmPanel
          entities={entities}
          relations={relations}
          setEntities={setEntities}
          setRelations={setRelations}
          principles={principles}
          paradigm={paradigm}
          swarmSessions={swarmSessions}
          personas={personas}
          workContext={workContext}
          onSaveSession={(s) => setSwarmSessions((prev) => [...prev, s])}
          onOpenPersonas={() => setShowPersonas(true)}
          onClose={() => setShowSwarm(false)}
        />
      )}
      {showValidator && (
        <PlatformValidator
          entities={entities}
          relations={relations}
          principles={principles}
          paradigm={paradigm}
          validationResults={validationResults}
          swarmSessions={swarmSessions}
          workContext={workContext}
          onSaveValidation={(v) =>
            setValidationResults((prev) => [
              ...prev.filter((x) => x.platformId !== v.platformId),
              v,
            ])
          }
          onClose={() => setShowValidator(false)}
        />
      )}
      {showExport && (
        <ExportPanel entities={entities} relations={relations} onClose={() => setShowExport(false)} />
      )}
      {showLibrary && (
        <ModelLibraryPanel
          currentModel={{
            id: currentModelId,
            name: currentModelName,
            entities,
            relations,
            principles,
            paradigm,
            swarmSessions,
            validationResults,
            versions,
          }}
          onLoad={handleLoad}
          onCommit={handleCommit}
          onRestore={handleRestore}
          onClose={() => setShowLibrary(false)}
        />
      )}
      {showImport && (
        <ImportPanel
          setEntities={(e) => { setEntities(e); addVersion("import", "Model imported"); }}
          setRelations={setRelations}
          onClose={() => setShowImport(false)}
        />
      )}
      {showTaxonomy && (
        <TaxonomyView
          entities={entities}
          relations={relations}
          paradigm={paradigm}
          onConfirmInferred={(updates) =>
            setRelations((prev) =>
              prev.map((r) => {
                const u = updates.find((x) => x.relId === r.id);
                return u ? { ...r, relationType: u.relationType, detectionSource: "explicit" } : r;
              })
            )
          }
          onOpenEntity={(id) => {
            setShowTaxonomy(false);
            setSelectedId(id);
          }}
          onClose={() => setShowTaxonomy(false)}
        />
      )}

      {/* ── Header ── */}
      <header
        style={{
          height: 50,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          flexShrink: 0,
          background: "rgba(13,13,16,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 4 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "linear-gradient(135deg,#4f8ef7,#7c64f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i className="ti ti-topology-star-3" style={{ color: "#fff", fontSize: 14 }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>
            Ontology
          </span>
          <span style={{ fontSize: 9.5, color: T.textDim, letterSpacing: "0.08em" }}>WORKBENCH</span>
        </div>

        {/* Mode tabs */}
        <div
          style={{
            display: "flex",
            gap: 1,
            padding: "3px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 10,
            border: `1px solid ${T.border}`,
          }}
        >
          {MODES.map((m) => (
            <ModeTab key={m.id} {...m} active={mode === m.id} onClick={() => setMode(m.id)} />
          ))}
        </div>

        {/* Right actions */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>

          {/* Models / Library */}
          <button
            onClick={() => setShowLibrary(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 500,
              background: "rgba(79,142,247,0.08)",
              border: "1px solid rgba(79,142,247,0.25)",
              borderRadius: 8,
              color: T.accent,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(79,142,247,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(79,142,247,0.08)")}
          >
            <i className="ti ti-folder" style={{ fontSize: 13 }} /> Models
            {(swarmSessions.length > 0 || validationResults.length > 0 || versions.length > 0) && (
              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(52,211,153,0.2)", color: T.green }}>
                {swarmSessions.length + validationResults.length + versions.length}
              </span>
            )}
          </button>

          <div style={{ width: 1, height: 20, background: T.border }} />

          <button
            onClick={() => setShowSkills(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 11, fontWeight: 500, background: T.purpleDim, border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, color: T.purple, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.25)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = T.purpleDim)}
          >
            <i className="ti ti-brain" style={{ fontSize: 13 }} /> Skills
          </button>

          <button
            onClick={() => setShowPrinciples(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 11, fontWeight: 500, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, color: T.amber, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(251,191,36,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(251,191,36,0.1)")}
          >
            <i className="ti ti-certificate" style={{ fontSize: 13 }} /> Principles
            <span
              style={{
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 4,
                background: `rgba(${hexToRgb(PARADIGMS[paradigm as keyof typeof PARADIGMS]?.color || "#fff")},0.18)`,
                color: PARADIGMS[paradigm as keyof typeof PARADIGMS]?.color,
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
            >
              {PARADIGMS[paradigm as keyof typeof PARADIGMS]?.label.split(" ")[0]}
            </span>
          </button>

          <button
            onClick={() => setShowSwarm(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 11, fontWeight: 500, background: "rgba(79,142,247,0.12)", border: "1px solid rgba(79,142,247,0.35)", borderRadius: 8, color: T.accent, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(79,142,247,0.22)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(79,142,247,0.12)")}
          >
            <i className="ti ti-users-group" style={{ fontSize: 13 }} /> Swarm
          </button>

          <button
            onClick={() => setShowTaxonomy(true)}
            title="Taxonomy Explorer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 11px",
              background: "rgba(167,139,250,0.1)",
              border: "1px solid rgba(167,139,250,0.25)",
              borderRadius: 7,
              color: T.purple,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.1)")}
          >
            <i className="ti ti-sitemap" style={{ fontSize: 12 }} /> Taxonomy
          </button>

          <button
            onClick={() => setShowValidator(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 11, fontWeight: 500, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 8, color: T.green, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(52,211,153,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(52,211,153,0.1)")}
          >
            <i className="ti ti-shield-check" style={{ fontSize: 13 }} /> Validate
          </button>

          <div style={{ width: 1, height: 20, background: T.border }} />

          <button
            onClick={() => setShowImport(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 11, fontWeight: 500, background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.25)", borderRadius: 8, color: T.accent, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(79,142,247,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(79,142,247,0.08)")}
          >
            <i className="ti ti-download" style={{ fontSize: 12 }} /> Import
          </button>

          <button
            onClick={() => setShowExport(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 11, fontWeight: 500, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 8, color: T.amber, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(251,191,36,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(251,191,36,0.08)")}
          >
            <i className="ti ti-upload" style={{ fontSize: 12 }} /> Export
          </button>

          <div style={{ width: 1, height: 20, background: T.border }} />

          <button
            onClick={() => setShowAI((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 500,
              background: showAI ? T.accentDim : "transparent",
              border: `1px solid ${showAI ? T.accent : T.border}`,
              borderRadius: 8,
              color: showAI ? T.accent : T.textMid,
              cursor: "pointer",
            }}
          >
            <i className="ti ti-sparkles" style={{ fontSize: 12 }} /> AI
          </button>

          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(248,113,113,0.07)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: 8,
              color: T.red,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.07)")}
          >
            <i className="ti ti-settings" style={{ fontSize: 14 }} />
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {(mode === "conceptual" || mode === "logical") && (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <Canvas
                entities={entities}
                setEntities={setEntities}
                relations={relations}
                setRelations={setRelations}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                showAttrs={mode === "logical"}
              />
              <div
                style={{
                  width: 250,
                  borderLeft: `1px solid ${T.border}`,
                  display: "flex",
                  flexDirection: "column",
                  background: "rgba(255,255,255,0.012)",
                }}
              >
                <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 9.5, color: T.textDim, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                    {selectedEntity ? selectedEntity.name : selectedRelation ? selectedRelation.label : "Inspector"}
                  </span>
                </div>
                <Inspector
                  entity={selectedEntity}
                  relation={selectedRelation}
                  onUpdateRelation={(id, patch) =>
                    setRelations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
                  }
                  entities={entities}
                  setEntities={setEntities}
                  setRelations={setRelations}
                  setSelectedId={setSelectedId}
                  selectedId={selectedId}
                  mode={mode}
                />
              </div>
            </div>
          )}
        </div>

        {showAI && (
          <div
            style={{
              width: 300,
              borderLeft: `1px solid ${T.border}`,
              display: "flex",
              flexDirection: "column",
              background: "rgba(255,255,255,0.01)",
            }}
          >
            <AIPanel
              mode={mode}
              entities={entities}
              setEntities={setEntities}
              relations={relations}
              setRelations={setRelations}
              systemPrompt={systemPrompt}
              principles={principles}
              paradigm={paradigm}
              workContext={workContext}
              onOpenSkills={() => setShowSkills(true)}
              onOpenPrinciples={() => setShowPrinciples(true)}
              onClose={() => setShowAI(false)}
            />
          </div>
        )}
      </div>

      {/* ── Floating AI Activity Bar ── */}
      {activeTasks.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 14px",
            background: "rgba(13,13,18,0.92)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${activeTasks.length > 1 ? "rgba(251,191,36,0.5)" : T.border}`,
            borderRadius: 24,
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            maxWidth: "min(760px, 90vw)",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {activeTasks.length > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 10,
                background: "rgba(251,191,36,0.12)",
                border: "1px solid rgba(251,191,36,0.3)",
                fontSize: 10,
                color: T.amber,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <i className="ti ti-alert-triangle" style={{ fontSize: 10 }} />
              {activeTasks.length} concurrent — rate limit risk
            </div>
          )}
          {activeTasks.map((task) => {
            const elapsed = Math.floor((Date.now() - task.startedAt) / 1000);
            const roleColor: Record<string, string> = {
              assistant: T.accent,
              swarm: "#a78bfa",
              validator: T.green,
            };
            const c = roleColor[task.role] || T.textMid;
            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 12,
                  background: `rgba(${hexToRgb(c)},0.1)`,
                  border: `1px solid rgba(${hexToRgb(c)},0.25)`,
                }}
              >
                <i
                  className="ti ti-loader-2"
                  style={{ fontSize: 11, color: c, animation: "spin 1s linear infinite", flexShrink: 0 }}
                />
                <span style={{ fontSize: 11, color: T.text, whiteSpace: "nowrap" }}>
                  {task.label}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    color: T.textDim,
                    fontFamily: "JetBrains Mono,monospace",
                    minWidth: 22,
                  }}
                >
                  {elapsed}s
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Utility (used in handleRestore label) ─────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function App() {
  return <WorkbenchApp />;
}
