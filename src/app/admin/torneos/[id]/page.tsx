import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { gruposSugeridos } from "@/lib/torneos/sorteo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gestion } from "@/app/admin/gestion";
import { ZonaDePeligro, type Contenido } from "@/app/admin/bajas";
import { abrirInscripcion, cerrarGrupos, cerrarTorneo } from "../acciones";
import { BotonTorneo, FormularioArmar, FormularioInscripcion, type JugadorInscribible } from "../formularios";

export const metadata: Metadata = { title: "Torneo" };

async function ZonaTorneo({ id, nombre, estado }: { id: string; nombre: string; estado: string }) {
  const supabase = await createClient();
  const contenido = (datos(
    await supabase.rpc("contenido_del_torneo", { p_torneo_id: id }),
    "el contenido del torneo",
  ) ?? {}) as Partial<Contenido>;

  const c: Contenido = {
    inscritos: contenido.inscritos ?? 0,
    partidos: contenido.partidos ?? 0,
    jugados: contenido.jugados ?? 0,
    marcadores: contenido.marcadores ?? 0,
  };

  return (
    <ZonaDePeligro
      tipo="torneo"
      id={id}
      nombre={nombre}
      estado={ETIQUETA[estado]?.toLowerCase() ?? estado}
      contenido={c}
      sePuedeBorrar={
        ["borrador", "inscripcion", "en_juego"].includes(estado) && c.jugados === 0 && c.marcadores === 0
      }
      sePuedeCancelar={!["cerrado", "cancelado"].includes(estado)}
    />
  );
}

