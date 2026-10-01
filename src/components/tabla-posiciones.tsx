import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import type { FilaOrdenada } from "@/lib/ranking/tabla";
import { Segmentado } from "@/components/fila";
import { divisionLarga, nombreDivision } from "@/lib/ranking/divisiones";

/**
 * La tabla de posiciones, copiada del prototipo de iOS.
 *
 * Es un `<table>` de verdad y no una rejilla de divs: con divs, un lector de
 * pantalla no anuncia ni filas ni columnas, y esta es la pantalla principal
 * de la aplicación.
 *
 * Va dentro de un bloque blanco. Las zonas se marcan con el número de
 * posición: en un círculo verde lleno los que ganan premio o suben, en rojo
 * lavado los que bajan; la leyenda de arriba dice qué significa cada color.
 * Tu fila va en negrita con un fondo verde apenas visible. Las filas entran
 * en cascada al aparecer.
 *
 * Sin columna PP: con PJ y PG ya se sabe cuántos perdió, y en un teléfono
 * angosto esa columna le come ancho al nombre.
 */

export function SelectorDivision({
  actual,
  divisiones,
  href = (d) => `/?division=${d}` as Route,
}: {
  actual: DivisionTipo;
  divisiones: readonly DivisionTipo[];
  href?: (division: DivisionTipo) => Route;
}) {
  return (
    <Segmentado
      etiqueta="División"
      actual={actual}
      opciones={divisiones.map((d) => ({ valor: d, etiqueta: nombreDivision(d), href: href(d) }))}
    />
  );
}

const losPrimeros = (n: number) => (n === 1 ? "el primero" : `los ${n} primeros`);
const losUltimos = (n: number) => (n === 1 ? "el último" : `los ${n} últimos`);

/** Qué pasa en esta división: con los números del ranking, no escritos a mano. */
export function LeyendaZonas({
  division,
  divisiones,
  n_premiados,
  n_ascienden,
  n_descienden,
}: {
  division: DivisionTipo;
  divisiones: readonly DivisionTipo[];
  n_premiados: number;
  n_ascienden: number;
  n_descienden: number;
}) {
  const nivel = divisiones.indexOf(division);
  const arriba = nivel > 0 ? divisiones[nivel - 1] : null;
  const abajo = nivel >= 0 && nivel < divisiones.length - 1 ? divisiones[nivel + 1] : null;
  const marca = (color: string, texto: string) => (
    <span>
      <i aria-hidden style={{ background: color }} />
      {texto}
    </span>
  );
  const suben = (n: number) => (n === 1 ? "Sube" : "Suben");
  const bajan = (n: number) => (n === 1 ? "Baja" : "Bajan");
  return (
    <p className="leyenda">
      {arriba
        ? marca(
            "var(--uvg)",
            `${suben(n_ascienden)} ${losPrimeros(n_ascienden)} a ${nombreDivision(arriba)}${n_premiados >= n_ascienden && n_premiados > 0 ? " y ganan premio" : ""}`,
          )
        : n_premiados > 0
          ? marca("var(--uvg)", `Premian a ${losPrimeros(n_premiados)}`)
          : null}
      {abajo
        ? marca("var(--rojo)", `${bajan(n_descienden)} ${losUltimos(n_descienden)} a ${nombreDivision(abajo)}`)
        : null}
    </p>
  );
}

/** Una fila de una tabla de posiciones, de ranking o de grupo de torneo. */
export type FilaTablaVista = {
  id: string;
  posicion: number;
  nombre: string;
  /** El perfil del jugador; sin esto el nombre no es enlace. */
  href?: Route;
  pj: number;
  pg: number;
  /** Lo de la última columna: puntos, o diferencia de sets en un grupo. */
  ultima: React.ReactNode;
  zona: "bueno" | "malo" | null;
  yo: boolean;
  /** Una nota en rojo al lado del nombre: «empate». */
  marca?: string;
};

export function Tabla({
  filas,
  titulo,
  ultima = "Pts",
}: {
  filas: FilaTablaVista[];
  /** Para lectores de pantalla: qué tabla es. */
  titulo: string;
  ultima?: string;
}) {
  return (
    <div className="grupo anim-filas">
      <table className="tabla">
        <caption className="sr-only">{titulo}</caption>
        <colgroup>
          <col className="c-pos" />
          <col />
          <col className="c-n" />
          <col className="c-n" />
          <col className="c-pts" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" className="tnom">
              Jugador
            </th>
            <th scope="col">PJ</th>
            <th scope="col">PG</th>
            <th scope="col">{ultima}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, n) => (
            <tr
              key={f.id}
              style={{ "--n": n } as React.CSSProperties}
              className={cn(f.zona === "bueno" && "z-bueno", f.zona === "malo" && "z-malo", f.yo && "yo")}
            >
              <td>
                <span className="npos">{f.posicion}</span>
              </td>
              <th scope="row" className="tnom">
                {/* El enlace ocupa la fila entera de alto, no solo la línea
                    de texto: para tocar el nombre no hay que apuntar. */}
                {f.href ? (
                  <Link href={f.href}>
                    <span>{f.nombre}</span>
                    {f.marca ? <span className="empate">{f.marca}</span> : null}
                  </Link>
                ) : (
                  <>
                    {f.nombre}
                    {f.marca ? <span className="empate">{f.marca}</span> : null}
                  </>
                )}
              </th>
              <td className="tnum">{f.pj}</td>
              <td className="tnum">{f.pg}</td>
              <td className="tpts">{f.ultima}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TablaPosiciones({
  filas,
  division,
  usuarioActualId,
}: {
  filas: FilaOrdenada[];
  division: DivisionTipo;
  usuarioActualId?: string;
}) {
  if (filas.length === 0) {
    return <p className="alerta neutra">Todavía no hay jugadores inscritos.</p>;
  }

  return (
    <Tabla
      titulo={`Posiciones de ${divisionLarga(division)}`}
      filas={filas.map((f) => ({
        id: f.usuario_id,
        posicion: f.posicion,
        nombre: f.nombre,
        href: `/jugador/${encodeURIComponent(f.carnet)}` as Route,
        pj: f.pj,
        pg: f.pg,
        ultima: f.pts,
        zona: f.zona === "premio" || f.zona === "ascenso" ? "bueno" : f.zona === "descenso" ? "malo" : null,
        yo: f.usuario_id === usuarioActualId,
      }))}
    />
  );
}
