import { redirect } from "next/navigation";
import { obtenerSesion, type SesionActual } from "./sesion";

/** Para páginas y acciones del panel: exige sesión con rol coordinador. */
export async function requerirCoordinador(): Promise<SesionActual> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/ingresar");
  if (sesion.usuario.debe_cambiar_pin) redirect("/cambiar-pin");
  if (sesion.usuario.rol !== "coordinador") redirect("/");
  return sesion;
}
