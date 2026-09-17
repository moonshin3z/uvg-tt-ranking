import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Error de lectura contra la base. Lo captura el error boundary de Next
 * (`src/app/error.tsx`) y se le muestra al usuario como "no pudimos cargar",
 * en vez de dejar la página vacía como si no hubiera datos.
 */
export class ErrorDeDatos extends Error {
  readonly contexto: string;
  readonly codigo?: string;

  constructor(contexto: string, causa: PostgrestError) {
    super(`No se pudo cargar ${contexto}: ${causa.message}`);
    this.name = "ErrorDeDatos";
    this.contexto = contexto;
    this.codigo = causa.code;
  }
}

/**
 * Desenvuelve una respuesta de Supabase. Si falló, lanza en vez de devolver
 * null: una consulta rota no puede verse igual que "no hay nada".
 */
export function datos<T>(respuesta: { data: T; error: PostgrestError | null }, contexto: string): T {
  if (respuesta.error) throw new ErrorDeDatos(contexto, respuesta.error);
  return respuesta.data;
}
