import type { Metadata } from "next";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioAlta } from "./formularios";
import { ListaJugadores } from "./lista";
import { MensajeParaElGrupo } from "./mensaje-grupo";

export const metadata: Metadata = { title: "Jugadores" };

export default async function PaginaJugadores() {
  const sesion = await requerirCoordinador();
  const supabase = await createClient();
  const usuarios = datos(
    await supabase
      .from("usuario")
      .select("id, carnet, nombre, rol, activo, debe_cambiar_pin")
      .order("activo", { ascending: false })
      .order("nombre"),
    "la lista de jugadores",
  );

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
  if (enCurso) {
    const filas = datos(
      await supabase
        .from("inscripcion")
        .select("usuario_id, division!inner(ranking_id)")
        .eq("division.ranking_id", enCurso.id),
      "las inscripciones",
    );
    for (const f of filas ?? []) inscritos.add(f.usuario_id);
  }

  const lista = usuarios ?? [];
  const activos = lista.filter((u) => u.activo).length;

  return (
    <>
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
          />
        </CardContent>
      </Card>
    </>
  );
}
