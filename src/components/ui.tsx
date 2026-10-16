import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { cn } from "../utils/cn";
import { checkHealth } from "../lib/api";
import type { BackendStatus } from "../lib/types";

export function pct(x: number, digits = 2): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function ViewShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("mx-auto w-full max-w-[1080px] px-5 py-8 md:px-10 md:py-12", className)}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-shell shadow-[0_1px_2px_rgba(42,18,32,0.04),0_12px_32px_-16px_rgba(42,18,32,0.12)]",
        hover && "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(42,18,32,0.05),0_24px_44px_-20px_rgba(201,24,74,0.22)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Disclaimer({ className, tight = false }: { className?: string; tight?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-brand-200/70 bg-brand-50/80 text-brand-800",
        tight ? "px-3.5 py-2.5" : "px-4 py-3.5",
        className
      )}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
      <p className={cn("leading-relaxed", tight ? "text-[12px]" : "text-[13px]")}>
        <span className="font-semibold">Educational prototype — not a medical device.</span>{" "}
        Outputs come from a logistic-regression teaching model and must never guide clinical
        decisions. Always consult a qualified healthcare professional.
      </p>
    </div>
  );
}

export function StatusDot({ status }: { status: BackendStatus }) {
  const color =
    status === "online"
      ? "bg-sage-500"
      : status === "offline"
        ? "bg-brand-500"
        : "bg-ink-faint";
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={cn("absolute inline-flex h-full w-full rounded-full", color, status !== "checking" && "pulse-dot")} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}

/** Polls the Flask /api/health endpoint. */
export function useBackendStatus(intervalMs = 15000): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("checking");
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const ok = await checkHealth();
      if (alive) setStatus(ok ? "online" : "offline");
    };
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return status;
}
