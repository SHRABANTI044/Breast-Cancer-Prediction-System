import {
  ArrowRight,
  Braces,
  Database,
  FlaskConical,
  PackageCheck,
  Ruler,
  Tags,
} from "lucide-react";
import type { ViewId } from "../components/Sidebar";
import { Card, Disclaimer, Eyebrow, ViewShell, pct } from "../components/ui";
import { MODEL } from "../lib/features";

const STEPS = [
  {
    icon: Database,
    title: "Dataset",
    text: `${MODEL.dataset.records} fine-needle aspirate tumours — sample ID + ${MODEL.dataset.features - 1} measurements each.`,
  },
  {
    icon: Braces,
    title: "Cleaning",
    text: `Empty column removed: ${MODEL.dataset.dropped_columns.map((c) => `"${c}"`).join(", ")}. Sample ID is kept as a feature, exactly like your notebook.`,
  },
  {
    icon: Tags,
    title: "Encoding",
    text: "diagnosis label-encoded once: B → 0, M → 1, persisted for decoding.",
  },
  {
    icon: Ruler,
    title: "Scaling + model",
    text: "StandardScaler fit on the train split, applied before Logistic Regression.",
  },
  {
    icon: PackageCheck,
    title: "Artifact",
    text: "Notebook model (model.pkl) + scaler (scaler.pkl) served over Flask.",
  },
];

export default function Home({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const stats = [
    { k: `${MODEL.dataset.records}`, v: "records" },
    { k: `${MODEL.dataset.features}`, v: "features" },
    { k: pct(MODEL.evaluation.accuracy), v: "test accuracy" },
    { k: "2", v: "classes: B / M" },
  ];

  const total = MODEL.dataset.records;
  const b = MODEL.dataset.class_counts["B"] ?? 0;
  const m = MODEL.dataset.class_counts["M"] ?? 0;

  return (
    <ViewShell>
      {/* Hero */}
      <section className="relative">
        <Eyebrow>{MODEL.dataset.file.replace(".csv", "")} · logreg pipeline</Eyebrow>
        <h1 className="mt-5 max-w-3xl font-display text-[42px] font-medium leading-[1.05] tracking-tight text-ink md:text-[58px]">
          Reading tumour measurements,
          <span className="italic text-brand-600"> with clarity</span>.
        </h1>
        <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-soft">
          Breast Cancer Prediction System is an educational machine-learning lab. Enter the sample ID and
          30 cytology measurements and your notebook's trained scikit-learn model —
          logistic regression on scaled features, served by Flask — returns a
          Benign&nbsp;/&nbsp;Malignant classification with its
          true class probabilities.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate("predict")}
            className="focusable group inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition-all hover:bg-brand-700 hover:shadow-brand-700/40"
          >
            Start a prediction
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
          </button>
          <button
            onClick={() => onNavigate("about")}
            className="focusable inline-flex items-center gap-2 rounded-full border border-line bg-shell px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            <FlaskConical className="h-4 w-4" strokeWidth={2.2} />
            Inspect model metrics
          </button>
        </div>

        {/* Real stats strip */}
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.v} className="px-5 py-4">
              <p className="tabular font-display text-[26px] font-semibold tracking-tight text-ink">{s.k}</p>
              <p className="mt-0.5 text-[12px] uppercase tracking-[0.14em] text-ink-faint">{s.v}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pipeline flow */}
      <section className="mt-14">
        <h2 className="font-display text-[24px] font-medium tracking-tight text-ink">
          From raw CSV to served prediction
        </h2>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">
          The exact journey every request takes — raw values are scaled with the notebook's StandardScaler, then scored by your model.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <Card key={s.title} hover className="relative px-4 py-4">
              <div className="flex items-center justify-between">
                <s.icon className="h-[18px] w-[18px] text-brand-600" strokeWidth={2.1} />
                <span className="font-display text-[13px] italic text-ink-faint">0{i + 1}</span>
              </div>
              <p className="mt-3 text-[13.5px] font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{s.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Data balance + honesty cards */}
      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <Card className="px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Class balance (real dataset)
          </p>
          <div className="mt-4 flex h-3.5 w-full overflow-hidden rounded-full bg-brand-100">
            <div className="bg-sage-500 transition-all" style={{ width: `${(b / total) * 100}%` }} />
            <div className="bg-brand-500 transition-all" style={{ width: `${(m / total) * 100}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-[12.5px]">
            <span className="inline-flex items-center gap-2 text-ink">
              <i className="h-2.5 w-2.5 rounded-full bg-sage-500" /> Benign · {b} ({pct(b / total, 1)})
            </span>
            <span className="inline-flex items-center gap-2 text-ink">
              <i className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Malignant · {m} ({pct(m / total, 1)})
            </span>
          </div>
        </Card>
        <Card className="px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Honest by design
          </p>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-soft">
            <li>· Metrics shown here are computed once, on the held-out test split, during training.</li>
            <li>· Predictions come only from your notebook model (Flask + model.pkl + scaler.pkl) — never simulated in the browser.</li>
            <li>· History lists only predictions this browser actually made.</li>
          </ul>
        </Card>
      </section>

      <Disclaimer className="mt-10" />
    </ViewShell>
  );
}
