import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import {
  eventosDePartido,
  partidoCancelado,
  partidoPorId,
  setsDePartido,
  type EventoPartido,
} from "@/lib/partidos/consultas";
import { rankingPorId } from "@/lib/ranking/consultas";
import { createClient } from "@/lib/supabase/server";
import { textoAutoconfirmacion } from "@/lib/fechas";
import { Aviso, Heroe, Nota, Pila, TarjetaMarcador, primerNombre } from "@/components/fila";
import { Tope } from "@/components/tope";
import { AnotarResultado, BotonDisputar, BotonesConfirmar } from "../formularios";
import { abrirMarcador } from "../acciones";
import { datos } from "@/lib/supabase/errores";

export const metadata: Metadata = { title: "Partido" };

const ETIQUETA_EVENTO: Record<string, string> = {
  registro: "Registró el resultado",
  confirmo: "Confirmó el resultado",
  disputo: "Abrió una disputa",
  edito: "Editó el resultado",
  resolvio: "Resolvió la disputa",
  autoconfirmo: "El sistema autoconfirmó el resultado",
  anulo: "Anuló el partido",
  creo: "Creó el partido",
};

function textoCampo(valor: unknown, campo: string): string | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const dato = (valor as Record<string, unknown>)[campo];
  if (dato === null || dato === undefined || dato === "") return null;
  return String(dato);
}

function detalleEvento(evento: EventoPartido): string | null {
  const antesEstado = textoCampo(evento.antes, "estado");
  const despuesEstado = textoCampo(evento.despues, "estado");
  const partes: string[] = [];
  if (antesEstado && despuesEstado && antesEstado !== despuesEstado) {
    partes.push(`${antesEstado} → ${despuesEstado}`);
  } else if (despuesEstado) {
    partes.push(despuesEstado);
  }
  const setsA = textoCampo(evento.despues, "sets_a");
  const setsB = textoCampo(evento.despues, "sets_b");
  if (setsA !== null && setsB !== null) partes.push(`sets ${setsA}-${setsB}`);
  const resolucion = textoCampo(evento.despues, "resolucion");
  if (resolucion) partes.push(resolucion);
  return partes.length > 0 ? partes.join(" · ") : null;
}

const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(iso));

/** "ayer a las 4:40 p.m.": cuándo lo registró el rival. */
function cuandoRegistro(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const dia = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(x);
  const a = new Intl.DateTimeFormat("es-GT", { timeStyle: "short", timeZone: "America/Guatemala" }).format(d);
  const ahora = new Date();
  if (dia(d) === dia(ahora)) return `hoy a las ${a}`;
  if (dia(d) === dia(new Date(ahora.getTime() - 86_400_000))) return `ayer a las ${a}`;
  return hora(iso);
}

/**
 * La bitácora del partido: un bloque que se despliega con todo lo que le
 * pasó, quién y cuándo.
 */
