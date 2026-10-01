import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { partidosSemanales, rankingVigente } from "@/lib/ranking/consultas";
import { divisionLarga } from "@/lib/ranking/divisiones";
import { armarSemana, semanaPorDefecto, semanaTerminada, textoSemana, type FilaSemana } from "@/lib/ranking/semanas";

/**
 * La imagen de la semana, para mandar al grupo: los partidos que tocan y,
 * cuando la semana termina, cómo salieron.
 *
 * Es una ruta y no una captura del navegador para que salga igual en cualquier
 * teléfono: ancho fijo de 1080, alto según cuántos partidos hay. Inter va como
 * TTF porque el generador no lee woff2; son las mismas letras de la app,
 * recortadas a los caracteres del español.
 */

const VERDE = "#0b9e51";
const VERDE_HONDO = "#06381f";
const TEXTO = "#111113";
const GRIS = "#6c6c70";
const LINEA = "#e5e5ea";

const fuentes = Promise.all([
  readFile(join(process.cwd(), "src/fonts/inter-og-400.ttf")),
  readFile(join(process.cwd(), "src/fonts/inter-og-700.ttf")),
]);

const NOTA: Record<FilaSemana["situacion"], string | null> = {
  por_jugar: null,
  sin_confirmar: "Falta confirmar",
  en_disputa: "En disputa",
  jugado: null,
  no_se_jugo: "No se jugó",
};

function Partido({ p, ultimo }: { p: FilaSemana; ultimo: boolean }) {
  const hayResultado = p.ganador !== null && p.sets_a !== null && p.sets_b !== null;
  const ganoA = p.ganador === p.a.id;
  const nota = [p.deLaSemana ? `De la semana ${p.deLaSemana}` : null, NOTA[p.situacion]].filter(Boolean).join(" · ");
  const nombre = (lado: "a" | "b") => {
    const gano = hayResultado && (lado === "a") === ganoA;
    return {
      fontWeight: gano ? 700 : 400,
      color: hayResultado && !gano ? GRIS : TEXTO,
    } as const;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "26px 36px",
        borderBottom: ultimo ? "none" : `2px solid ${LINEA}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", fontSize: 36 }}>
        <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", textAlign: "right", ...nombre("a") }}>
          {p.a.nombre}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: 150,
            margin: "0 20px",
            padding: "8px 0",
            borderRadius: 999,
            background: hayResultado ? VERDE : "#f2f2f7",
            color: hayResultado ? "#fff" : GRIS,
            fontWeight: 700,
            fontSize: hayResultado ? 36 : 30,
          }}
        >
          {hayResultado ? `${p.sets_a} - ${p.sets_b}` : "vs"}
        </div>
        <div style={{ display: "flex", flex: 1, ...nombre("b") }}>{p.b.nombre}</div>
      </div>
      {nota ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10, fontSize: 26, color: GRIS }}>
          {nota}
        </div>
      ) : null}
    </div>
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ranking = await rankingVigente();
  if (!ranking?.inicio_semanas) return new Response("Todavía no hay semanas", { status: 404 });

  const inicio = ranking.inicio_semanas;
  const partidos = await partidosSemanales(ranking.id);
  const total = Math.max(0, ...partidos.filter((p) => p.estado !== "anulado").map((p) => p.semana ?? 0));
  const pedida = Number(url.searchParams.get("n"));
  const numero =
    Number.isInteger(pedida) && pedida >= 1 && pedida <= Math.max(total, 1)
      ? pedida
      : semanaPorDefecto(inicio, total);
  const semana = armarSemana(partidos, inicio, numero);
  const terminada = semanaTerminada(inicio, numero);

  const filas = semana.porDivision.reduce((n, d) => n + d.partidos.length, 0);
  const conNota = semana.porDivision.reduce(
    (n, d) => n + d.partidos.filter((p) => p.deLaSemana || NOTA[p.situacion]).length,
    0,
  );
  const alto = 400 + semana.porDivision.length * 110 + filas * 112 + conNota * 40 + 150;

  const [regular, negrita] = await fuentes;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f2f2f7",
        fontFamily: "Inter",
        color: TEXTO,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "64px 64px 56px",
          backgroundImage: `linear-gradient(135deg, #1dbb68 0%, ${VERDE} 45%, ${VERDE_HONDO} 100%)`,
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, opacity: 0.8 }}>
          {`RANKING UVG · ${ranking.nombre.toUpperCase()}`}
        </div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 104, fontWeight: 700, lineHeight: 1 }}>
          {`Semana ${numero}`}
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 40, opacity: 0.92 }}>
          {`${terminada ? "Resultados" : "Partidos"} · ${textoSemana(inicio, numero)}`}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "36px 48px 0" }}>
        {semana.porDivision.map((d) => (
          <div key={d.division} style={{ display: "flex", flexDirection: "column", marginBottom: 30 }}>
            <div
              style={{
                display: "flex",
                padding: "0 12px 14px",
                fontSize: 28,
                fontWeight: 700,
                color: GRIS,
                letterSpacing: 1,
              }}
            >
              {divisionLarga(d.division).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 32 }}>
              {d.partidos.map((p, i) => (
                <Partido key={p.id} p={p} ultimo={i === d.partidos.length - 1} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "auto",
          padding: "10px 48px 48px",
          fontSize: 26,
          color: GRIS,
        }}
      >
        {terminada
          ? `${semana.jugados} de ${filas} jugados · ${url.host}`
          : `Martes, miércoles o jueves, cuando les quede · ${url.host}`}
      </div>
    </div>,
    {
      width: 1080,
      height: alto,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: negrita, weight: 700, style: "normal" },
      ],
      headers: { "Cache-Control": "no-store" },
    },
  );
}
