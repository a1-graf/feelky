import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { SessionProvider } from "@/components/session-provider";
import { THEMES, THEME_COOKIE, parseTheme } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feelky",
  description: "Персональний облік грошей, крипти, доходів, витрат і виводів",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Feelky"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg"
  }
};

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
    <html lang="uk" data-theme={theme === "default" ? undefined : theme} suppressHydrationWarning>
      <body>
        <SessionProvider>
          <PwaRegister />
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
