import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";
import { env } from "@/lib/env";

/**
 * Cliente con la llave de servicio. SOLO en Server Actions del coordinador,
 * y solo para lo que Auth no permite hacer con la sesión normal: crear
 * usuarios y reiniciar PIN. Nunca se usa para leer o escribir tablas
 * (eso pasa por RLS con la sesión del coordinador).
 */
export function createAdminClient() {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!llave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor");

  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, llave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
