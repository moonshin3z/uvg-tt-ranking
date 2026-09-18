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
      desempate_manual: {
        Row: {
          decidido_en: string
          decidido_por: string | null
          division_id: string
          id: string
          motivo: string
          orden: number
          usuario_id: string
        }
        Insert: {
          decidido_en?: string
          decidido_por?: string | null
          division_id: string
          id?: string
          motivo: string
          orden: number
          usuario_id: string
        }
        Update: {
          decidido_en?: string
          decidido_por?: string | null
          division_id?: string
          id?: string
          motivo?: string
          orden?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desempate_manual_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desempate_manual_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "division"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desempate_manual_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
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
      marcador: {
        Row: {
          actualizado_en: string
          aviso: string | null
          codigo: string
          creado_en: string
          dueno: string
          estado: Database["public"]["Enums"]["marcador_estado"]
          historial: Json
          id: string
          nombre_a: string
          nombre_b: string
          partido_id: string | null
          puntos_a: number
          puntos_b: number
          puntos_por_set: number
          saca: string | null
          sets_a: number
          sets_b: number
          sets_para_ganar: number
          version: number
        }
        Insert: {
          actualizado_en?: string
          aviso?: string | null
          codigo: string
          creado_en?: string
          dueno: string
          estado?: Database["public"]["Enums"]["marcador_estado"]
          historial?: Json
          id?: string
          nombre_a: string
          nombre_b: string
          partido_id?: string | null
          puntos_a?: number
          puntos_b?: number
          puntos_por_set?: number
          saca?: string | null
          sets_a?: number
          sets_b?: number
          sets_para_ganar?: number
          version?: number
        }
        Update: {
          actualizado_en?: string
          aviso?: string | null
          codigo?: string
          creado_en?: string
          dueno?: string
          estado?: Database["public"]["Enums"]["marcador_estado"]
          historial?: Json
          id?: string
          nombre_a?: string
          nombre_b?: string
          partido_id?: string | null
          puntos_a?: number
          puntos_b?: number
          puntos_por_set?: number
          saca?: string | null
          sets_a?: number
          sets_b?: number
          sets_para_ganar?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marcador_dueno_fkey"
            columns: ["dueno"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marcador_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partido"
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
          disputa_motivo: string | null
          division_id: string | null
          estado: Database["public"]["Enums"]["partido_estado"]
          ganador: string | null
          grupo_id: string | null
          id: string
          jugador_a: string
          jugador_b: string
          registrado_en: string | null
          registrado_por: string | null
          resolucion: string | null
          ronda: number
          sets_a: number | null
          sets_b: number | null
          tipo: Database["public"]["Enums"]["partido_tipo"]
          torneo_id: string | null
        }
        Insert: {
          actualizado_en?: string
          confirmado_en?: string | null
          confirmado_por?: string | null
          creado_en?: string
          disputa_motivo?: string | null
          division_id?: string | null
          estado?: Database["public"]["Enums"]["partido_estado"]
          ganador?: string | null
          grupo_id?: string | null
          id?: string
          jugador_a: string
          jugador_b: string
          registrado_en?: string | null
          registrado_por?: string | null
          resolucion?: string | null
          ronda?: number
          sets_a?: number | null
          sets_b?: number | null
          tipo?: Database["public"]["Enums"]["partido_tipo"]
          torneo_id?: string | null
        }
        Update: {
          actualizado_en?: string
          confirmado_en?: string | null
          confirmado_por?: string | null
          creado_en?: string
          disputa_motivo?: string | null
          division_id?: string | null
          estado?: Database["public"]["Enums"]["partido_estado"]
          ganador?: string | null
          grupo_id?: string | null
          id?: string
          jugador_a?: string
          jugador_b?: string
          registrado_en?: string | null
          registrado_por?: string | null
          resolucion?: string | null
          ronda?: number
          sets_a?: number | null
          sets_b?: number | null
          tipo?: Database["public"]["Enums"]["partido_tipo"]
          torneo_id?: string | null
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
            foreignKeyName: "partido_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "torneo_grupo"
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
          {
            foreignKeyName: "partido_torneo_id_fkey"
            columns: ["torneo_id"]
            isOneToOne: false
            referencedRelation: "torneo"
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
          anterior_id: string | null
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
          puntos_por_set: number
          semestre_id: string
          sets_para_ganar: number
        }
        Insert: {
          anterior_id?: string | null
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
          puntos_por_set?: number
          semestre_id: string
          sets_para_ganar?: number
        }
        Update: {
          anterior_id?: string | null
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
          puntos_por_set?: number
          semestre_id?: string
          sets_para_ganar?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranking_anterior_id_fkey"
            columns: ["anterior_id"]
            isOneToOne: false
            referencedRelation: "ranking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_semestre_id_fkey"
            columns: ["semestre_id"]
            isOneToOne: false
            referencedRelation: "semestre"
            referencedColumns: ["id"]
          },
        ]
      }
      retiro: {
        Row: {
          division: Database["public"]["Enums"]["division_tipo"]
          ejecutado_en: string
          ejecutado_por: string | null
          id: string
          motivo: string | null
          partidos_anulados: number
          ranking_id: string
          usuario_id: string
        }
        Insert: {
          division: Database["public"]["Enums"]["division_tipo"]
          ejecutado_en?: string
          ejecutado_por?: string | null
          id?: string
          motivo?: string | null
          partidos_anulados?: number
          ranking_id: string
          usuario_id: string
        }
        Update: {
          division?: Database["public"]["Enums"]["division_tipo"]
          ejecutado_en?: string
          ejecutado_por?: string | null
          id?: string
          motivo?: string | null
          partidos_anulados?: number
          ranking_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retiro_ejecutado_por_fkey"
            columns: ["ejecutado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retiro_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "ranking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retiro_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
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
      torneo: {
        Row: {
          actualizado_en: string
          cant_grupos: number | null
          clasifican_por_grupo: number
          creado_en: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["torneo_estado"]
          fecha: string | null
          formato: Database["public"]["Enums"]["torneo_formato"]
          horas_autoconfirmacion: number | null
          id: string
          nombre: string
          puntos_por_set: number
          semestre_id: string
          sets_para_ganar: number
          tam_llave: number | null
        }
        Insert: {
          actualizado_en?: string
          cant_grupos?: number | null
          clasifican_por_grupo?: number
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["torneo_estado"]
          fecha?: string | null
          formato: Database["public"]["Enums"]["torneo_formato"]
          horas_autoconfirmacion?: number | null
          id?: string
          nombre: string
          puntos_por_set?: number
          semestre_id: string
          sets_para_ganar?: number
          tam_llave?: number | null
        }
        Update: {
          actualizado_en?: string
          cant_grupos?: number | null
          clasifican_por_grupo?: number
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["torneo_estado"]
          fecha?: string | null
          formato?: Database["public"]["Enums"]["torneo_formato"]
          horas_autoconfirmacion?: number | null
          id?: string
          nombre?: string
          puntos_por_set?: number
          semestre_id?: string
          sets_para_ganar?: number
          tam_llave?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "torneo_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneo_semestre_id_fkey"
            columns: ["semestre_id"]
            isOneToOne: false
            referencedRelation: "semestre"
            referencedColumns: ["id"]
          },
        ]
      }
      torneo_grupo: {
        Row: {
          id: string
          nombre: string
          torneo_id: string
        }
        Insert: {
          id?: string
          nombre: string
          torneo_id: string
        }
        Update: {
          id?: string
          nombre?: string
          torneo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "torneo_grupo_torneo_id_fkey"
            columns: ["torneo_id"]
            isOneToOne: false
            referencedRelation: "torneo"
            referencedColumns: ["id"]
          },
        ]
      }
      torneo_inscripcion: {
        Row: {
          creado_en: string
          grupo_id: string | null
          id: string
          siembra: number | null
          torneo_id: string
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          grupo_id?: string | null
          id?: string
          siembra?: number | null
          torneo_id: string
          usuario_id: string
        }
        Update: {
          creado_en?: string
          grupo_id?: string | null
          id?: string
          siembra?: number | null
          torneo_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "torneo_inscripcion_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "torneo_grupo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneo_inscripcion_torneo_id_fkey"
            columns: ["torneo_id"]
            isOneToOne: false
            referencedRelation: "torneo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneo_inscripcion_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      torneo_llave: {
        Row: {
          ganador: string | null
          id: string
          jugador_a: string | null
          jugador_b: string | null
          partido_id: string | null
          posicion: number
          ronda: number
          torneo_id: string
        }
        Insert: {
          ganador?: string | null
          id?: string
          jugador_a?: string | null
          jugador_b?: string | null
          partido_id?: string | null
          posicion: number
          ronda: number
          torneo_id: string
        }
        Update: {
          ganador?: string | null
          id?: string
          jugador_a?: string | null
          jugador_b?: string | null
          partido_id?: string | null
          posicion?: number
          ronda?: number
          torneo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "torneo_llave_ganador_fkey"
            columns: ["ganador"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneo_llave_jugador_a_fkey"
            columns: ["jugador_a"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneo_llave_jugador_b_fkey"
            columns: ["jugador_b"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneo_llave_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneo_llave_torneo_id_fkey"
            columns: ["torneo_id"]
            isOneToOne: false
            referencedRelation: "torneo"
            referencedColumns: ["id"]
          },
        ]
      }
      torneo_sorteo: {
        Row: {
          ejecutado_en: string
          ejecutado_por: string
          id: string
          resultado: Json
          semilla: string
          torneo_id: string
        }
        Insert: {
          ejecutado_en?: string
          ejecutado_por: string
          id?: string
          resultado: Json
          semilla: string
          torneo_id: string
        }
        Update: {
          ejecutado_en?: string
          ejecutado_por?: string
          id?: string
          resultado?: Json
          semilla?: string
          torneo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "torneo_sorteo_ejecutado_por_fkey"
            columns: ["ejecutado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneo_sorteo_torneo_id_fkey"
            columns: ["torneo_id"]
            isOneToOne: true
            referencedRelation: "torneo"
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
          dif_sets: number | null
          division: Database["public"]["Enums"]["division_tipo"] | null
          division_id: string | null
          nombre: string | null
          pg: number | null
          pg_desempate: number | null
          pj: number | null
          pp: number | null
          pts: number | null
          ranking_id: string | null
          sets_c: number | null
          sets_f: number | null
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
      abrir_inscripcion_torneo: {
        Args: { p_torneo_id: string }
        Returns: {
          actualizado_en: string
          cant_grupos: number | null
          clasifican_por_grupo: number
          creado_en: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["torneo_estado"]
          fecha: string | null
          formato: Database["public"]["Enums"]["torneo_formato"]
          horas_autoconfirmacion: number | null
          id: string
          nombre: string
          puntos_por_set: number
          semestre_id: string
          sets_para_ganar: number
          tam_llave: number | null
        }
        SetofOptions: {
          from: "*"
          to: "torneo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      abrir_marcador_de_partido: {
        Args: {
          p_partido_id: string
          p_puntos_por_set?: number
          p_sets_para_ganar?: number
        }
        Returns: {
          actualizado_en: string
          aviso: string | null
          codigo: string
          creado_en: string
          dueno: string
          estado: Database["public"]["Enums"]["marcador_estado"]
          historial: Json
          id: string
          nombre_a: string
          nombre_b: string
          partido_id: string | null
          puntos_a: number
          puntos_b: number
          puntos_por_set: number
          saca: string | null
          sets_a: number
          sets_b: number
          sets_para_ganar: number
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "marcador"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      abrir_marcador_libre: {
        Args: {
          p_nombre_a: string
          p_nombre_b: string
          p_puntos_por_set: number
          p_sets_para_ganar: number
        }
        Returns: {
          actualizado_en: string
          aviso: string | null
          codigo: string
          creado_en: string
          dueno: string
          estado: Database["public"]["Enums"]["marcador_estado"]
          historial: Json
          id: string
          nombre_a: string
          nombre_b: string
          partido_id: string | null
          puntos_a: number
          puntos_b: number
          puntos_por_set: number
          saca: string | null
          sets_a: number
          sets_b: number
          sets_para_ganar: number
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "marcador"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      abrir_ranking: { Args: { p_ranking_id: string }; Returns: undefined }
      anulados_sin_retiro: { Args: { p_ranking_id: string }; Returns: number }
      anular_partido: {
        Args: { p_nota: string; p_partido_id: string }
        Returns: {
          actualizado_en: string
          confirmado_en: string | null
          confirmado_por: string | null
          creado_en: string
          disputa_motivo: string | null
          division_id: string | null
          estado: Database["public"]["Enums"]["partido_estado"]
          ganador: string | null
          grupo_id: string | null
          id: string
          jugador_a: string
          jugador_b: string
          registrado_en: string | null
          registrado_por: string | null
          resolucion: string | null
          ronda: number
          sets_a: number | null
          sets_b: number | null
          tipo: Database["public"]["Enums"]["partido_tipo"]
          torneo_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partido"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      armar_divisiones: {
        Args: { p_asignacion: Json; p_ranking_id: string; p_semilla?: string }
        Returns: number
      }
      armar_torneo: {
        Args: {
          p_cant_grupos: number
          p_orden: string[]
          p_semilla: string
          p_torneo_id: string
        }
        Returns: {
          actualizado_en: string
          cant_grupos: number | null
          clasifican_por_grupo: number
          creado_en: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["torneo_estado"]
          fecha: string | null
          formato: Database["public"]["Enums"]["torneo_formato"]
          horas_autoconfirmacion: number | null
          id: string
          nombre: string
          puntos_por_set: number
          semestre_id: string
          sets_para_ganar: number
          tam_llave: number | null
        }
        SetofOptions: {
          from: "*"
          to: "torneo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      asignar_rol: {
        Args: { p_rol: string; p_usuario_id: string }
        Returns: {
          activo: boolean
          actualizado_en: string
          carnet: string
          creado_en: string
          debe_cambiar_pin: boolean
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol"]
        }
        SetofOptions: {
          from: "*"
          to: "usuario"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      autoconfirmar_vencidos: { Args: never; Returns: number }
      cambiar_mi_pin: { Args: { p_nuevo: string }; Returns: undefined }
      campeon_de_torneo: { Args: { p_torneo_id: string }; Returns: string }
      cancelar_ranking: {
        Args: { p_motivo: string; p_ranking_id: string }
        Returns: undefined
      }
      cancelar_torneo: {
        Args: { p_motivo: string; p_torneo_id: string }
        Returns: undefined
      }
      cerrar_fase_regular: { Args: { p_ranking_id: string }; Returns: number }
      cerrar_grupos: { Args: { p_torneo_id: string }; Returns: number }
      cerrar_ranking: { Args: { p_ranking_id: string }; Returns: undefined }
      cerrar_torneo: {
        Args: { p_torneo_id: string }
        Returns: {
          actualizado_en: string
          cant_grupos: number | null
          clasifican_por_grupo: number
          creado_en: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["torneo_estado"]
          fecha: string | null
          formato: Database["public"]["Enums"]["torneo_formato"]
          horas_autoconfirmacion: number | null
          id: string
          nombre: string
          puntos_por_set: number
          semestre_id: string
          sets_para_ganar: number
          tam_llave: number | null
        }
        SetofOptions: {
          from: "*"
          to: "torneo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      codigo_marcador: { Args: never; Returns: string }
      confirmar_resultado: {
        Args: { p_partido_id: string }
        Returns: {
          actualizado_en: string
          confirmado_en: string | null
          confirmado_por: string | null
          creado_en: string
          disputa_motivo: string | null
          division_id: string | null
          estado: Database["public"]["Enums"]["partido_estado"]
          ganador: string | null
          grupo_id: string | null
          id: string
          jugador_a: string
          jugador_b: string
          registrado_en: string | null
          registrado_por: string | null
          resolucion: string | null
          ronda: number
          sets_a: number | null
          sets_b: number | null
          tipo: Database["public"]["Enums"]["partido_tipo"]
          torneo_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partido"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      construir_llave: {
        Args: { p_orden: string[]; p_torneo_id: string }
        Returns: number
      }
      contenedor_de_partido: {
        Args: { p_partido_id: string }
        Returns: {
          clase: string
          estado: string
          horas_autoconfirmacion: number
          nombre: string
        }[]
      }
      contenido_del_ranking: {
        Args: { p_ranking_id: string }
        Returns: Json
      }
      contenido_del_torneo: {
        Args: { p_torneo_id: string }
        Returns: Json
      }
      crear_ranking: {
        Args: {
          p_fecha_limite: string
          p_horas_autoconfirmacion?: number
          p_n_ascienden?: number
          p_n_descienden?: number
          p_n_premiados?: number
          p_nombre: string
          p_numero: number
          p_pts_derrota?: number
          p_pts_victoria?: number
          p_puntos_por_set?: number
          p_semestre_id: string
          p_sets_para_ganar?: number
        }
        Returns: string
      }
      crear_ranking_siguiente: {
        Args: {
          p_asignacion?: Json
          p_fecha_limite: string
          p_numero: number
          p_ranking_anterior: string
          p_semestre_id: string
        }
        Returns: string
      }
      crear_torneo: {
        Args: {
          p_fecha: string
          p_formato: string
          p_horas_autoconfirmacion: number
          p_nombre: string
          p_puntos_por_set: number
          p_semestre_id: string
          p_sets_para_ganar: number
        }
        Returns: {
          actualizado_en: string
          cant_grupos: number | null
          clasifican_por_grupo: number
          creado_en: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["torneo_estado"]
          fecha: string | null
          formato: Database["public"]["Enums"]["torneo_formato"]
          horas_autoconfirmacion: number | null
          id: string
          nombre: string
          puntos_por_set: number
          semestre_id: string
          sets_para_ganar: number
          tam_llave: number | null
        }
        SetofOptions: {
          from: "*"
          to: "torneo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decidir_empate: {
        Args: { p_division_id: string; p_motivo: string; p_orden: string[] }
        Returns: number
      }
      deshacer_retiro: {
        Args: { p_ranking_id: string; p_usuario_id: string }
        Returns: number
      }
      disputar_resultado: {
        Args: { p_motivo: string; p_partido_id: string }
        Returns: {
          actualizado_en: string
          confirmado_en: string | null
          confirmado_por: string | null
          creado_en: string
          disputa_motivo: string | null
          division_id: string | null
          estado: Database["public"]["Enums"]["partido_estado"]
          ganador: string | null
          grupo_id: string | null
          id: string
          jugador_a: string
          jugador_b: string
          registrado_en: string | null
          registrado_por: string | null
          resolucion: string | null
          ronda: number
          sets_a: number | null
          sets_b: number | null
          tipo: Database["public"]["Enums"]["partido_tipo"]
          torneo_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partido"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      eliminar_ranking: {
        Args: { p_motivo?: string; p_ranking_id: string }
        Returns: Json
      }
      eliminar_torneo: {
        Args: { p_motivo?: string; p_torneo_id: string }
        Returns: Json
      }
      empates_relevantes: {
        Args: { p_ranking_id: string }
        Returns: {
          accion: string
          division: Database["public"]["Enums"]["division_tipo"]
          division_id: string
          max_pos: number
          min_pos: number
          motivo: string
          nombres: string[]
          pts: number
          usuarios: string[]
        }[]
      }
      es_coordinador: { Args: never; Returns: boolean }
      exigir_activo: { Args: never; Returns: string }
      exigir_coordinador: { Args: never; Returns: undefined }
      exigir_partido_editable: {
        Args: { p_partido_id: string }
        Returns: undefined
      }
      exigir_partido_jugable: {
        Args: { p_partido_id: string }
        Returns: undefined
      }
      generar_calendario: { Args: { p_ranking_id: string }; Returns: number }
      generar_desempates: { Args: { p_ranking_id: string }; Returns: number }
      historial_jugador: {
        Args: { p_usuario_id: string }
        Returns: {
          division: Database["public"]["Enums"]["division_tipo"]
          jugadores_division: number
          n_ascienden: number
          n_descienden: number
          n_premiados: number
          pg: number
          pj: number
          posicion: number
          pp: number
          pts: number
          ranking_estado: Database["public"]["Enums"]["ranking_estado"]
          ranking_id: string
          ranking_nombre: string
        }[]
      }
      historial_valido: {
        Args: {
          p_historial: Json
          p_sets_a: number
          p_sets_b: number
          p_tope: number
        }
        Returns: string
      }
      impacto_retiro: {
        Args: { p_ranking_id: string; p_usuario_id: string }
        Returns: {
          estado: Database["public"]["Enums"]["partido_estado"]
          gano_el_rival: boolean
          puntos_que_pierde: number
          rival: string
          rival_id: string
        }[]
      }
      inscribir_en_torneo: {
        Args: { p_torneo_id: string; p_usuario_id: string }
        Returns: {
          creado_en: string
          grupo_id: string | null
          id: string
          siembra: number | null
          torneo_id: string
          usuario_id: string
        }
        SetofOptions: {
          from: "*"
          to: "torneo_inscripcion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      jugadores_del_club: {
        Args: never
        Returns: {
          activo: boolean
          carnet: string
          debe_cambiar_pin: boolean
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol"]
        }[]
      }
      limpiar_desde: {
        Args: { p_posicion: number; p_ronda: number; p_torneo_id: string }
        Returns: undefined
      }
      mi_perfil: {
        Args: never
        Returns: {
          activo: boolean
          actualizado_en: string
          carnet: string
          creado_en: string
          debe_cambiar_pin: boolean
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol"]
        }
        SetofOptions: {
          from: "*"
          to: "usuario"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      orden_division: {
        Args: { p_division_id: string }
        Returns: {
          dif_sets: number
          dif_sets_desempate: number
          gano_directo: number
          nombre: string
          orden_manual: number
          pg_desempate: number
          posicion: number
          pts: number
          usuario_id: string
        }[]
      }
      orden_siembra: { Args: { p_tam: number }; Returns: number[] }
      partido_a_json: {
        Args: { p: Database["public"]["Tables"]["partido"]["Row"] }
        Returns: Json
      }
      posiciones_division: {
        Args: { p_division_id: string }
        Returns: {
          nombre: string
          pg_desempate: number
          posicion: number
          pts: number
          usuario_id: string
        }[]
      }
      posiciones_grupo: {
        Args: { p_grupo_id: string }
        Returns: {
          dif_sets: number
          empatado_sin_resolver: boolean
          nombre: string
          pg: number
          pj: number
          posicion: number
          pp: number
          sets_c: number
          sets_f: number
          usuario_id: string
        }[]
      }
      propagar_llave: {
        Args: {
          p_ganador: string
          p_posicion: number
          p_ronda: number
          p_torneo_id: string
        }
        Returns: undefined
      }
      proponer_siguiente: {
        Args: { p_ranking_id: string }
        Returns: {
          carnet: string
          division_actual: Database["public"]["Enums"]["division_tipo"]
          division_propuesta: Database["public"]["Enums"]["division_tipo"]
          nombre: string
          origen: Database["public"]["Enums"]["inscripcion_origen"]
          posicion: number
          usuario_id: string
        }[]
      }
      ranking_de_partido: {
        Args: { p_partido_id: string }
        Returns: {
          anterior_id: string | null
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
          puntos_por_set: number
          semestre_id: string
          sets_para_ganar: number
        }
        SetofOptions: {
          from: "*"
          to: "ranking"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reabrir_marcador: {
        Args: { p_marcador_id: string }
        Returns: {
          actualizado_en: string
          aviso: string | null
          codigo: string
          creado_en: string
          dueno: string
          estado: Database["public"]["Enums"]["marcador_estado"]
          historial: Json
          id: string
          nombre_a: string
          nombre_b: string
          partido_id: string | null
          puntos_a: number
          puntos_b: number
          puntos_por_set: number
          saca: string | null
          sets_a: number
          sets_b: number
          sets_para_ganar: number
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "marcador"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_resultado: {
        Args: {
          p_partido_id: string
          p_puntos?: Json
          p_sets_a: number
          p_sets_b: number
        }
        Returns: {
          actualizado_en: string
          confirmado_en: string | null
          confirmado_por: string | null
          creado_en: string
          disputa_motivo: string | null
          division_id: string | null
          estado: Database["public"]["Enums"]["partido_estado"]
          ganador: string | null
          grupo_id: string | null
          id: string
          jugador_a: string
          jugador_b: string
          registrado_en: string | null
          registrado_por: string | null
          resolucion: string | null
          ronda: number
          sets_a: number | null
          sets_b: number | null
          tipo: Database["public"]["Enums"]["partido_tipo"]
          torneo_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partido"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reglas_de_partido: {
        Args: { p_partido_id: string }
        Returns: {
          puntos_por_set: number
          sets_para_ganar: number
        }[]
      }
      resolver_partido: {
        Args: { p_ganador: string; p_nota: string; p_partido_id: string }
        Returns: {
          actualizado_en: string
          confirmado_en: string | null
          confirmado_por: string | null
          creado_en: string
          disputa_motivo: string | null
          division_id: string | null
          estado: Database["public"]["Enums"]["partido_estado"]
          ganador: string | null
          grupo_id: string | null
          id: string
          jugador_a: string
          jugador_b: string
          registrado_en: string | null
          registrado_por: string | null
          resolucion: string | null
          ronda: number
          sets_a: number | null
          sets_b: number | null
          tipo: Database["public"]["Enums"]["partido_tipo"]
          torneo_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partido"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      retirar_del_ranking: {
        Args: { p_motivo: string; p_ranking_id: string; p_usuario_id: string }
        Returns: number
      }
      sacar_de_torneo: {
        Args: { p_torneo_id: string; p_usuario_id: string }
        Returns: undefined
      }
      set_valido: {
        Args: { p_a: number; p_b: number; p_tope: number }
        Returns: boolean
      }
      sincronizar_marcador: {
        Args: {
          p_estado: string
          p_historial: Json
          p_marcador_id: string
          p_puntos_a: number
          p_puntos_b: number
          p_saca: string
          p_sets_a: number
          p_sets_b: number
          p_version: number
        }
        Returns: {
          actualizado_en: string
          aviso: string | null
          codigo: string
          creado_en: string
          dueno: string
          estado: Database["public"]["Enums"]["marcador_estado"]
          historial: Json
          id: string
          nombre_a: string
          nombre_b: string
          partido_id: string | null
          puntos_a: number
          puntos_b: number
          puntos_por_set: number
          saca: string | null
          sets_a: number
          sets_b: number
          sets_para_ganar: number
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "marcador"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
        | "nuevo"
      marcador_estado: "en_juego" | "terminado" | "abandonado"
      partido_estado:
        | "pendiente"
        | "jugado"
        | "confirmado"
        | "disputado"
        | "resuelto"
        | "anulado"
      partido_tipo: "regular" | "desempate" | "grupo" | "llave"
      ranking_estado:
        | "borrador"
        | "abierto"
        | "fase_regular_cerrada"
        | "en_desempates"
        | "cerrado"
        | "cancelado"
      rol: "jugador" | "coordinador"
      torneo_estado:
        | "borrador"
        | "inscripcion"
        | "en_juego"
        | "cerrado"
        | "cancelado"
      torneo_formato: "llave" | "grupos_y_llave"
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
        "nuevo",
      ],
      marcador_estado: ["en_juego", "terminado", "abandonado"],
      partido_estado: [
        "pendiente",
        "jugado",
        "confirmado",
        "disputado",
        "resuelto",
        "anulado",
      ],
      partido_tipo: ["regular", "desempate", "grupo", "llave"],
      ranking_estado: [
        "borrador",
        "abierto",
        "fase_regular_cerrada",
        "en_desempates",
        "cerrado",
        "cancelado",
      ],
      rol: ["jugador", "coordinador"],
      torneo_estado: [
        "borrador",
        "inscripcion",
        "en_juego",
        "cerrado",
        "cancelado",
      ],
      torneo_formato: ["llave", "grupos_y_llave"],
    },
  },
} as const