const ETIQUETA: Record<string, string> = {
  borrador: "Borrador",
  inscripcion: "Inscripción abierta",
  en_juego: "En juego",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

/**
 * Un paso del armado, con su número o su palomita.
 *
 * Es el mismo patrón que la pantalla del ranking: el coordinador ve de un
 * vistazo en qué va y qué le falta, en vez de una pila de botones sueltos.
 */
function Paso({
  n,
  titulo,
  listo,
  children,
}: {
  n: number | string;
  titulo: string;
  listo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <span
          aria-hidden
          className={
            listo
              ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-zona-ascenso text-xs font-bold text-white"
              : "flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold"
          }
        >
          {listo ? "✓" : n}
        </span>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function PaginaTorneoAdmin({ params }: PageProps<"/admin/torneos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const torneo = datos(await supabase.from("torneo").select("*").eq("id", id).maybeSingle(), "el torneo");
  if (!torneo) notFound();

  const [inscripciones, usuarios, partidos] = await Promise.all([
    supabase.from("torneo_inscripcion").select("usuario_id").eq("torneo_id", id),
    supabase.from("usuario").select("id, carnet, nombre").eq("activo", true).order("nombre"),
    supabase.from("partido").select("id, tipo, estado").eq("torneo_id", id),
  ]);

  const inscritos = new Set((datos(inscripciones, "la inscripción") ?? []).map((f) => f.usuario_id));
  const jugadores: JugadorInscribible[] = (datos(usuarios, "los jugadores") ?? []).map((u) => ({
    ...u,
    inscrito: inscritos.has(u.id),
  }));

  const todos = datos(partidos, "los partidos del torneo") ?? [];
  const deGrupo = todos.filter((p) => p.tipo === "grupo");
  const gruposSinTerminar = deGrupo.filter((p) => p.estado !== "confirmado" && p.estado !== "resuelto").length;
  const deLlave = todos.filter((p) => p.tipo === "llave");
  const llaveSinTerminar = deLlave.filter((p) => p.estado !== "confirmado" && p.estado !== "resuelto").length;

  const conGrupos = torneo.formato === "grupos_y_llave";
  const armado = torneo.estado === "en_juego" || torneo.estado === "cerrado";

  return (
    <Gestion titulo={torneo.nombre} sub={ETIQUETA[torneo.estado] ?? torneo.estado}>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{torneo.nombre}</h1>
          <Badge variant={torneo.estado === "en_juego" ? "secondary" : "outline"}>
            {ETIQUETA[torneo.estado] ?? torneo.estado}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {conGrupos ? "Grupos y después llave" : "Llave directa"} · gana el que llegue a {torneo.sets_para_ganar}{" "}
          {torneo.sets_para_ganar === 1 ? "set" : "sets"} de {torneo.puntos_por_set} puntos · {inscritos.size}{" "}
          inscrito{inscritos.size === 1 ? "" : "s"}
        </p>
        {armado ? (
          <p className="text-sm">
            <Link href={`/torneos/${torneo.id}` as Route} className="font-medium text-primary underline">
              Ver el cuadro como lo ven los jugadores
            </Link>
          </p>
        ) : null}
      </header>

      {torneo.estado === "borrador" ? (
        <Paso n={1} titulo="Abrir la inscripción" listo={false}>
          <p className="mb-3 text-sm text-muted-foreground">
            Mientras está en borrador el torneo no lo ve nadie más. Al abrir la inscripción podés empezar a anotar
            gente.
          </p>
          <BotonTorneo
            accion={abrirInscripcion}
            torneoId={torneo.id}
            etiqueta="Abrir inscripción"
            etiquetaPendiente="Abriendo..."
          />
        </Paso>
      ) : null}

      {torneo.estado === "inscripcion" ? (
        <>
          <Paso n={1} titulo="Quiénes juegan" listo={inscritos.size >= 2}>
            <FormularioInscripcion torneoId={torneo.id} jugadores={jugadores} />
          </Paso>
          <Paso n={2} titulo="Sortear y armar el cuadro" listo={false}>
            <FormularioArmar
              torneoId={torneo.id}
              conGrupos={conGrupos}
              inscritos={inscritos.size}
              gruposSugeridos={gruposSugeridos(inscritos.size)}
            />
          </Paso>
        </>
      ) : null}

      {torneo.estado === "en_juego" ? (
        <>
          {conGrupos && deLlave.length === 0 ? (
            <Paso n={1} titulo="Cerrar los grupos" listo={false}>
              <p className="mb-3 text-sm text-muted-foreground">
                {gruposSinTerminar === 0
                  ? `Los ${deGrupo.length} partidos de grupo están listos. Al cerrar, los que clasifican pasan a la llave.`
                  : `Faltan ${gruposSinTerminar} de ${deGrupo.length} partidos de grupo. La base no deja cerrar con partidos abiertos.`}
              </p>
              <BotonTorneo
                accion={cerrarGrupos}
                torneoId={torneo.id}
                etiqueta="Cerrar grupos y armar la llave"
                etiquetaPendiente="Cerrando..."
              />
            </Paso>
          ) : null}

          <Paso n={conGrupos && deLlave.length === 0 ? 2 : 1} titulo="Cerrar el torneo" listo={false}>
            <p className="mb-3 text-sm text-muted-foreground">
              {deLlave.length === 0
                ? "Primero hay que armar la llave."
                : llaveSinTerminar === 0
                  ? "La llave está completa. Al cerrar queda el campeón y el torneo pasa al historial."
                  : `Faltan ${llaveSinTerminar} partidos de la llave. La base no deja cerrar con partidos abiertos.`}
            </p>
            <BotonTorneo
              accion={cerrarTorneo}
              torneoId={torneo.id}
              etiqueta="Cerrar torneo"
              etiquetaPendiente="Cerrando..."
              variant="outline"
            />
          </Paso>
        </>
      ) : null}

      {torneo.estado === "cerrado" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Terminado</CardTitle>
            <CardDescription>
              El torneo ya está cerrado. El cuadro queda para consulta y no se puede cambiar.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <ZonaTorneo id={torneo.id} nombre={torneo.nombre} estado={torneo.estado} />
    </Gestion>
  );
}
