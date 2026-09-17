/**
 * Los tamaños contra los que se revisa cada pantalla.
 *
 * Tres, no siete. Entre 320, 360, 390 y 430 casi nunca se rompe algo en uno y
 * no en los otros: si entra a 320, entra en todos. Los cuatro sobrantes le
 * costaban tres minutos a cada corrida sin encontrar nada que 320 no hubiera
 * encontrado ya.
 *
 * Si algún día aparece un defecto que solo se ve en un ancho intermedio, se
 * agrega ese ancho acá con el defecto anotado al lado, y así la lista crece
 * por una razón y no por precaución.
 */
export const PANTALLAS = [
  // El piso real: iPhone SE de primera generación y Android baratos que
  // todavía circulan. No es teórico; en el club va a haber teléfonos viejos, y
  // el que tenga uno no va a reportar que no le sirve, simplemente va a dejar
  // de usarla.
  { nombre: "320 · el teléfono más angosto", width: 320, height: 568 },
  // El teléfono de casi todos.
  { nombre: "390 · teléfono común", width: 390, height: 844 },
  // El coordinador arma el ranking y resuelve disputas desde una laptop.
  { nombre: "1440 · laptop", width: 1440, height: 900 },
] as const;

/**
 * Rutas que se pueden ver sin ingresar.
 *
 * El torneo y el jugador llevan id: los de acá son los que crea
 * `supabase/seed.sql`, con el id fijo justamente para poder auditarlos. Si la
 * semilla cambia, estas rutas se caen y la prueba lo dice.
 */
const TORNEO_SEMILLA = "11111111-2222-3333-4444-555555555555";

export const RUTAS_PUBLICAS = [
  "/",
  "/?division=menor",
  "/reglas",
  "/rankings",
  "/ingresar",
  "/jugador/20002",
  `/torneos/${TORNEO_SEMILLA}`,
  `/torneos/${TORNEO_SEMILLA}?ver=grupos`,
];

/** Rutas que necesitan sesión de jugador. */
export const RUTAS_JUGADOR = ["/partidos"];

/** Rutas que necesitan sesión de coordinador. */
export const RUTAS_COORDINADOR = [
  "/admin",
  "/admin/jugadores",
  "/admin/ranking",
  "/admin/partidos",
];
