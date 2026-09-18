import type { Metadata, Route } from "next";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { calendarioDeRanking, rankingVigente } from "@/lib/ranking/consultas";
import { torneoEnCurso } from "@/lib/torneos/consultas";
import { Tope } from "@/components/tope";
import { Dato, Fila, Flecha, Lista, Nota, PastillaChica, Rotulo } from "@/components/fila";

export const metadata: Metadata = { title: "Panel" };

function fechaLarga(iso: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "long",
    timeZone: "America/Guatemala",
  }).format(new Date(`${iso}T12:00:00`));
}

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
  const porJugar = partidos.filter((p) => p.estado === "pendiente").length;

  const inscritos = new Set(partidos.flatMap((p) => [p.a.carnet, p.b.carnet])).size;
  const activos = usuarios.filter((u) => u.activo).length;
  const bajas = usuarios.length - activos;

  return (
    <>
      <Tope titulo="Panel" sub="Coordinación del club" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col bg-card pb-8">
        <Nota>
          {ranking
            ? `${ranking.nombre} en juego. ${
                porJugar === 0 ? "No falta ningún partido" : `Faltan ${porJugar} partidos`
              }${
                disputados.length > 0
                  ? ` y hay ${disputados.length} ${disputados.length === 1 ? "resultado" : "resultados"} en disputa`
                  : sinConfirmar.length > 0
                    ? ` y hay ${sinConfirmar.length} sin confirmar`
                    : ""
              }.`
            : "No hay ningún ranking en juego. Armá uno para que el club empiece."}
        </Nota>

        {disputados.length > 0 ? (
          <>
            <Rotulo urgente>Necesita que decidas</Rotulo>
            <Lista>
              {disputados.map((p) => (
                <Fila
                  key={p.id}
                  ini="!"
                  nombre={`${p.a.nombre} vs. ${p.b.nombre}`}
                  sub={`En disputa ${desdeCuando(p.fecha)}`}
                  href={"/admin/partidos" as Route}
                  derecha={<PastillaChica>Resolver</PastillaChica>}
                />
              ))}
            </Lista>
          </>
        ) : null}

        {ranking ? (
          <>
            <Rotulo>{ranking.nombre}</Rotulo>
            <div className="border-t border-linea-suave">
              <Dato valor={inscritos}>Inscritos</Dato>
              <Dato valor={`${cerrados} de ${partidos.length}`}>Partidos jugados</Dato>
              <Dato valor={fechaLarga(ranking.fecha_limite)}>Cierra</Dato>
            </div>
            <Lista>
              <Fila
                nombre="Llevar el ranking"
                sub="Divisiones, calendario, apertura y cierre"
                href={"/admin/ranking" as Route}
                derecha={<Flecha />}
                sinInicial
              />
              <Fila
                nombre="Partidos"
                sub={
                  sinConfirmar.length > 0
                    ? `${sinConfirmar.length} sin confirmar · anular o corregir`
                    : "Anular, corregir o resolver"
                }
                href={"/admin/partidos" as Route}
                derecha={<Flecha />}
                sinInicial
              />
            </Lista>
          </>
        ) : (
          <>
            <Rotulo>Ranking</Rotulo>
            <Lista>
              <Fila
                nombre="Armar un ranking"
                sub="Semestre, divisiones y calendario"
                href={"/admin/ranking" as Route}
                derecha={<Flecha />}
                ini="+"
              />
            </Lista>
          </>
        )}

        <Rotulo>Torneos</Rotulo>
        <Lista>
          {torneo ? (
            <Fila
              nombre={torneo.torneo.nombre}
              sub={`En juego · ${torneo.porJugar === 0 ? "sin partidos por jugar" : `${torneo.porJugar} por jugar`}`}
              href={`/torneos/${torneo.torneo.id}` as Route}
              derecha={<Flecha />}
            />
          ) : null}
          <Fila
            ini="+"
            nombre="Crear un torneo"
            sub="Llave directa o grupos y llave"
            href={"/admin/torneos" as Route}
            derecha={<Flecha />}
          />
        </Lista>

        <Rotulo>Club</Rotulo>
        <Lista>
          <Fila
            ini={String(activos)}
            nombre="Jugadores"
            sub={`${activos} activos${bajas > 0 ? ` · ${bajas} dados de baja` : ""}`}
            href={"/admin/jugadores" as Route}
            derecha={<Flecha />}
          />
          <Fila
            ini="↓"
            nombre="Exportar a CSV"
            sub="Tabla, partidos y bitácora"
            href={"/admin/exportar" as Route}
            derecha={<Flecha />}
          />
        </Lista>
      </main>
    </>
  );
}
