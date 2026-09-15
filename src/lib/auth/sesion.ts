import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UsuarioRow } from "@/lib/supabase/tipos";

export type SesionActual = {
  authId: string;
  usuario: UsuarioRow;
};

/**
 * Usuario autenticado + su perfil del club. `cache` evita repetir la consulta
 * cuando layout y página la piden en el mismo request.
 */
export const obtenerSesion = cache(async (): Promise<SesionActual | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: usuario } = await supabase.from("usuario").select("*").eq("id", user.id).maybeSingle();
  if (!usuario || !usuario.activo) return null;

  return { authId: user.id, usuario };
});

/** Para páginas que requieren sesión. Redirige a /ingresar si no hay. */
export async function requerirSesion(): Promise<SesionActual> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/ingresar");
  return sesion;
}
