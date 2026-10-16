import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
import Sidebar, { MobileNav, type ViewId } from "./components/Sidebar";
import { useBackendStatus } from "./components/ui";
import { getCurrentUser, logout } from "./lib/api";
import type { AuthUser } from "./lib/types";
import Login from "./views/Login";
import Home from "./views/Home";
import Predict from "./views/Predict";
import History from "./views/History";
import About from "./views/About";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState<ViewId>("home");
  const status = useBackendStatus();

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((error: unknown) => {
        if (active) {
          setAuthError(error instanceof Error ? error.message : "Unable to check your sign-in status.");
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signOut = async () => {
    try {
      await logout();
      setUser(null);
      setView("home");
      setAuthError("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign out. Please try again.");
    }
  };

  if (authLoading) {
    return (
      <main className="app-texture flex min-h-screen items-center justify-center bg-cream">
        <p className="text-sm text-ink-soft">Checking your account…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <Login
        serviceError={authError || undefined}
        onSignIn={(signedInUser) => {
          setAuthError("");
          setUser(signedInUser);
        }}
      />
    );
  }

  return (
    <div className="app-texture min-h-screen bg-cream">
      {/* The four primary features: Home · Predict · History · About */}
      <Sidebar
        view={view}
        onNavigate={setView}
        onSignOut={() => void signOut()}
        userName={user.name}
      />

      <main className="md:pl-[248px] pb-20 md:pb-0">
        {/* Mobile brand strip */}
        <div className="flex items-center justify-between border-b border-line bg-shell/80 px-5 py-3.5 backdrop-blur md:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.5c-.8 3-2.6 4.4-4.8 5.6C5 9.3 4 10.5 4 12c0 3.9 4.3 8 8 9.5 3.7-1.5 8-5.6 8-9.5 0-1.5-1-2.7-3.2-3.9" />
                <path d="M12 2.5c.8 3 2.6 4.4 4.8 5.6" />
              </svg>
            </span>
            <div>
              <p className="font-display text-[15px] font-semibold text-ink">
                Breast Cancer <span className="italic text-brand-600">Prediction System</span>
              </p>
              <p className="max-w-[180px] truncate text-[10px] text-ink-soft">{user.name}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="focusable rounded-lg p-2 text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {authError && (
          <p role="alert" className="mx-5 mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800 md:mx-10">
            {authError}
          </p>
        )}

        <AnimatePresence mode="wait">
          {view === "home" && <Home key="home" onNavigate={setView} />}
          {view === "predict" && <Predict key="predict" status={status} />}
          {view === "history" && <History key="history" onNavigate={setView} />}
          {view === "about" && <About key="about" />}
        </AnimatePresence>
      </main>

      <MobileNav view={view} onNavigate={setView} />
    </div>
  );
}
