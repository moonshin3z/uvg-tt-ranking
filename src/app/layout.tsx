import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ranking · Club de Tenis de Mesa UVG",
    template: "%s · Club de Tenis de Mesa UVG",
  },
  description:
    "Tabla de posiciones, resultados y torneos del club de tenis de mesa de la Universidad del Valle de Guatemala.",
  applicationName: "Club TM UVG",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Club TM UVG", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "es_GT",
    siteName: "Club de Tenis de Mesa UVG",
    title: "Ranking · Club de Tenis de Mesa UVG",
    description: "Tabla de posiciones, resultados y torneos del club.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1b4a8a" },
    { media: "(prefers-color-scheme: dark)", color: "#16233a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-GT" className={`${GeistSans.variable} ${GeistMono.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
