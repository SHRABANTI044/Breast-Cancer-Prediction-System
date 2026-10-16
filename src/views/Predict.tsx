import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  CircleDashed,
  Dna,
  Loader2,
  RotateCcw,
  ScanLine,
  Send,
  TerminalSquare,
} from "lucide-react";
import { Card, Disclaimer, Eyebrow, ViewShell } from "../components/ui";
import {
  FEATURES,
  FEATURE_GROUPS,
  FEATURE_GROUP_INFO,
  SAMPLE_BENIGN,
  SAMPLE_MALIGNANT,
  fmt,
  type FeatureMeta,
} from "../lib/features";
import { predict as apiPredict, ApiError } from "../lib/api";
import type { BackendStatus, PredictResponse } from "../lib/types";
import { cn } from "../utils/cn";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string; offline: boolean }
  | { kind: "done"; result: PredictResponse & { receivedAt: string } };

function toNumberMap(values: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]));
}

function Field({
  meta,
  value,
  onChange,
  invalid,
}: {
  meta: FeatureMeta;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  const parsed = Number(value);
  const outOfRange = value.trim() !== "" && Number.isFinite(parsed) && (parsed < meta.min || parsed > meta.max);
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-ink">{meta.label}</span>
        <span className="tabular text-[10.5px] text-ink-faint">
          {fmt(meta.min)} – {fmt(meta.max)}
        </span>
      </span>
      <span className="mt-1.5 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "tabular focusable w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-ink transition-colors placeholder:text-ink-faint/60",
            invalid
              ? "border-brand-500 bg-brand-50/60"
              : "border-line hover:border-brand-300 focus:border-brand-400"
          )}
          placeholder={fmt(meta.median)}
          aria-label={`${meta.label} (${meta.name})`}
        />
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            invalid ? "bg-brand-600" : outOfRange ? "bg-amber-500" : "bg-transparent"
          )}
          title={
            invalid
              ? "Not a number"
              : outOfRange
                ? "Outside the range observed in the training dataset"
                : undefined
          }
        />
      </span>
      <span className="mt-1 block truncate font-mono text-[10px] tracking-tight text-ink-faint/80">
        {meta.name}
      </span>
    </label>
  );
}

function ProbabilityBar({ label, value, tone }: { label: string; value: number; tone: "sage" | "brand" }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular text-ink-soft">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-line/70">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "h-full rounded-full",
            tone === "sage"
              ? "bg-gradient-to-r from-sage-500 to-sage-600"
              : "bg-gradient-to-r from-brand-400 to-brand-600"
          )}
        />
      </div>
    </div>
  );
}

