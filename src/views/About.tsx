import {
  CircleCheck,
  Crosshair,
  GitBranch,
  Layers,
  Percent,
  Radar,
  ScanSearch,
  Sigma,
} from "lucide-react";
import { Card, Disclaimer, Eyebrow, ViewShell, pct } from "../components/ui";
import { MODEL } from "../lib/features";
import { cn } from "../utils/cn";

const CORRECTIONS = [
  {
    title: "Kept exactly your notebook's input space",
    text: `"diagnosis" is the target; "Unnamed: 32" (100 % empty) is dropped. "id" stays as a feature because your notebook trains on X = breast.drop('diagnosis').`,
  },
  {
    title: "Encoded the target once, consistently",
    text: `LabelEncoder maps B → 0 and M → 1; the mapping is saved to label_map.json so Flask decodes predictions identically.`,
  },
  {
    title: "Same scaler, same split",
    text: "StandardScaler is fit on the 80/20 train split (random_state = 42) and saved to scaler.pkl; Flask applies it before every prediction.",
  },
  {
    title: "Reproducible split",
    text: `80/20 train-test split fixed with random_state = ${MODEL.split.random_state}; every run produces the same ${MODEL.split.train_samples}/${MODEL.split.test_samples} division.`,
  },
  {
    title: "One persisted contract",
    text: "model.pkl + scaler.pkl with features.json pinning the 31 names and order the API rebuilds per request.",
  },
];

