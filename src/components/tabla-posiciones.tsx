import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import type { FilaOrdenada } from "@/lib/ranking/tabla";
import { Segmentado } from "@/components/fila";

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

export function SelectorDivision({ actual }: { actual: DivisionTipo }) {
  return (
    <Segmentado
      etiqueta="División"
      actual={actual}
      opciones={[
        { valor: "mayor", etiqueta: "Mayor", href: "/?division=mayor" as Route },
        { valor: "menor", etiqueta: "Menor", href: "/?division=menor" as Route },
      ]}
    />
  );
}

export function LeyendaZonas({ division }: { division: DivisionTipo }) {
  const marca = (color: string, texto: string) => (
    <span>
      <i aria-hidden style={{ background: color }} />
      {texto}
    </span>
  );
  return (
    <p className="leyenda">
      {division === "mayor" ? (
        <>
          {marca("var(--uvg)", "Premian a los 3 primeros")}
          {marca("var(--rojo)", "Bajan los 3 últimos")}
        </>
      ) : (
        marca("var(--uvg)", "Suben los 3 primeros a Mayor")
      )}
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
      titulo={`Posiciones de la División ${division === "mayor" ? "Mayor" : "Menor"}`}
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
