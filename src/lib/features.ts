import metricsJson from "../data/modelMetrics.json";

/**
 * Everything in this module is derived from the pre-trained model's
 * `ml/metrics.json` artifact. Feature names, order,
 * ranges and sample rows all come from the actual dataset, nothing is invented.
 */
export const MODEL = metricsJson as unknown as {
  dataset: {
    file: string;
    records: number;
    features: number;
    dropped_columns: string[];
    class_counts: Record<string, number>;
  };
  split: { test_size: number; random_state: number; stratified: boolean; train_samples: number; test_samples: number };
  model: {
    algorithm: string;
    scaler: string;
    library: string;
    solver: string;
    max_iter: number;
    positive_class: string;
    label_map: Record<string, string>;
  };
  evaluation: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    confusion_matrix: { labels: string[]; tn: number; fp: number; fn: number; tp: number };
  };
  features: string[];
  feature_stats: Record<string, { min: number; max: number; mean: number; median: number }>;
  samples: {
    benign: { id: number; features: Record<string, number> };
    malignant: { id: number; features: Record<string, number> };
  };
};

export type FeatureGroupId = "id" | "mean" | "se" | "worst";

export interface FeatureMeta {
  /** Exact training column name, e.g. "concave points_worst" */
  name: string;
  /** Human label, e.g. "Concave points" */
  label: string;
  group: FeatureGroupId;
  min: number;
  max: number;
  mean: number;
  median: number;
}

export const FEATURE_GROUP_INFO: Record<FeatureGroupId, { title: string; blurb: string }> = {
  id: {
    title: "Sample ID",
    blurb: "Record identifier — your notebook trains with it as a feature, so it is sent too.",
  },
  mean: {
    title: "Mean",
    blurb: "Average of each characteristic computed over all nuclei in the sample.",
  },
  se: {
    title: "Standard Error",
    blurb: "Standard error of each characteristic — its variability between nuclei.",
  },
  worst: {
    title: "Worst",
    blurb: "Mean of the three largest (most severe) values observed in the sample.",
  },
};

function pretty(base: string): string {
  return base
    .split(" ")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function groupOf(name: string, suffix: string | undefined): FeatureGroupId {
  if (name === "id") return "id";
  if (suffix === "mean") return "mean";
  if (suffix === "se") return "se";
  return "worst";
}

/** 31 features in the exact order the notebook model was fitted on (id first). */
export const FEATURES: FeatureMeta[] = MODEL.features.map((name) => {
  const [base, suffix] = name.split(/_(mean|se|worst)$/);
  const stats = MODEL.feature_stats[name];
  const isId = name === "id";
  return {
    name,
    label: isId ? "Sample ID" : pretty(base.replace(/_/g, " ")),
    group: groupOf(name, suffix),
    min: stats.min,
    max: stats.max,
    mean: stats.mean,
    median: stats.median,
  };
});

const GROUP_ORDER: FeatureGroupId[] = ["id", "mean", "se", "worst"];

export const FEATURE_GROUPS: { id: FeatureGroupId; features: FeatureMeta[] }[] = GROUP_ORDER.map(
  (g) => ({ id: g, features: FEATURES.filter((f) => f.group === g) })
);

export const SAMPLE_BENIGN = MODEL.samples.benign;
export const SAMPLE_MALIGNANT = MODEL.samples.malignant;

/** How many decimals make sense to display per feature */
export function fmt(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 10) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(3);
  return value.toFixed(4);
}
