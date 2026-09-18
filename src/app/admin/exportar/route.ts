import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { createClient } from "@/lib/supabase/server";
import { rankingVigente } from "@/lib/ranking/consultas";
import { datos } from "@/lib/supabase/errores";

/**
 * Exporta la tabla o los resultados en CSV (se abre directo en Excel).
 * Lleva BOM para que Excel respete los acentos.
 */

function csv(filas: (string | number | null)[][]): string {
  const escapar = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + filas.map((f) => f.map(escapar).join(";")).join("\r\n");
}

function respuesta(nombre: string, contenido: string) {
  return new NextResponse(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.rol !== "coordinador") {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const tipo = request.nextUrl.searchParams.get("tipo") ?? "tabla";
  const rankingId = request.nextUrl.searchParams.get("ranking");
  const supabase = await createClient();

  const ranking = rankingId
    ? datos(await supabase.from("ranking").select("*").eq("id", rankingId).maybeSingle(), "el ranking")
    : await rankingVigente();
  if (!ranking) return new NextResponse("No hay ranking", { status: 404 });

  const slug = ranking.nombre.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

  if (tipo === "resultados") {
    const data = datos(
      await supabase
        .from("partido")
        .select(
          "tipo, estado, sets_a, sets_b, confirmado_en, division!inner(tipo, ranking_id), a:usuario!partido_jugador_a_fkey(nombre, carnet), b:usuario!partido_jugador_b_fkey(nombre, carnet), ganador",
        )
        .eq("division.ranking_id", ranking.id)
        .order("confirmado_en", { ascending: true, nullsFirst: false }),
      "los resultados del ranking",
    );

    type Fila = {
      tipo: string;
      estado: string;
      sets_a: number | null;
      sets_b: number | null;
      confirmado_en: string | null;
      ganador: string | null;
      division: { tipo: string };
      a: { nombre: string; carnet: string };
      b: { nombre: string; carnet: string };
    };

    const filas: (string | number | null)[][] = [
      [
        "División",
        "Tipo",
        "Jugador A",
        "Carnet A",
        "Jugador B",
        "Carnet B",
        "Sets A",
        "Sets B",
        "Ganador",
        "Estado",
        "Fecha",
      ],
      ...((data ?? []) as unknown as Fila[]).map((p) => [
        p.division.tipo,
        p.tipo,
        p.a.nombre,
        p.a.carnet,
        p.b.nombre,
        p.b.carnet,
        p.sets_a,
        p.sets_b,
        p.ganador
          ? p.ganador === null
            ? ""
            : p.sets_a != null && p.sets_a > (p.sets_b ?? 0)
              ? p.a.nombre
              : p.b.nombre
          : "",
        p.estado,
        p.confirmado_en ? p.confirmado_en.slice(0, 10) : "",
      ]),
    ];
    return respuesta(`resultados-${slug}`, csv(filas));
  }

  const divisiones = datos(
    await supabase.from("division").select("id, tipo").eq("ranking_id", ranking.id),
    "las divisiones del ranking",
  );
  const filas: (string | number | null)[][] = [["División", "Pos", "Jugador", "Carnet", "PJ", "PG", "PP", "Pts"]];

  for (const d of divisiones ?? []) {
    const [posRespuesta, tablaRespuesta] = await Promise.all([
      supabase.rpc("posiciones_division", { p_division_id: d.id }),
      supabase.from("tabla_posiciones").select("usuario_id, carnet, pj, pg, pp").eq("division_id", d.id),
    ]);
    const pos = datos(posRespuesta, "las posiciones de la división");
    const tabla = datos(tablaRespuesta, "la tabla de la división");
    const porId = new Map((tabla ?? []).map((t) => [t.usuario_id, t]));
    for (const p of (pos ?? []).sort((x, y) => x.posicion - y.posicion)) {
      const t = porId.get(p.usuario_id);
      filas.push([d.tipo, p.posicion, p.nombre, t?.carnet ?? "", t?.pj ?? 0, t?.pg ?? 0, t?.pp ?? 0, p.pts]);
    }
  }

  return respuesta(`tabla-${slug}`, csv(filas));
}
