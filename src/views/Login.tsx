import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Ribbon, ShieldCheck } from "lucide-react";
import { login, register } from "../lib/api";
import type { AuthUser } from "../lib/types";

export default function Login({
  onSignIn,
  serviceError,
}: {
  onSignIn: (user: AuthUser) => void;
  serviceError?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "signup" && password !== confirmPassword) {
      setNotice("Your passwords don't match. Please check and try again.");
      return;
    }
    setNotice("");
    setSubmitting(true);
    try {
      const user =
        mode === "signup"
          ? await register(name, email, password)
          : await login(email, password);
      onSignIn(user);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setNotice("");
  };

  return (
    <main className="app-texture flex min-h-screen items-center justify-center bg-cream px-5 py-10">
      <div className="grid w-full max-w-[1000px] overflow-hidden rounded-[28px] border border-line bg-shell shadow-[0_28px_90px_-38px_rgba(42,18,32,0.28)] md:min-h-[620px] md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-plum-900 via-plum-950 to-[#351322] p-10 text-white md:flex lg:p-14">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-brand-300/15" />
          <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full border border-brand-300/20" />
          <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-brand-600/15 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-lg shadow-brand-950/40">
              <Ribbon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">
                Breast Cancer <span className="italic text-brand-300">Prediction System</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-plum-300">Prediction lab</p>
            </div>
          </div>

          <div className="relative my-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-300/20 bg-white/5 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-200">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
              A clearer view of the data
            </span>
            <h1 className="mt-6 max-w-md font-display text-[42px] font-medium leading-[1.08] tracking-tight lg:text-[48px]">
              Welcome to a more thoughtful
              <span className="italic text-brand-300"> prediction lab.</span>
            </h1>
            <p className="mt-5 max-w-sm text-[14px] leading-7 text-plum-200/80">
              Explore your model, review its metrics, and run educational predictions in one calm,
              focused workspace.
            </p>
          </div>

          <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-brand-300" />
            <p className="text-[11px] leading-relaxed text-plum-200/80">
              <span className="font-semibold text-white">Privacy-minded by design.</span> Prediction
              history stays in this browser.
            </p>
          </div>
        </section>

        <section className="flex flex-col justify-center px-6 py-10 sm:px-12 md:px-10 lg:px-14">
          <div className="mb-9 flex items-center gap-3 md:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white">
              <Ribbon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <p className="font-display text-[17px] font-semibold text-ink">
              Breast Cancer <span className="italic text-brand-600">Prediction System</span>
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-brand-700">
              {mode === "signin" ? "Your workspace awaits" : "Create your workspace"}
            </p>
            <h2 className="mt-2 font-display text-[34px] font-medium tracking-tight text-ink">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
              {mode === "signin"
                ? "Sign in to continue to your Breast Cancer Prediction System dashboard."
                : "Create an account to get started with the Breast Cancer Prediction System."}
            </p>
          </div>

          {(serviceError || notice) && (
            <p role="alert" className="mt-5 rounded-lg bg-brand-50 px-3 py-2.5 text-center text-[12px] text-brand-800">
              {notice || serviceError}
            </p>
          )}

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-faint">
              {mode === "signin" ? "your account" : "account details"}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-ink">Full name</span>
                <input
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="focusable w-full rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-ink">Email address</span>
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="focusable w-full rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-ink">Password</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Enter any password"}
                  className="focusable w-full rounded-xl border border-line bg-white py-3 pl-10 pr-11 text-[13px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="focusable absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            {mode === "signup" && (
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-ink">Confirm password</span>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  className="focusable w-full rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="focusable group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
            >
              {submitting
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign in to dashboard"
                  : "Create account"}
              {!submitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-faint">
            Your password is stored securely as a one-way hash and is never saved as plain text.
          </p>
          <p className="mt-4 text-center text-[12px] text-ink-soft">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              className="focusable rounded font-semibold text-brand-700 hover:text-brand-800"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
          <p className="mt-5 text-center text-[10px] leading-relaxed text-ink-faint">
            Educational prototype only · Not for clinical diagnosis
          </p>
        </section>
      </div>
    </main>
  );
}
