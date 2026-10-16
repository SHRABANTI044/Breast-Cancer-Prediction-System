export interface PredictResponse {
  prediction: {
    /** Model's encoded class: 0 -> B, 1 -> M (LabelEncoder fitted on ['B','M']) */
    encoded: number;
    /** Original diagnosis code: 'B' | 'M' */
    code: "B" | "M";
    /** Human label: 'Benign' | 'Malignant' */
    label: "Benign" | "Malignant";
  };
  /** predict_proba output, when the estimator supports it */
  probability?: { benign: number | null; malignant: number | null };
  supports_probability: boolean;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface HistoryEntry {
  id: string;
  /** ISO timestamp of the moment the API answered */
  at: string;
  inputs: Record<string, number>;
  prediction: PredictResponse["prediction"];
  probability: NonNullable<PredictResponse["probability"]> | null;
}

export interface ApiMetrics {
  evaluation: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    confusion_matrix: { labels: string[]; tn: number; fp: number; fn: number; tp: number };
  };
  dataset: {
    file: string;
    records: number;
    features: number;
    dropped_columns: string[];
    class_counts: Record<string, number>;
  };
  split: {
    test_size: number;
    random_state: number;
    stratified: boolean;
    train_samples: number;
    test_samples: number;
  };
  model: {
    algorithm: string;
    scaler: string;
    library: string;
    solver: string;
    max_iter: number;
    positive_class: string;
    label_map: Record<string, string>;
  };
  supports_probability: boolean;
}

export type BackendStatus = "checking" | "online" | "offline";
