import type { Metadata, Viewport } from "next";
import { figtree } from "@/fonts";
import "./globals.css";
import { Pestanas } from "@/components/pestanas";

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
  // Un solo modo, un solo color: el mismo fondo de la app, para que la barra
  // del navegador no corte contra la pantalla.
  themeColor: "#f1f4f0",
};

/**
 * `data-app` es una marca estable para que la auditoría sepa que la URL que
 * está midiendo es esta aplicación y no otro proyecto ocupando el mismo
 * puerto. El título no sirve para eso: mientras una página redirige, el
 * navegador lo reemplaza por "Loading http://...".
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-GT"
      data-app="uvgtt"
      className={`${figtree.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Pestanas />
      </body>
    </html>
  );
}