export default function About() {
  const ev = MODEL.evaluation;
  const cm = ev.confusion_matrix;

  const tiles = [
    { icon: Percent, label: "Accuracy", value: ev.accuracy, note: `${MODEL.split.test_samples - (cm.fp + cm.fn)} of ${MODEL.split.test_samples} correct` },
    { icon: Crosshair, label: "Precision", value: ev.precision, note: `of predicted malignant, ${pct(ev.precision, 1)} truly were` },
    { icon: Radar, label: "Recall", value: ev.recall, note: `of real malignant, ${pct(ev.recall, 1)} were caught` },
    { icon: Sigma, label: "F1-score", value: ev.f1_score, note: "harmonic mean of precision & recall" },
  ];

  const cells = [
    { key: "tn", value: cm.tn, label: "True negative", truth: "Benign", guess: "Benign", good: true },
    { key: "fp", value: cm.fp, label: "False positive", truth: "Benign", guess: "Malignant", good: false },
    { key: "fn", value: cm.fn, label: "False negative", truth: "Malignant", guess: "Benign", good: false },
    { key: "tp", value: cm.tp, label: "True positive", truth: "Malignant", guess: "Malignant", good: true },
  ];
  const maxCell = Math.max(...cells.map((c) => c.value));

  return (
    <ViewShell>
      <Eyebrow>Model report · held-out evaluation</Eyebrow>
      <h1 className="mt-5 font-display text-[36px] font-medium leading-[1.08] tracking-tight text-ink md:text-[46px]">
        One model, measured <span className="italic text-brand-600">honestly</span>.
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        These figures describe the <em>model</em> — computed during training on the untouched
        test split ({MODEL.split.test_samples} tumours). They are not properties of any single
        prediction and are shown here, separately, on purpose.
      </p>

      {/* Metric tiles */}
      <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} hover className="px-5 py-5">
            <div className="flex items-center justify-between">
              <t.icon className="h-[18px] w-[18px] text-brand-600" strokeWidth={2.1} />
            </div>
            <p className="tabular mt-4 font-display text-[30px] font-semibold tracking-tight text-ink">
              {pct(t.value)}
            </p>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{t.label}</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${t.value * 100}%` }} />
            </div>
            <p className="mt-2.5 text-[11.5px] leading-snug text-ink-soft">{t.note}</p>
          </Card>
        ))}
      </div>

      {/* Confusion matrix + facts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card className="px-6 py-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[19px] font-medium tracking-tight text-ink">Confusion matrix</h3>
            <span className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">test split · n={MODEL.split.test_samples}</span>
          </div>
          <div className="mt-5">
            <div className="grid grid-cols-[86px_1fr_1fr] gap-2">
              <div />
              <p className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Predicted Benign</p>
              <p className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Predicted Malignant</p>
              {[
                { row: "Actual Benign", items: cells.slice(0, 2) },
                { row: "Actual Malignant", items: cells.slice(2, 4) },
              ].map((r) => (
                <div key={r.row} className="contents">
                  <p className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{r.row}</p>
                  {r.items.map((c) => (
                    <div
                      key={c.key}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border px-3 py-4",
                        c.good ? "border-sage-200 bg-sage-100/70" : "border-brand-200 bg-brand-50"
                      )}
                      style={{ opacity: 0.55 + 0.45 * (c.value / maxCell) }}
                    >
                      <span className={cn("tabular font-display text-[26px] font-semibold", c.good ? "text-sage-700" : "text-brand-700")}>
                        {c.value}
                      </span>
                      <span className="text-[10.5px] uppercase tracking-wider text-ink-soft">{c.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-soft">
              Read row-wise: of the {cm.tn + cm.fp} truly benign tumours, {cm.fp} was flagged malignant;
              of the {cm.fn + cm.tp} truly malignant, {cm.fn} slipped through. With a positive class of
              “Malignant”, recall is the safety-critical number here.
            </p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="px-6 py-5">
            <div className="flex items-center gap-2.5">
              <GitBranch className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
              <h3 className="font-display text-[17px] font-medium tracking-tight text-ink">Model</h3>
            </div>
            <dl className="mt-3 space-y-2 text-[13px]">
              {[
                ["Algorithm", MODEL.model.algorithm],
                ["Preprocessing", MODEL.model.scaler + " (scaler.pkl, notebook split)"],
                ["Library", MODEL.model.library],
                ["Solver / max_iter", `${MODEL.model.solver} / ${MODEL.model.max_iter}`],
                ["Positive class", MODEL.model.positive_class],
                ["Mapping", "0 → B → Benign · 1 → M → Malignant"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-dashed border-line pb-2 last:border-0">
                  <dt className="text-ink-faint">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="px-6 py-5">
            <div className="flex items-center gap-2.5">
              <Layers className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
              <h3 className="font-display text-[17px] font-medium tracking-tight text-ink">Data & split</h3>
            </div>
            <dl className="mt-3 space-y-2 text-[13px]">
              {[
                ["Source", MODEL.dataset.file],
                ["Records", String(MODEL.dataset.records)],
                ["Features used", `${MODEL.dataset.features} numeric measurements`],
                ["Dropped columns", MODEL.dataset.dropped_columns.join(", ")],
                ["Train / test", `${MODEL.split.train_samples} / ${MODEL.split.test_samples} (${(1 - MODEL.split.test_size) * 100}/${MODEL.split.test_size * 100})`],
                ["random_state", String(MODEL.split.random_state)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-dashed border-line pb-2 last:border-0">
                  <dt className="text-ink-faint">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      {/* Corrections */}
      <Card className="mt-6 px-6 py-6">
        <div className="flex items-center gap-2.5">
          <ScanSearch className="h-[18px] w-[18px] text-brand-600" strokeWidth={2.2} />
          <h3 className="font-display text-[19px] font-medium tracking-tight text-ink">
            How your notebook model is served
          </h3>
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {CORRECTIONS.map((c) => (
            <li key={c.title} className="flex items-start gap-3 rounded-xl bg-cream px-4 py-3.5">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" strokeWidth={2.2} />
              <div>
                <p className="text-[13.5px] font-semibold text-ink">{c.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Limits */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="px-6 py-5">
          <h3 className="font-display text-[17px] font-medium tracking-tight text-ink">Limitations</h3>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-soft">
            <li>· Single dataset of {MODEL.dataset.records} cases from one clinical source — no external validation cohort.</li>
            <li>· Linear decision boundary; richer models may capture interactions better.</li>
            <li>· A {pct(ev.recall, 1)} recall means some malignant tumours are missed — unacceptable for real screening without far stronger evidence.</li>
          </ul>
        </Card>
        <Disclaimer />
      </div>
    </ViewShell>
  );
}
