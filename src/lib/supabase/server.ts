import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./tipos";
import { env } from "@/lib/env";

/**
 * Cliente para Server Components, Server Actions y Route Handlers.
 * Lee la sesión de las cookies; en Server Components el `setAll` puede fallar
 * (solo lectura) y se ignora porque el proxy ya refresca la sesión.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component: no se pueden escribir cookies; el proxy lo hace.
        }
      },
    },
  });
}

/**
 * Cliente anónimo sin cookies para páginas públicas cacheables (la tabla).
 * No usar para nada que dependa del usuario.
 */
export function createPublicClient() {
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
