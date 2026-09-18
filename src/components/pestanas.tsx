import type { Route } from "next";
import { obtenerSesion } from "@/lib/auth/sesion";
import { rankingVigente } from "@/lib/ranking/consultas";
import { misPartidos } from "@/lib/partidos/consultas";
import { PestanasCliente, type Pestana } from "./pestanas-cliente";

/**
 * Las pestañas de abajo, copiadas de `docs/diseno/prototipo.html`.
 *
 * Tres para el jugador, cuatro para el coordinador. La bolita roja sobre
 * Partidos dice cuántos resultados esperan tu respuesta: es lo único que la
 * aplicación te reclama, y si no está ahí no hay forma de enterarse sin entrar
 * a buscarlo.
 *
 * No aparecen sin sesión: sin ingresar solo existe la tabla.
 */
export async function Pestanas() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  // Cuántos esperan tu respuesta. Sin ranking en juego no hay nada que contar.
  let porResponder = 0;
  const ranking = await rankingVigente();
  if (ranking && ["abierto", "en_desempates"].includes(ranking.estado)) {
    const mp = await misPartidos(sesion.authId, ranking.id);
    porResponder = mp.porConfirmar.length;
  }

  const esCoordinador = sesion.usuario.rol === "coordinador";
  const pestanas: Pestana[] = [
    { href: "/", icono: "tabla", texto: "Tabla", raiz: "/" },
    { href: "/partidos", icono: "partidos", texto: "Partidos", bolita: porResponder, raiz: "/partidos" },
    ...(esCoordinador ? [{ href: "/admin" as Route, icono: "panel" as const, texto: "Panel", raiz: "/admin" }] : []),
    {
      href: `/jugador/${encodeURIComponent(sesion.usuario.carnet)}` as Route,
      icono: "perfil",
      texto: "Perfil",
      raiz: "/jugador",
    },
  ];

  return <PestanasCliente pestanas={pestanas} />;
}