function BitacoraPartido({ eventos }: { eventos: EventoPartido[] }) {
  if (eventos.length === 0) return null;
  return (
    <details className="grupo mt-[22px]">
      <summary className="celda cursor-pointer list-none">
        <span className="medio">
          <span className="t-celda">Bitácora del partido</span>
        </span>
        <span className="derecha">{eventos.length}</span>
      </summary>
      <ol className="grid gap-3 px-4 pt-1 pb-4">
        {eventos.map((evento) => {
          const detalle = detalleEvento(evento);
          return (
            <li key={evento.id} className="grid gap-0.5 border-l-2 border-linea-suave pl-3 text-[15px]">
              <p className="font-semibold">{ETIQUETA_EVENTO[evento.accion] ?? evento.accion}</p>
              <p className="text-muted-foreground">
                {evento.actor ? `${evento.actor.nombre} (${evento.actor.carnet})` : "Sistema"}
              </p>
              {detalle ? <p className="text-muted-foreground">{detalle}</p> : null}
              <time dateTime={evento.creadoEn} className="text-[13px] text-muted-foreground">
                {hora(evento.creadoEn)}
              </time>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export default async function PaginaPartido({ params, searchParams }: PageProps<"/partidos/[id]">) {
  const [{ id }, { marcador }, sesion] = await Promise.all([params, searchParams, requerirSesion()]);
  if (sesion.usuario.debe_cambiar_pin) redirect("/cambiar-pin");

  const p = await partidoPorId(id);
  if (!p) notFound();

  const yo = sesion.authId;
  const esCoordinador = sesion.usuario.rol === "coordinador";
  const juego = p.jugador_a === yo || p.jugador_b === yo;
  if (!juego && !esCoordinador) redirect("/partidos");

  const supabase = await createClient();
  const [puntos, ranking, reglas, eventos] = await Promise.all([
    setsDePartido(id),
    // Un partido de torneo no cuelga de ningún ranking.
    p.division ? rankingPorId(p.division.ranking_id) : Promise.resolve(null),
    // Las reglas salen del contenedor del partido, que puede ser un ranking o
    // un torneo, y cada uno juega a lo suyo.
    supabase.rpc("reglas_de_partido", { p_partido_id: id }),
    eventosDePartido(id),
  ]);
  const setsParaGanar = datos(reglas, "las reglas del partido")?.[0]?.sets_para_ganar ?? 2;
  const cancelado = partidoCancelado(p);
  const horasAutoconfirmacion = p.torneo ? p.torneo.horas_autoconfirmacion : ranking?.horas_autoconfirmacion;

  // Para el coordinador mirando un partido ajeno, "yo" es el jugador A.
  const soyA = juego ? p.jugador_a === yo : true;
  const propio = soyA ? p.a : p.b;
  const rival = soyA ? p.b : p.a;
  const volver = esCoordinador && !juego ? "/admin/partidos" : "/partidos";

  const misSets = soyA ? p.sets_a : p.sets_b;
  const susSets = soyA ? p.sets_b : p.sets_a;
  const contexto = p.division
    ? `División ${p.division.tipo === "mayor" ? "Mayor" : "Menor"}${p.tipo === "desempate" ? " · desempate" : ""}`
    : `${p.torneo?.nombre ?? "Torneo"} · ${p.tipo === "grupo" ? "fase de grupos" : "llave"}`;
  const sets = puntos.map((s) => ({
    mios: soyA ? s.puntos_a : s.puntos_b,
    suyos: soyA ? s.puntos_b : s.puntos_a,
  }));
  const tarjeta =
    misSets != null && susSets != null ? <TarjetaMarcador marcador={`${misSets}-${susSets}`} sets={sets} /> : null;

  // Me toca responder: lo registró el otro y todavía no está cerrado.
  const meTocaResponder = juego && p.estado === "jugado" && p.registrado_por !== yo;
  const puedeRegistrar =
    p.estado === "pendiente" || (p.estado === "jugado" && (p.registrado_por === yo || esCoordinador));
  const vence = textoAutoconfirmacion(p.registrado_en, horasAutoconfirmacion ?? null);
  const nombreRival = primerNombre(rival.nombre);

  return (
    <>
      <Tope
        titulo={juego ? rival.nombre : `${p.a.nombre} vs. ${p.b.nombre}`}
        sub={contexto}
        atras={volver as Route}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-8">
        {cancelado ? (
          <>
            <Heroe
              nombre={rival.nombre}
              titulo={`vs. ${rival.nombre}`}
              sub={p.torneo ? "Este torneo está cancelado." : "Este ranking está cancelado."}
            />
            {tarjeta ?? <div className="h-[22px]" />}
            <Aviso>Este partido ya no admite cambios.</Aviso>
          </>
        ) : meTocaResponder ? (
          <>
            <Heroe
              nombre={rival.nombre}
              titulo={`${nombreRival} dice que te ${misSets != null && susSets != null && misSets > susSets ? "perdió" : "ganó"}`}
              sub={`${contexto}${cuandoRegistro(p.registrado_en) ? ` · lo registró ${cuandoRegistro(p.registrado_en)}` : ""}`}
            />
            <TarjetaMarcador marcador={`${misSets ?? 0}-${susSets ?? 0}`} sets={sets} />
            <Pila>
              <BotonesConfirmar partidoId={p.id} />
            </Pila>
            {vence ? <Aviso>Si no respondés, {vence}.</Aviso> : null}
          </>
        ) : puedeRegistrar ? (
          <>
            <Heroe
              nombre={rival.nombre}
              titulo={juego ? `vs. ${rival.nombre}` : `${p.a.nombre} vs. ${p.b.nombre}`}
              sub={`${contexto} · ${p.estado === "jugado" ? "esperando que lo confirme" : `al mejor de ${setsParaGanar * 2 - 1}`}`}
            />
            {p.estado === "jugado" ? tarjeta : null}
            {marcador === "no" ? (
              <p role="alert" className="alerta">
                No se pudo abrir el marcador. Anotá el resultado a mano.
              </p>
            ) : null}
            <Pila className="mt-[26px]">
              <AnotarResultado
                partidoId={p.id}
                yo={juego ? { id: propio.id, nombre: propio.nombre } : { id: p.a.id, nombre: p.a.nombre }}
                rival={{ id: rival.id, nombre: rival.nombre }}
                soyA={soyA}
                setsA={p.sets_a}
                setsB={p.sets_b}
                puntos={puntos}
                setsParaGanar={setsParaGanar}
                contexto={contexto}
                marcador={abrirMarcador}
                corregir={p.estado === "jugado"}
              />
              {/* El camino largo del prototipo: llevar el marcador en vivo y
                  que el resultado se registre solo al terminar. */}
              <form action={abrirMarcador}>
                <input type="hidden" name="partido_id" value={p.id} />
                <button type="submit" className="btn gris bloque">
                  Llevar el marcador en vivo
                </button>
              </form>
            </Pila>
            <Aviso>
              {p.estado === "jugado" && vence
                ? `${nombreRival} todavía no lo confirmó; ${vence}.`
                : "Cualquiera de los dos puede registrarlo. El otro lo confirma."}
            </Aviso>
          </>
        ) : (
          /* Cerrado, en disputa o anulado: muestra lo que pasó. */
          <>
            <Heroe
              nombre={rival.nombre}
              titulo={`vs. ${rival.nombre}`}
              sub={`${contexto} · ${
                p.estado === "disputado"
                  ? "en disputa"
                  : p.estado === "anulado"
                    ? "anulado"
                    : p.estado === "resuelto"
                      ? "resuelto por el coordinador"
                      : "resultado confirmado"
              }`}
            />
            {p.estado !== "anulado" ? (tarjeta ?? <div className="h-[22px]" />) : <div className="h-[22px]" />}
            {p.disputa_motivo ? <Nota>Motivo de la disputa: {p.disputa_motivo}</Nota> : null}
            {p.resolucion ? <Nota>Resolución del coordinador: {p.resolucion}</Nota> : null}
            {p.estado === "disputado" ? <Aviso>El coordinador lo va a resolver.</Aviso> : null}
            {p.estado === "confirmado" && juego ? (
              <>
                <Pila className="mt-2">
                  <BotonDisputar partidoId={p.id} />
                </Pila>
                <Aviso>Si el resultado quedó mal, avisale al coordinador.</Aviso>
              </>
            ) : null}
          </>
        )}
        <BitacoraPartido eventos={eventos} />
      </main>
    </>
  );
}
