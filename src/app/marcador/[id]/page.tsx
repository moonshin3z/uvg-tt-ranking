import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { Marcador } from "./marcador";
import { partidoCancelado, partidoPorId } from "@/lib/partidos/consultas";

export const metadata: Metadata = { title: "Marcador" };

export default async function PaginaMarcador({ params }: PageProps<"/marcador/[id]">) {
  const [{ id }, sesion] = await Promise.all([params, requerirSesion()]);
  const supabase = await createClient();

  const m = datos(await supabase.from("marcador").select("*").eq("id", id).maybeSingle(), "el marcador");
  if (!m) notFound();
  // Solo lo lleva quien lo abrió. El resto lo puede mirar, pero eso es otra
  // pantalla; acá se anota.
  if (m.dueno !== sesion.authId && sesion.usuario.rol !== "coordinador") {
    redirect(m.partido_id ? `/partidos/${m.partido_id}` : "/partidos");
  }
  if (m.partido_id) {
    const partido = await partidoPorId(m.partido_id);
    if (partido && partidoCancelado(partido)) redirect(`/partidos/${m.partido_id}`);
  }

  return (
    <Marcador
      id={m.id}
      partidoId={m.partido_id}
      nombreA={m.nombre_a}
      nombreB={m.nombre_b}
      setsParaGanar={m.sets_para_ganar}
      puntosPorSet={m.puntos_por_set}
      inicial={{
        puntosA: m.puntos_a,
        puntosB: m.puntos_b,
        setsA: m.sets_a,
        setsB: m.sets_b,
        historial: (m.historial as [number, number][]) ?? [],
        version: Number(m.version),
        estado: m.estado,
        primerSaque: m.primer_saque === "a" || m.primer_saque === "b" ? m.primer_saque : null,
      }}
    />
  );
}