function ResultPanel({ phase }: { phase: Phase }) {
  return (
    <Card className="sticky top-8 overflow-hidden">
      <AnimatePresence mode="wait">
        {phase.kind === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center px-8 py-14 text-center"
          >
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div className="spin-slow absolute inset-0 rounded-full border-2 border-dashed border-brand-200" />
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                <CircleDashed className="h-7 w-7 text-brand-400" strokeWidth={1.8} />
              </div>
            </div>
            <p className="mt-6 font-display text-[19px] font-medium text-ink">Awaiting a run</p>
            <p className="mt-2 max-w-[260px] text-[12.5px] leading-relaxed text-ink-soft">
              Enter the sample ID and 30 measurements, then run the trained model. Median placeholders
              are reference values only and are never submitted automatically.
            </p>
          </motion.div>
        )}

        {phase.kind === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center px-8 py-14 text-center"
          >
            <Loader2 className="h-9 w-9 animate-spin text-brand-500" strokeWidth={2} />
            <p className="mt-5 font-display text-[19px] font-medium text-ink">Scoring…</p>
            <p className="mt-2 max-w-[260px] text-[12.5px] leading-relaxed text-ink-soft">
              The Flask server is applying the saved StandardScaler + Logistic Regression pipeline.
            </p>
            <div className="shimmer mt-6 h-2 w-48 rounded-full bg-brand-100" />
          </motion.div>
        )}

        {phase.kind === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-7 py-9"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
              {phase.offline ? (
                <TerminalSquare className="h-6 w-6 text-brand-600" strokeWidth={2} />
              ) : (
                <AlertTriangle className="h-6 w-6 text-brand-600" strokeWidth={2} />
              )}
            </div>
            <p className="mt-4 font-display text-[19px] font-medium text-ink">
              {phase.offline ? "Prediction server unreachable" : "Request rejected"}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{phase.message}</p>
            {phase.offline && (
              <div className="mt-4 rounded-lg bg-plum-950 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-brand-200">
                <p>$ pip install -r server/requirements.txt</p>
                <p>$ python server/app.py</p>
                <p className="text-plum-300"># serves http://127.0.0.1:5000</p>
              </div>
            )}
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink-faint">
              No result is shown until the real pipeline answers — this app never fabricates one.
            </p>
          </motion.div>
        )}

        {phase.kind === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={cn(
                "px-7 pb-5 pt-7",
                phase.result.prediction.code === "B"
                  ? "bg-gradient-to-b from-sage-100/80 to-transparent"
                  : "bg-gradient-to-b from-brand-100/80 to-transparent"
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                Model prediction
              </p>
              <p
                className={cn(
                  "mt-2 font-display text-[40px] font-semibold leading-none tracking-tight",
                  phase.result.prediction.code === "B" ? "text-sage-700" : "text-brand-700"
                )}
              >
                {phase.result.prediction.label}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold",
                    phase.result.prediction.code === "B"
                      ? "bg-sage-100 text-sage-700"
                      : "bg-brand-100 text-brand-700"
                  )}
                >
                  <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
                  class code “{phase.result.prediction.code}”
                </span>
                <span className="rounded-full bg-white/70 px-3 py-1 text-[11.5px] font-medium text-ink-soft ring-1 ring-line">
                  LabelEncoder value {phase.result.prediction.encoded}
                </span>
              </div>
              <p className="mt-3 text-[11.5px] text-ink-faint">
                {phase.result.prediction.code === "B" ? "B maps to Benign" : "M maps to Malignant"} · answered at{" "}
                {new Date(phase.result.receivedAt).toLocaleTimeString()} · saved to History
              </p>
            </div>

            <div className="px-7 pb-7 pt-2">
              {phase.result.supports_probability && phase.result.probability ? (
                <div className="space-y-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    predict_proba · class probabilities
                  </p>
                  <ProbabilityBar
                    label="Benign"
                    value={phase.result.probability.benign ?? 0}
                    tone="sage"
                  />
                  <ProbabilityBar
                    label="Malignant"
                    value={phase.result.probability.malignant ?? 0}
                    tone="brand"
                  />
                  <p className="text-[11px] leading-relaxed text-ink-faint">
                    Logistic regression outputs calibrated-style class probabilities. They are
                    model probabilities, not clinical confidence.
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-ink-soft">
                  This estimator does not expose class probabilities (<code>predict_proba</code>{" "}
                  unavailable), so none are displayed.
                </p>
              )}
              <div className="mt-5 border-t border-dashed border-line pt-4">
                <p className="text-[11px] leading-relaxed text-ink-faint">
                  Model-wide evaluation (accuracy, precision, recall, F1, confusion matrix) lives
                  on the <span className="font-semibold text-ink">About</span> page — it describes
                  the model, not this individual case.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function Predict({ status }: { status: BackendStatus }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FEATURES.map(({ name }) => [name, ""]))
  );
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const missingNames = useMemo(
    () => Object.entries(values).filter(([, v]) => v.trim() === "").map(([k]) => k),
    [values]
  );
  const invalidNames = useMemo(
    () =>
      Object.entries(values)
        .filter(([, v]) => v.trim() !== "" && !Number.isFinite(Number(v)))
        .map(([k]) => k),
    [values]
  );

  const setValue = (name: string) => (v: string) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  const loadSample = (sample: { features: Record<string, number> }) => {
    setValues(Object.fromEntries(Object.entries(sample.features).map(([k, v]) => [k, fmt(v)])));
    setPhase({ kind: "idle" });
  };

  const reset = () => {
    setValues(Object.fromEntries(FEATURES.map(({ name }) => [name, ""])));
    setPhase({ kind: "idle" });
  };

  const run = async () => {
    if (missingNames.length > 0 || invalidNames.length > 0) return;
    setPhase({ kind: "loading" });
    try {
      const result = await apiPredict(toNumberMap(values));
      setPhase({ kind: "done", result });
    } catch (err) {
      const offline = err instanceof ApiError && err.status === 0;
      setPhase({
        kind: "error",
        offline,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <ViewShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Predict · flask /api/predict</Eyebrow>
          <h1 className="mt-4 font-display text-[34px] font-medium leading-[1.08] tracking-tight text-ink md:text-[44px]">
            Classify a <span className="italic text-brand-600">tumour</span>
          </h1>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-soft">
            Enter the sample ID and thirty FNA cytology measurements. Each run sends your values to
            the trained model in real time; results are saved to your account's history.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold ring-1",
              status === "online"
                ? "bg-sage-100 text-sage-700 ring-sage-200"
                : status === "offline"
                  ? "bg-brand-50 text-brand-700 ring-brand-200"
                  : "bg-cream text-ink-soft ring-line"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "online" ? "bg-sage-500" : status === "offline" ? "bg-brand-500" : "bg-ink-faint"
              )}
            />
            {status === "online" ? "Flask API connected" : status === "offline" ? "Flask API offline" : "Checking API…"}
          </span>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* -------- Form -------- */}
        <div className="space-y-5">
          <Card className="flex flex-wrap items-center gap-2.5 px-5 py-4">
            <Dna className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
            <p className="mr-1 text-[12.5px] font-medium text-ink-soft">Test with a labeled dataset example:</p>
            <button
              onClick={() => loadSample(SAMPLE_BENIGN)}
              className="focusable rounded-full bg-sage-100 px-3.5 py-1.5 text-[11.5px] font-semibold text-sage-700 transition-colors hover:bg-sage-200"
            >
              Benign example · id {SAMPLE_BENIGN.id}
            </button>
            <button
              onClick={() => loadSample(SAMPLE_MALIGNANT)}
              className="focusable rounded-full bg-brand-100 px-3.5 py-1.5 text-[11.5px] font-semibold text-brand-700 transition-colors hover:bg-brand-200"
            >
              Malignant example · id {SAMPLE_MALIGNANT.id}
            </button>
            <button
              onClick={reset}
              className="focusable inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={2.4} />
              Clear values
            </button>
          </Card>

          {FEATURE_GROUPS.map((group, gi) => (
            <Card key={group.id} className="px-6 py-6">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-[15px] italic text-brand-500">
                  {String(gi + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-[19px] font-medium tracking-tight text-ink">
                    {FEATURE_GROUP_INFO[group.id].title}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-ink-soft">{FEATURE_GROUP_INFO[group.id].blurb}</p>
                </div>
                <span className="ml-auto text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                  {group.features.length} fields
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3">
                {group.features.map((f) => (
                  <Field
                    key={f.name}
                    meta={f}
                    value={values[f.name] ?? ""}
                    onChange={setValue(f.name)}
                    invalid={invalidNames.includes(f.name)}
                  />
                ))}
              </div>
            </Card>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={run}
              disabled={missingNames.length > 0 || invalidNames.length > 0 || phase.kind === "loading"}
              className={cn(
                "focusable inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition-all",
                missingNames.length > 0 || invalidNames.length > 0 || phase.kind === "loading"
                  ? "cursor-not-allowed bg-ink-faint/60 shadow-none"
                  : "bg-brand-600 shadow-brand-600/30 hover:bg-brand-700 hover:shadow-brand-700/40"
              )}
            >
              {phase.kind === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
              ) : (
                <Send className="h-4 w-4" strokeWidth={2.4} />
              )}
              Run trained model
            </button>
            {invalidNames.length > 0 ? (
              <p className="text-[12px] font-medium text-brand-700">
                {invalidNames.length} field{invalidNames.length > 1 ? "s" : ""} need a valid number
              </p>
            ) : missingNames.length > 0 ? (
              <p className="text-[12px] font-medium text-brand-700">
                Enter all {missingNames.length} remaining value{missingNames.length > 1 ? "s" : ""} to run the model
              </p>
            ) : (
              <p className="text-[12px] text-ink-faint">
                All 31 values valid — dots mark values outside the training range.
              </p>
            )}
          </div>

          <Disclaimer tight />
        </div>

        {/* -------- Result -------- */}
        <div className="space-y-4">
          <ResultPanel phase={phase} />
          <Card className="px-5 py-4">
            <div className="flex items-start gap-3">
              <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.2} />
              <p className="text-[11.5px] leading-relaxed text-ink-soft">
                Requests go to <code className="rounded bg-cream px-1 py-0.5 font-mono text-[10.5px]">POST /api/predict</code>.
                The server rebuilds the row with the exact training feature names and order, applies
                the saved scaler and trained model, returns the class code decoded as B → Benign,
                M → Malignant, and records the result in your history. Training rows above are for
                testing the pipeline, not patient data.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </ViewShell>
  );
}
