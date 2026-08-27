import { useEffect, type ReactNode } from "react";
import { Header } from "./Header";
import { AgeGate } from "./AgeGate";
import { Footer } from "./Footer";
import { applyThemeToDocument, completeTheme } from "@/lib/theme";

function ThemeBoot() {
  useEffect(() => {
    try {
      const cached = localStorage.getItem("vault-theme");
      if (cached) applyThemeToDocument(completeTheme(JSON.parse(cached)));
    } catch {
      /* ignore */
    }
    fetch("/api/theme")
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        if (!raw) return;
        const theme = completeTheme(raw);
        applyThemeToDocument(theme);
        try {
          localStorage.setItem("vault-theme", JSON.stringify(theme));
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined);
  }, []);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-bg text-fg">
      <ThemeBoot />
      <div className="grain-overlay" />
      <AgeGate />
      <Header />
      <main className="relative z-10">{children}</main>
      <Footer />
    </div>
  );
}
