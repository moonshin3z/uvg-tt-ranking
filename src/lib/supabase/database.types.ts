// Tipos de la base de datos.
// Escritos a mano a partir de supabase/migrations/20260914000000_nucleo_ranking.sql.
// Regenerar con `npm run db:types` (requiere `supabase start`) cada vez que
// se agregue una migración; el archivo generado reemplaza a este.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Rol = "jugador" | "coordinador";
export type DivisionTipo = "mayor" | "menor";
export type RankingEstado = "borrador" | "abierto" | "fase_regular_cerrada" | "en_desempates" | "cerrado";
export type InscripcionOrigen = "sorteo" | "ascenso" | "descenso" | "permanece" | "manual";
export type PartidoTipo = "regular" | "desempate";
export type PartidoEstado = "pendiente" | "jugado" | "confirmado" | "disputado" | "resuelto" | "anulado";
export type EventoAccion =
  "registro" | "confirmo" | "disputo" | "edito" | "resolvio" | "autoconfirmo" | "anulo" | "creo";

type Tabla<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type UsuarioRow = {
  id: string;
  carnet: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  debe_cambiar_pin: boolean;
  creado_en: string;
  actualizado_en: string;
};

export type SemestreRow = {
  id: string;
  nombre: string;
  inicio: string;
  fin: string;
};

export type RankingRow = {
  id: string;
  semestre_id: string;
  numero: number;
  nombre: string;
  fecha_limite: string;
  estado: RankingEstado;
  pts_victoria: number;
  pts_derrota: number;
  n_ascienden: number;
  n_descienden: number;
  n_premiados: number;
  horas_autoconfirmacion: number | null;
  creado_en: string;
  cerrado_en: string | null;
};

export type DivisionRow = {
  id: string;
  ranking_id: string;
  tipo: DivisionTipo;
  cupo: number | null;
};

export type InscripcionRow = {
  id: string;
  division_id: string;
  usuario_id: string;
  origen: InscripcionOrigen;
  creado_en: string;
};

export type SorteoRow = {
  id: string;
  ranking_id: string;
  semilla: string;
  ejecutado_por: string;
  ejecutado_en: string;
  resultado: Json;
};

export type PartidoRow = {
  id: string;
  division_id: string;
  tipo: PartidoTipo;
  estado: PartidoEstado;
  jugador_a: string;
  jugador_b: string;
  ganador: string | null;
  sets_a: number | null;
  sets_b: number | null;
  registrado_por: string | null;
  registrado_en: string | null;
  confirmado_por: string | null;
  confirmado_en: string | null;
  resolucion: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type SetPartidoRow = {
  id: string;
  partido_id: string;
  numero: number;
  puntos_a: number;
  puntos_b: number;
};

export type PartidoEventoRow = {
  id: number;
  partido_id: string;
  actor: string | null;
  accion: EventoAccion;
  antes: Json | null;
  despues: Json | null;
  creado_en: string;
};

export type TablaPosicionesRow = {
  division_id: string;
  ranking_id: string;
  division: DivisionTipo;
  usuario_id: string;
  carnet: string;
  nombre: string;
  pj: number;
  pg: number;
  pp: number;
  pts: number;
  pg_desempate: number;
};

export type Database = {
  public: {
    Tables: {
      usuario: Tabla<UsuarioRow, Pick<UsuarioRow, "id" | "carnet" | "nombre"> & Partial<UsuarioRow>>;
      semestre: Tabla<SemestreRow, Omit<SemestreRow, "id"> & { id?: string }>;
      ranking: Tabla<
        RankingRow,
        Pick<RankingRow, "semestre_id" | "numero" | "nombre" | "fecha_limite"> & Partial<RankingRow>
      >;
      division: Tabla<DivisionRow, Pick<DivisionRow, "ranking_id" | "tipo"> & Partial<DivisionRow>>;
      inscripcion: Tabla<
        InscripcionRow,
        Pick<InscripcionRow, "division_id" | "usuario_id" | "origen"> & Partial<InscripcionRow>
      >;
      sorteo: Tabla<
        SorteoRow,
        Pick<SorteoRow, "ranking_id" | "semilla" | "ejecutado_por" | "resultado"> & Partial<SorteoRow>
      >;
      partido: Tabla<PartidoRow, Pick<PartidoRow, "division_id" | "jugador_a" | "jugador_b"> & Partial<PartidoRow>>;
      set_partido: Tabla<
        SetPartidoRow,
        Pick<SetPartidoRow, "partido_id" | "numero" | "puntos_a" | "puntos_b"> & Partial<SetPartidoRow>
      >;
      partido_evento: Tabla<
        PartidoEventoRow,
        Pick<PartidoEventoRow, "partido_id" | "accion"> & Partial<PartidoEventoRow>
      >;
    };
    Views: {
      tabla_posiciones: { Row: TablaPosicionesRow; Relationships: [] };
    };
    Functions: {
      es_coordinador: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      rol: Rol;
      division_tipo: DivisionTipo;
      ranking_estado: RankingEstado;
      inscripcion_origen: InscripcionOrigen;
      partido_tipo: PartidoTipo;
      partido_estado: PartidoEstado;
      evento_accion: EventoAccion;
    };
    CompositeTypes: Record<string, never>;
  };
};
