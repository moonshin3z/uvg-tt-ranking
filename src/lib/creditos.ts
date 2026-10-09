/**
 * Quién hizo la app. Sale en Cómo funciona y en su perfil, con el enlace a su
 * portafolio: no es para presumir, es para que el que encuentre un error o
 * tenga una idea sepa a quién decirle.
 *
 * Se reconoce por el carnet porque es lo que identifica a un jugador en la
 * app (`/jugador/<carnet>`), y ya es público en su perfil.
 */
export const CREADOR = {
  nombre: "Iván Roblero",
  carnet: "25238",
  portafolio: "https://ivanrportfolio.online",
} as const;

/** "https://ivanrportfolio.online" → "ivanrportfolio.online", para mostrarlo. */
export const PORTAFOLIO_VISIBLE = CREADOR.portafolio.replace(/^https?:\/\//, "").replace(/\/$/, "");
