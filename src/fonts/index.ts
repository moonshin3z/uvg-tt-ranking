import localFont from "next/font/local";

/**
 * Inter, la letra de respaldo.
 *
 * La app habla el idioma del iPhone: en iOS y en macOS la letra es la del
 * sistema, San Francisco, que ya viene instalada y no se descarga. Inter es la
 * más parecida y es la que se ve en Android y en Windows. Va en el repo y no
 * en Google Fonts por lo mismo que antes: el build no depende de la red. Es la
 * variable de 400 a 900, solo con el alfabeto latino (acentos y eñe
 * incluidos): 48 KB.
 *
 * Licencia SIL Open Font License 1.1; el texto está en inter-OFL.txt, al lado
 * del archivo, que es lo que la licencia exige para redistribuirla.
 */
export const inter = localFont({
  src: [{ path: "./inter-variable.woff2", weight: "400 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
  // Next mide la fuente de respaldo y la ajusta para que el texto no salte
  // cuando Inter termina de cargar.
  adjustFontFallback: "Arial",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});
