import type { Metadata, Viewport } from "next";
import { inter } from "@/fonts";
import "./globals.css";
import { Pestanas } from "@/components/pestanas";
import { SinRed } from "@/components/sin-red";

export const metadata: Metadata = {
  title: {
    default: "Ranking UVG · Club de Tenis de Mesa",
    template: "%s · Ranking UVG",
  },
  description:
    "Tabla de posiciones, resultados y torneos del club de tenis de mesa de la Universidad del Valle de Guatemala.",
  applicationName: "Ranking UVG",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Ranking UVG", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/v2/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/v2/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "es_GT",
    siteName: "Ranking UVG",
    title: "Ranking UVG · Club de Tenis de Mesa",
    description: "Tabla de posiciones, resultados y torneos del club.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Un solo modo, un solo color: el mismo fondo de la app, para que la barra
  // del navegador no corte contra la pantalla.
  themeColor: "#f2f2f7",
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
      data-scroll-behavior="smooth"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* `#app` es lo que se achica detrás de una hoja abierta. */}
        <div id="app" className="flex min-h-full flex-1 flex-col bg-background">
          {children}
        </div>
        <SinRed />
        <Pestanas />
      </body>
    </html>
  );
}
