import type { Metadata } from "next";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioAlta } from "./formularios";
import { ListaJugadores } from "./lista";
import { MensajeParaElGrupo } from "./mensaje-grupo";
import { Gestion } from "@/app/admin/gestion";

export const metadata: Metadata = { title: "Jugadores" };

export default async function PaginaJugadores() {
  const sesion = await requerirCoordinador();
  const supabase = await createClient();
  // Por función y no por select: `debe_cambiar_pin` no se puede leer desde el
  // navegador a propósito (es una pista de quién sigue con el PIN que le
  // dieron), así que la lista completa la devuelve una función de coordinador.
  const usuarios = datos(await supabase.rpc("jugadores_del_club"), "la lista de jugadores");

  // Quiénes están inscritos en el ranking en curso: solo a ellos se les puede
  // ofrecer el retiro.
  const enCurso = datos(
    await supabase
      .from("ranking")
      .select("id, nombre, estado")
      .neq("estado", "cerrado")
      .neq("estado", "borrador")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "el ranking en curso",
  );

  const inscritos = new Set<string>();
  // Quiénes están retirados de ese mismo ranking: a ellos se les ofrece
  // deshacerlo. Un retiro borra la inscripción, así que los dos conjuntos no se
  // pisan nunca.
  const retirados = new Set<string>();
  if (enCurso) {
    const [filas, retiros] = await Promise.all([
      supabase
        .from("inscripcion")
        .select("usuario_id, division!inner(ranking_id)")
        .eq("division.ranking_id", enCurso.id),
      supabase.from("retiro").select("usuario_id").eq("ranking_id", enCurso.id),
    ]);
    for (const f of datos(filas, "las inscripciones") ?? []) inscritos.add(f.usuario_id);
    for (const r of datos(retiros, "los retiros") ?? []) retirados.add(r.usuario_id);
  }

  const lista = usuarios ?? [];
  const activos = lista.filter((u) => u.activo).length;

  return (
    <>
      <Gestion titulo="Jugadores" sub="Altas, PIN y retiros">
        <MensajeParaElGrupo ranking={enCurso?.nombre ?? null} />

        <Card>
          <CardHeader>
            <CardTitle>Nuevo jugador</CardTitle>
            <CardDescription>El sistema genera el PIN; el jugador lo cambia en su primer ingreso.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioAlta />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Jugadores <span className="text-muted-foreground">({activos} activos)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <ListaJugadores
              jugadores={lista}
              sesionId={sesion.authId}
              rankingId={enCurso?.id ?? null}
              inscritos={[...inscritos]}
              retirados={[...retirados]}
            />
          </CardContent>
        </Card>
      </Gestion>
    </>
  );
}
