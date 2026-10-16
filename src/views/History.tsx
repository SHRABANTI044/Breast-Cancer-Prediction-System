import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Clock3, Inbox, Trash2 } from "lucide-react";
import type { ViewId } from "../components/Sidebar";
import { Card, Eyebrow, ViewShell } from "../components/ui";
import { FEATURES, fmt } from "../lib/features";
import { clearHistory, deleteHistoryEntry, fetchHistory } from "../lib/api";
import type { HistoryEntry } from "../lib/types";
import { cn } from "../utils/cn";

function EntryCard({ entry, onDelete }: { entry: HistoryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const malignant = entry.prediction.code === "M";
  const date = new Date(entry.at);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="focusable flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold",
            malignant ? "bg-brand-100 text-brand-700" : "bg-sage-100 text-sage-700"
          )}
        >
          {entry.prediction.code}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={cn("text-[14.5px] font-semibold", malignant ? "text-brand-700" : "text-sage-700")}>
              {entry.prediction.label}
            </span>
            <span className="rounded-full bg-cream px-2.5 py-0.5 text-[10.5px] font-medium text-ink-soft ring-1 ring-line">
              encoded {entry.prediction.encoded}
            </span>
            {entry.probability && (
              <span className="tabular rounded-full bg-cream px-2.5 py-0.5 text-[10.5px] font-medium text-ink-soft ring-1 ring-line">
                P({entry.prediction.label}) ={" "}
                {((malignant ? entry.probability.malignant ?? 0 : entry.probability.benign ?? 0) * 100).toFixed(1)}%
              </span>
            )}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
            <Clock3 className="h-3 w-3" />
            {date.toLocaleDateString()} · {date.toLocaleTimeString()}
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
          strokeWidth={2.2}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-t border-dashed border-line px-5 pb-5 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                The 31 values sent to the model
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 md:grid-cols-3">
                {FEATURES.map((f) => (
                  <div key={f.name} className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="truncate font-mono text-[10.5px] text-ink-faint">{f.name}</span>
                    <span className="tabular font-medium text-ink">{fmt(entry.inputs[f.name] ?? NaN)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={onDelete}
                  className="focusable inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={2.4} />
                  Delete record
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function History({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchHistory()
      .then((history) => {
        if (active) setEntries(history);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load prediction history.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleClear = async () => {
    try {
      await clearHistory();
      setEntries([]);
      setError("");
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Unable to clear prediction history.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteHistoryEntry(id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setError("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete prediction.");
    }
  };

  return (
    <ViewShell>
      <Eyebrow>History · your account</Eyebrow>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] font-medium leading-[1.08] tracking-tight text-ink md:text-[44px]">
            Your <span className="italic text-brand-600">real</span> runs
          </h1>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-soft">
            Genuine prediction results are saved to your account database and available when you
            sign in again.
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={() => void handleClear()}
            className="focusable inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-ink-soft transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
            Clear all
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {error}
        </p>
      )}

      <div className="mt-8 space-y-3">
        {loading ? (
          <Card className="px-8 py-10 text-center text-sm text-ink-soft">Loading your prediction history…</Card>
        ) : entries.length === 0 ? (
          <Card className="flex flex-col items-center px-8 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
              <Inbox className="h-6 w-6 text-brand-500" strokeWidth={2} />
            </div>
            <p className="mt-5 font-display text-[20px] font-medium text-ink">No predictions yet</p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ink-soft">
              History fills in only after the prediction server answers a request.
              Run your first classification to see it recorded here.
            </p>
            <button
              onClick={() => onNavigate("predict")}
              className="focusable mt-6 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition-colors hover:bg-brand-700"
            >
              Go to Predict
            </button>
          </Card>
        ) : (
          entries.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              onDelete={() => void handleDelete(e.id)}
            />
          ))
        )}
      </div>

      {entries.length > 0 && (
        <p className="mt-6 text-center text-[11.5px] text-ink-faint">
          Saved to your account in the server database · showing the latest 100 records
        </p>
      )}
    </ViewShell>
  );
}
