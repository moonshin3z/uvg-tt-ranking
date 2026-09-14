import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { env } from "@/lib/env";

/**
 * Refresca la sesión en cada request y la propaga a las cookies de la
 * respuesta. Se invoca desde src/proxy.ts. Las reglas de acceso por rol se
 * aplican en cada página/acción (y en la BD con RLS), no aquí.
 */
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valida el token contra Auth (no confiar solo en la cookie).
  await supabase.auth.getUser();

  return response;
}
