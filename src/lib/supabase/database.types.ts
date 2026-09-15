export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      division: {
        Row: {
          cupo: number | null
          id: string
          ranking_id: string
          tipo: Database["public"]["Enums"]["division_tipo"]
        }
        Insert: {
          cupo?: number | null
          id?: string
          ranking_id: string
          tipo: Database["public"]["Enums"]["division_tipo"]
        }
        Update: {
          cupo?: number | null
          id?: string
          ranking_id?: string
          tipo?: Database["public"]["Enums"]["division_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "division_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "ranking"
            referencedColumns: ["id"]
          },
        ]
      }
      inscripcion: {
        Row: {
          creado_en: string
          division_id: string
          id: string
          origen: Database["public"]["Enums"]["inscripcion_origen"]
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          division_id: string
          id?: string
          origen: Database["public"]["Enums"]["inscripcion_origen"]
          usuario_id: string
        }
        Update: {
          creado_en?: string
          division_id?: string
          id?: string
          origen?: Database["public"]["Enums"]["inscripcion_origen"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscripcion_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "division"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      partido: {
        Row: {
          actualizado_en: string
          confirmado_en: string | null
          confirmado_por: string | null
          creado_en: string
          division_id: string
          estado: Database["public"]["Enums"]["partido_estado"]
          ganador: string | null
          id: string
          jugador_a: string
          jugador_b: string
          registrado_en: string | null
          registrado_por: string | null
          resolucion: string | null
          sets_a: number | null
          sets_b: number | null
          tipo: Database["public"]["Enums"]["partido_tipo"]
        }
        Insert: {
          actualizado_en?: string
          confirmado_en?: string | null
          confirmado_por?: string | null
          creado_en?: string
          division_id: string
          estado?: Database["public"]["Enums"]["partido_estado"]
          ganador?: string | null
          id?: string
          jugador_a: string
          jugador_b: string
          registrado_en?: string | null
          registrado_por?: string | null
          resolucion?: string | null
          sets_a?: number | null
          sets_b?: number | null
          tipo?: Database["public"]["Enums"]["partido_tipo"]
        }
        Update: {
          actualizado_en?: string
          confirmado_en?: string | null
          confirmado_por?: string | null
          creado_en?: string
          division_id?: string
          estado?: Database["public"]["Enums"]["partido_estado"]
          ganador?: string | null
          id?: string
          jugador_a?: string
          jugador_b?: string
          registrado_en?: string | null
          registrado_por?: string | null
          resolucion?: string | null
          sets_a?: number | null
          sets_b?: number | null
          tipo?: Database["public"]["Enums"]["partido_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "partido_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partido_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "division"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partido_ganador_fkey"
            columns: ["ganador"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partido_jugador_a_fkey"
            columns: ["jugador_a"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partido_jugador_b_fkey"
            columns: ["jugador_b"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partido_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      partido_evento: {
        Row: {
          accion: Database["public"]["Enums"]["evento_accion"]
          actor: string | null
          antes: Json | null
          creado_en: string
          despues: Json | null
          id: number
          partido_id: string
        }
        Insert: {
          accion: Database["public"]["Enums"]["evento_accion"]
          actor?: string | null
          antes?: Json | null
          creado_en?: string
          despues?: Json | null
          id?: never
          partido_id: string
        }
        Update: {
          accion?: Database["public"]["Enums"]["evento_accion"]
          actor?: string | null
          antes?: Json | null
          creado_en?: string
          despues?: Json | null
          id?: never
          partido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partido_evento_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partido_evento_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partido"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking: {
        Row: {
          cerrado_en: string | null
          creado_en: string
          estado: Database["public"]["Enums"]["ranking_estado"]
          fecha_limite: string
          horas_autoconfirmacion: number | null
          id: string
          n_ascienden: number
          n_descienden: number
          n_premiados: number
          nombre: string
          numero: number
          pts_derrota: number
          pts_victoria: number
          semestre_id: string
        }
        Insert: {
          cerrado_en?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["ranking_estado"]
          fecha_limite: string
          horas_autoconfirmacion?: number | null
          id?: string
          n_ascienden?: number
          n_descienden?: number
          n_premiados?: number
          nombre: string
          numero: number
          pts_derrota?: number
          pts_victoria?: number
          semestre_id: string
        }
        Update: {
          cerrado_en?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["ranking_estado"]
          fecha_limite?: string
          horas_autoconfirmacion?: number | null
          id?: string
          n_ascienden?: number
          n_descienden?: number
          n_premiados?: number
          nombre?: string
          numero?: number
          pts_derrota?: number
          pts_victoria?: number
          semestre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_semestre_id_fkey"
            columns: ["semestre_id"]
            isOneToOne: false
            referencedRelation: "semestre"
            referencedColumns: ["id"]
          },
        ]
      }
      semestre: {
        Row: {
          fin: string
          id: string
          inicio: string
          nombre: string
        }
        Insert: {
          fin: string
          id?: string
          inicio: string
          nombre: string
        }
        Update: {
          fin?: string
          id?: string
          inicio?: string
          nombre?: string
        }
        Relationships: []
      }
      set_partido: {
        Row: {
          id: string
          numero: number
          partido_id: string
          puntos_a: number
          puntos_b: number
        }
        Insert: {
          id?: string
          numero: number
          partido_id: string
          puntos_a: number
          puntos_b: number
        }
        Update: {
          id?: string
          numero?: number
          partido_id?: string
          puntos_a?: number
          puntos_b?: number
        }
        Relationships: [
          {
            foreignKeyName: "set_partido_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partido"
            referencedColumns: ["id"]
          },
        ]
      }
      sorteo: {
        Row: {
          ejecutado_en: string
          ejecutado_por: string
          id: string
          ranking_id: string
          resultado: Json
          semilla: string
        }
        Insert: {
          ejecutado_en?: string
          ejecutado_por: string
          id?: string
          ranking_id: string
          resultado: Json
          semilla: string
        }
        Update: {
          ejecutado_en?: string
          ejecutado_por?: string
          id?: string
          ranking_id?: string
          resultado?: Json
          semilla?: string
        }
        Relationships: [
          {
            foreignKeyName: "sorteo_ejecutado_por_fkey"
            columns: ["ejecutado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sorteo_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: true
            referencedRelation: "ranking"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario: {
        Row: {
          activo: boolean
          actualizado_en: string
          carnet: string
          creado_en: string
          debe_cambiar_pin: boolean
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol"]
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          carnet: string
          creado_en?: string
          debe_cambiar_pin?: boolean
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol"]
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          carnet?: string
          creado_en?: string
          debe_cambiar_pin?: boolean
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol"]
        }
        Relationships: []
      }
    }
    Views: {
      tabla_posiciones: {
        Row: {
          carnet: string | null
          division: Database["public"]["Enums"]["division_tipo"] | null
          division_id: string | null
          nombre: string | null
          pg: number | null
          pg_desempate: number | null
          pj: number | null
          pp: number | null
          pts: number | null
          ranking_id: string | null
          usuario_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "division_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "ranking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "division"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      es_coordinador: { Args: never; Returns: boolean }
    }
    Enums: {
      division_tipo: "mayor" | "menor"
      evento_accion:
        | "registro"
        | "confirmo"
        | "disputo"
        | "edito"
        | "resolvio"
        | "autoconfirmo"
        | "anulo"
        | "creo"
      inscripcion_origen:
        | "sorteo"
        | "ascenso"
        | "descenso"
        | "permanece"
        | "manual"
      partido_estado:
        | "pendiente"
        | "jugado"
        | "confirmado"
        | "disputado"
        | "resuelto"
        | "anulado"
      partido_tipo: "regular" | "desempate"
      ranking_estado:
        | "borrador"
        | "abierto"
        | "fase_regular_cerrada"
        | "en_desempates"
        | "cerrado"
      rol: "jugador" | "coordinador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      division_tipo: ["mayor", "menor"],
      evento_accion: [
        "registro",
        "confirmo",
        "disputo",
        "edito",
        "resolvio",
        "autoconfirmo",
        "anulo",
        "creo",
      ],
      inscripcion_origen: [
        "sorteo",
        "ascenso",
        "descenso",
        "permanece",
        "manual",
      ],
      partido_estado: [
        "pendiente",
        "jugado",
        "confirmado",
        "disputado",
        "resuelto",
        "anulado",
      ],
      partido_tipo: ["regular", "desempate"],
      ranking_estado: [
        "borrador",
        "abierto",
        "fase_regular_cerrada",
        "en_desempates",
        "cerrado",
      ],
      rol: ["jugador", "coordinador"],
    },
  },
} as const

