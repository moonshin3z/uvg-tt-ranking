import type { Metadata, Route } from "next";
import Link from "next/link";
import { obtenerSesion } from "@/lib/auth/sesion";
import { partidosSemanales, rankingVigente } from "@/lib/ranking/consultas";
import { divisionLarga } from "@/lib/ranking/divisiones";
import {
  armarSemana,
  semanaActual,
  semanaPorDefecto,
  semanaTerminada,
  textoSemana,
  type FilaSemana,
} from "@/lib/ranking/semanas";
import { DIBUJO } from "@/components/iconos";
import { Fila, Lista, Marcador, Pie, Rotulo, Vacio, primerNombre } from "@/components/fila";
import { Tope } from "@/components/tope";
import { EnVivo } from "@/components/en-vivo";
import { CompartirSemana } from "./compartir";

export const metadata: Metadata = {
  title: "Semana",
  description: "Los partidos del ranking que se juegan esta semana, y sus resultados.",
};

const SITUACION: Record<FilaSemana["situacion"], string> = {
  por_jugar: "Por jugar",
  sin_confirmar: "Falta confirmar",
  en_disputa: "En disputa",
  jugado: "Jugado",
  no_se_jugo: "No se jugó",
};

/** Una fila: «A vs B» mientras no se juega, «A le ganó a B» con el marcador después. */
function FilaPartido({ p, conEnlace }: { p: FilaSemana; conEnlace: boolean }) {
  const hayResultado = p.ganador !== null && p.sets_a !== null && p.sets_b !== null;
  const ganoA = p.ganador === p.a.id;
  const ganador = ganoA ? p.a : p.b;
  const perdedor = ganoA ? p.b : p.a;
  const nota = [
    p.deLaSemana ? `De la semana ${p.deLaSemana}` : null,
    p.situacion === "jugado" && hayResultado ? null : SITUACION[p.situacion],
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Fila
      sinInicial
      envolver
      nombre={
        hayResultado
          ? `${ganador.nombre} le ganó a ${primerNombre(perdedor.nombre)}`
          : `${p.a.nombre} vs ${p.b.nombre}`
      }
      sub={nota || undefined}
      href={conEnlace ? (`/partidos/${p.id}` as Route) : undefined}
      derecha={
        hayResultado ? (
          <Marcador texto={ganoA ? `${p.sets_a}-${p.sets_b}` : `${p.sets_b}-${p.sets_a}`} gano={false} />
        ) : null
      }
    />
  );
}

export default async function PaginaSemana({ searchParams }: PageProps<"/semana">) {
  const [{ n }, ranking, sesion] = await Promise.all([searchParams, rankingVigente(), obtenerSesion()]);

  if (!ranking || !ranking.inicio_semanas) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
        <Tope titulo="Semana" sub="Partidos de la semana" />
        <Vacio
          dibujo={DIBUJO.trofeo}
          titulo="Todavía no hay semanas"
          detalle="Cuando el coordinador abra el ranking, los partidos se reparten en semanas y acá vas a ver cuáles tocan."
        >
          <Link href="/" className="btn gris">
            Ver la tabla
          </Link>
        </Vacio>
      </main>
    );
  }

  const inicio = ranking.inicio_semanas;
  const partidos = await partidosSemanales(ranking.id);
  const total = Math.max(0, ...partidos.filter((p) => p.estado !== "anulado").map((p) => p.semana ?? 0));
  const pedida = Number(Array.isArray(n) ? n[0] : n);
  const numero =
    Number.isInteger(pedida) && pedida >= 1 && pedida <= Math.max(total, 1)
      ? pedida
      : semanaPorDefecto(inicio, total);
  const semana = armarSemana(partidos, inicio, numero);
  const actual = semanaActual(inicio);
  const terminada = semanaTerminada(inicio, numero);
  const conEnlace = sesion !== null;

  const cuando =
    numero === actual
      ? "Esta semana"
      : numero === actual + 1
        ? "La semana que viene"
        : numero < actual
          ? "Ya pasó"
          : "Más adelante";
  const cuenta = semana.porDivision.reduce((n, d) => n + d.partidos.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
      <Tope titulo={`Semana ${numero}`} sub={`${textoSemana(inicio, numero)} · ${ranking.nombre}`} />
      <EnVivo />

      <nav aria-label="Semanas" className="paso-semana">
        {numero > 1 ? (
          <Link href={`/semana?n=${numero - 1}` as Route} scroll={false} aria-label={`Semana ${numero - 1}`}>
            ‹ Semana {numero - 1}
          </Link>
        ) : (
          <span aria-hidden />
        )}
        <span className="cual">{total > 0 ? `${numero} de ${total}` : ""}</span>
        {numero < total ? (
          <Link href={`/semana?n=${numero + 1}` as Route} scroll={false} aria-label={`Semana ${numero + 1}`}>
            Semana {numero + 1} ›
          </Link>
        ) : (
          <span aria-hidden />
        )}
      </nav>

      {cuenta === 0 ? (
        <Pie centro>No hay partidos repartidos en esta semana.</Pie>
      ) : (
        <>
          <Pie>
            {terminada
              ? `${cuando}. Así terminó: ${semana.jugados} de ${cuenta} jugados.`
              : `${cuando}: ${cuenta} partido${cuenta === 1 ? "" : "s"} para jugar martes, miércoles o jueves, cuando les quede a los dos.`}
          </Pie>
          {semana.porDivision.map((d) => (
            <section key={d.division}>
              <Rotulo>{divisionLarga(d.division)}</Rotulo>
              <Lista>
                {d.partidos.map((p) => (
                  <FilaPartido key={p.id} p={p} conEnlace={conEnlace} />
                ))}
              </Lista>
            </section>
          ))}
        </>
      )}

      {semana.pendientesAnteriores.length > 0 ? (
        <section>
          <Rotulo cuenta={semana.pendientesAnteriores.length}>Quedan de semanas anteriores</Rotulo>
          <Lista>
            {semana.pendientesAnteriores.map((p) => (
              <FilaPartido key={p.id} p={p} conEnlace={conEnlace} />
            ))}
          </Lista>
          <Pie>
            Se pueden jugar cualquier semana. Mientras no se jueguen no suman, y al final los decide el coordinador.
          </Pie>
        </section>
      ) : null}

      {cuenta > 0 ? (
        <CompartirSemana
          src={`/semana/imagen?n=${numero}`}
          archivo={`ranking-uvg-semana-${numero}.png`}
          texto={`${terminada ? "Resultados" : "Partidos"} de la semana ${numero} del ${ranking.nombre}`}
        />
      ) : null}

      <Pie centro>
        Se puede adelantar un partido de otra semana si los dos están de acuerdo.{" "}
        <Link href="/reglas" className="font-medium text-primary">
          Cómo funciona
        </Link>
      </Pie>
    </main>
  );
}
