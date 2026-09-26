import type { Metadata, Route } from "next";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { calendarioDeRanking, rankingVigente } from "@/lib/ranking/consultas";
import { torneoEnCurso } from "@/lib/torneos/consultas";
import { Tope } from "@/components/tope";
import { Fila, Flecha, Lista, Pastilla, Rotulo } from "@/components/fila";
import { GLIFO } from "@/components/iconos";
import { formatearFecha } from "@/lib/fechas";

export const metadata: Metadata = { title: "Panel" };

const ESTADO: Record<string, string> = {
  abierto: "En juego",
  fase_regular_cerrada: "Fase regular cerrada",
  en_desempates: "En desempates",
  cerrado: "Cerrado",
};

/** "hace 2 días", para que se vea cuánto lleva esperando una disputa. */
function desdeCuando(iso: string | null) {
  if (!iso) return "sin fecha";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "desde ayer";
  return `hace ${dias} días`;
}

export default async function Panel() {
  await requerirCoordinador();

  const ranking = await rankingVigente();
  const [partidos, torneo, usuarios] = await Promise.all([
    ranking ? calendarioDeRanking(ranking.id) : Promise.resolve([]),
    torneoEnCurso(),
    (async () => {
      const supabase = await createClient();
      return datos(await supabase.from("usuario").select("activo"), "los jugadores") ?? [];
    })(),
  ]);

  const disputados = partidos.filter((p) => p.estado === "disputado");
  const sinConfirmar = partidos.filter((p) => p.estado === "jugado");
  const cerrados = partidos.filter((p) => p.estado === "confirmado" || p.estado === "resuelto").length;

  const inscritos = new Set(partidos.flatMap((p) => [p.a.carnet, p.b.carnet])).size;
  const activos = usuarios.filter((u) => u.activo).length;
  const bajas = usuarios.length - activos;

  // Los anulados no se juegan: no cuentan ni como hechos ni como faltantes.
  const total = partidos.filter((p) => p.estado !== "anulado").length;
  const faltan = total - cerrados;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
      <Tope
        titulo="Panel"
        sub={ranking ? `${ranking.nombre} · ${new Date(ranking.creado_en).getFullYear()}` : "Coordinación del club"}
      />

      {ranking ? (
        <div className="grupo estado-ranking">
          <div className="er-top">
            <div>
              <span className="er-n">{cerrados}</span>
              <span className="er-de"> de {total} partidos</span>
            </div>
            <span className="capsula">{ESTADO[ranking.estado] ?? ranking.estado}</span>
          </div>
          <div className="barra" aria-hidden>
            <i style={{ width: `${total ? Math.round((cerrados / total) * 100) : 0}%` }} />
          </div>
          <p className="er-pie">
            {faltan === 0 ? "No falta ninguno" : `Faltan ${faltan}`} · cierra el{" "}
            {formatearFecha(ranking.fecha_limite)} · {inscritos} inscritos
          </p>
        </div>
      ) : null}

      {disputados.length > 0 ? (
        <>
          <Rotulo cuenta={disputados.length}>Necesita que decidas</Rotulo>
          <Lista>
            {disputados.map((p) => (
              <Fila
                key={p.id}
                icono={{ glifo: GLIFO.alerta, color: "var(--rojo)" }}
                nombre={`${p.a.nombre} vs. ${p.b.nombre}`}
                sub={`En disputa ${desdeCuando(p.fecha)}`}
                href={"/admin/partidos" as Route}
                derecha={<Pastilla>Resolver</Pastilla>}
              />
            ))}
          </Lista>
        </>
      ) : null}

      <Rotulo>Ranking</Rotulo>
      <Lista>
        {ranking ? (
          <>
            <Fila
              icono={{ glifo: GLIFO.calendario, color: "var(--uvg)" }}
              nombre="Llevar el ranking"
              sub="Divisiones, calendario, apertura y cierre"
              href={"/admin/ranking" as Route}
              derecha={<Flecha />}
            />
            <Fila
              icono={{ glifo: GLIFO.paleta, color: "var(--azul)" }}
              nombre="Partidos"
              sub={
                sinConfirmar.length > 0
                  ? `${sinConfirmar.length} sin confirmar · anular o corregir`
                  : "Anular, corregir o resolver"
              }
              href={"/admin/partidos" as Route}
              derecha={<Flecha />}
            />
          </>
        ) : (
          <Fila
            icono={{ glifo: GLIFO.mas, color: "var(--uvg)" }}
            nombre="Armar un ranking"
            sub="Semestre, divisiones y calendario"
            href={"/admin/ranking" as Route}
            derecha={<Flecha />}
          />
        )}
      </Lista>

      <Rotulo>Torneos</Rotulo>
      <Lista>
        {torneo ? (
          <Fila
            icono={{ glifo: GLIFO.trofeo, color: "var(--naranja)" }}
            nombre={torneo.torneo.nombre}
            sub={`En juego · ${torneo.porJugar === 0 ? "sin partidos por jugar" : `${torneo.porJugar} por jugar`}`}
            href={`/torneos/${torneo.torneo.id}` as Route}
            derecha={<Flecha />}
          />
        ) : null}
        <Fila
          icono={{ glifo: GLIFO.mas, color: "var(--uvg)" }}
          nombre="Crear un torneo"
          sub="Llave directa o grupos y llave"
          href={"/admin/torneos" as Route}
          derecha={<Flecha />}
        />
      </Lista>

      <Rotulo>Club</Rotulo>
      <Lista>
        <Fila
          icono={{ glifo: GLIFO.personas, color: "var(--azul)" }}
          nombre="Jugadores"
          sub={`${activos} activos${bajas > 0 ? ` · ${bajas} dados de baja` : ""}`}
          href={"/admin/jugadores" as Route}
          derecha={<Flecha />}
        />
        <Fila
          icono={{ glifo: GLIFO.lista, color: "var(--gris)" }}
          nombre="Bitácora de bajas"
          sub="Rankings y torneos borrados o cancelados"
          href={"/admin/bajas" as Route}
          derecha={<Flecha />}
        />
        <Fila
          icono={{ glifo: GLIFO.bajar, color: "var(--gris)" }}
          nombre="Exportar a CSV"
          sub="Tabla y partidos"
          href={"/admin/exportar" as Route}
          derecha={<Flecha />}
        />
      </Lista>
    </main>
  );
}
