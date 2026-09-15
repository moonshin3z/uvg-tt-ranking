/**
 * Alias legibles sobre los tipos generados por `npm run db:types`.
 * database.types.ts se regenera entero; este archivo es el que importa el
 * resto del código, así una regeneración nunca rompe imports.
 */
import type { Database } from "./database.types";

export type { Database, Json } from "./database.types";

type Tablas = Database["public"]["Tables"];
type Vistas = Database["public"]["Views"];
type Enums = Database["public"]["Enums"];

export type Fila<T extends keyof Tablas> = Tablas[T]["Row"];
export type Insertar<T extends keyof Tablas> = Tablas[T]["Insert"];
export type Actualizar<T extends keyof Tablas> = Tablas[T]["Update"];

export type UsuarioRow = Fila<"usuario">;
export type SemestreRow = Fila<"semestre">;
export type RankingRow = Fila<"ranking">;
export type DivisionRow = Fila<"division">;
export type InscripcionRow = Fila<"inscripcion">;
export type SorteoRow = Fila<"sorteo">;
export type PartidoRow = Fila<"partido">;
export type SetPartidoRow = Fila<"set_partido">;
export type PartidoEventoRow = Fila<"partido_evento">;
export type TablaPosicionesRow = Vistas["tabla_posiciones"]["Row"];

export type Rol = Enums["rol"];
export type DivisionTipo = Enums["division_tipo"];
export type RankingEstado = Enums["ranking_estado"];
export type InscripcionOrigen = Enums["inscripcion_origen"];
export type PartidoTipo = Enums["partido_tipo"];
export type PartidoEstado = Enums["partido_estado"];
export type EventoAccion = Enums["evento_accion"];
