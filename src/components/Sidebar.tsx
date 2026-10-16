import { History, Home, Info, Ribbon, ScanLine } from "lucide-react";
import { cn } from "../utils/cn";

export type ViewId = "home" | "predict" | "history" | "about";

/** Exactly the four primary features of the dashboard. */
const NAV_ITEMS: { id: ViewId; label: string; icon: typeof Home; hint: string }[] = [
  { id: "home", label: "Home", icon: Home, hint: "Overview" },
  { id: "predict", label: "Predict", icon: ScanLine, hint: "Run the model" },
  { id: "history", label: "History", icon: History, hint: "Your real runs" },
  { id: "about", label: "About", icon: Info, hint: "Model & metrics" },
];

export default function Sidebar({
  view,
  onNavigate,
  onSignOut,
  userName,
}: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  onSignOut: () => void;
  userName: string;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-plum-800 bg-gradient-to-b from-plum-900 via-plum-950 to-plum-900 text-plum-200 md:flex">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-lg shadow-brand-900/60">
          <Ribbon className="h-5 w-5 text-white" strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <p className="font-display text-[17px] font-semibold tracking-tight text-white">
            Breast Cancer <span className="italic text-brand-300">Prediction System</span>
          </p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-plum-300">Prediction lab</p>
          <p className="mt-1 max-w-[175px] truncate text-[10px] text-plum-300/80">
            Signed in as {userName}
          </p>
        </div>
      </div>

      {/* Navigation — the four primary features */}
      <nav className="mt-9 flex-1 px-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-plum-300/70">
          Menu
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = view === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "focusable group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-brand-600/90 to-brand-800/70 font-semibold text-white shadow-lg shadow-brand-950/40"
                      : "text-plum-200/85 hover:bg-plum-800/70 hover:text-white"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-[17px] w-[17px] transition-transform duration-200 group-hover:scale-110",
                      active ? "text-brand-200" : "text-plum-300 group-hover:text-brand-300"
                    )}
                    strokeWidth={2.2}
                  />
                  <span className="flex-1">{item.label}</span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider",
                      active ? "text-brand-200/80" : "text-plum-300/50 group-hover:text-plum-300"
                    )}
                  >
                    {item.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Educational notice */}
      <div className="px-5 pb-6">
        <p className="rounded-lg border border-dashed border-plum-700 px-3.5 py-2.5 text-[10.5px] leading-relaxed text-plum-300">
          Educational prototype. Not for clinical diagnosis.
        </p>
        <button
          onClick={onSignOut}
          className="focusable mt-3 w-full rounded-lg px-3.5 py-2 text-left text-[11px] font-medium text-plum-300 transition-colors hover:bg-plum-800/70 hover:text-white"
        >
          Sign out
        </button>
      </div>

      {/* Mobile nav (rendered separately at bottom on small screens) */}
    </aside>
  );
}

export function MobileNav({ view, onNavigate }: { view: ViewId; onNavigate: (v: ViewId) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-shell/95 backdrop-blur md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium",
              active ? "text-brand-700" : "text-ink-soft"
            )}
          >
            <item.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
