import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UsuarioRow } from "@/lib/supabase/tipos";
import { datos } from "@/lib/supabase/errores";

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

  // Por `mi_perfil` y no por un select a `usuario`: `debe_cambiar_pin` dejó de
  // ser legible desde el cliente. Antes cualquiera, incluso sin sesión, podía
  // pedir la lista de quién todavía tiene el PIN que repartió el coordinador.
  const usuario = datos(await supabase.rpc("mi_perfil"), "tu perfil");
  if (!usuario || !usuario.activo) return null;

  return { authId: user.id, usuario };
});

/**
 * Para páginas que requieren sesión. Si no hay (o venció), manda a /ingresar
 * con un motivo para poder explicarlo en vez de mostrar el formulario pelado.
 */
export async function requerirSesion(): Promise<SesionActual> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/ingresar?motivo=sesion");
  return sesion;
}
