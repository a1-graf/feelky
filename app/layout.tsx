import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { SessionProvider } from "@/components/session-provider";
import { THEMES, THEME_COOKIE, parseTheme } from "@/lib/themes";
import "./globals.css";

// Light themes get the plain status bar (dark text on white); dark ones draw under it.
export async function generateMetadata(): Promise<Metadata> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return {
    title: "Feelky",
    description: "Персональний облік грошей, крипти, доходів, витрат і виводів",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: theme === "white" ? "default" : "black-translucent",
      title: "Feelky"
    },
    icons: {
      icon: [
        { url: "/icons/icon.svg", type: "image/svg+xml" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }
      ],
      apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    },
    // Next emits only mobile-web-app-capable; older iOS still looks for the apple- one.
    other: { "apple-mobile-web-app-capable": "yes" }
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: THEMES.find((item) => item.id === theme)?.themeColor
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="uk" data-theme={theme} suppressHydrationWarning>
      <body>
        <SessionProvider>
          <PwaRegister />
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
