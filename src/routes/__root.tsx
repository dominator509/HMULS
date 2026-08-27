import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "SHE UNDRESSES";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0a0a0a" },
      {
        name: "description",
        content: "She undresses in order. One paid shot at a time. Sequential adult photosets. 18+.",
      },
      { name: "rating", content: "adult" },
      { name: "RATING", content: "RTA-5042-1996-1400-1577-RTA" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <AppShell>
            <Outlet />
          </AppShell>
          <Toaster
            theme="dark"
            position="top-center"
            toastOptions={{
              style: {
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-fg)",
              },
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
