import localFont from "next/font/local";

/**
 * Figtree, la tipografía del club.
 *
 * El archivo vive en el repo y no en node_modules ni en Google Fonts, por la
 * misma razón por la que antes se empaquetó Geist: el build no debe depender
 * de la red. Es una fuente variable de 12 KB, así que un solo archivo cubre
 * todos los pesos de 400 a 900 sin pedir nada más.
 *
 * Licencia SIL Open Font License 1.1; el texto está en figtree-OFL.txt, al
 * lado del archivo, que es lo que la licencia exige para redistribuirla.
 */
export const figtree = localFont({
  src: [{ path: "./figtree-variable.woff2", weight: "400 900", style: "normal" }],
  variable: "--font-figtree",
  display: "swap",
  // Next mide la fuente de respaldo y la ajusta para que el texto no salte
  // cuando Figtree termina de cargar.
  adjustFontFallback: "Arial",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});
