import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import type { FilaOrdenada } from "@/lib/ranking/tabla";
import { SEG_OPCION, SEG_PILDORA, SEG_PISTA, pildora } from "@/components/fila";

/**
 * La tabla de posiciones, copiada de `docs/diseno/prototipo.html`.
 *
 * Es un `<table>` de verdad y no una rejilla de divs: con divs, un lector de
 * pantalla no anuncia ni filas ni columnas, y esta es la pantalla principal
 * de la aplicación.
 *
 * Va dentro de una tarjeta. Las zonas se marcan con el número de posición
 * dentro de un círculo verde (premio o ascenso) o rojo (descenso), y la
 * leyenda de arriba dice qué significa cada color. Tu fila va en negrita con
 * un fondo verde apenas visible. Las filas entran en cascada al aparecer.
 *
 * Sin columna PP: con PJ y PG ya se sabe cuántos perdió, y en un teléfono
 * angosto esa columna le come ancho al nombre.
 */

export function SelectorDivision({ actual }: { actual: DivisionTipo }) {
  const opciones: { valor: DivisionTipo; etiqueta: string }[] = [
    { valor: "mayor", etiqueta: "Mayor" },
    { valor: "menor", etiqueta: "Menor" },
  ];
  return (
    <nav aria-label="División" className={SEG_PISTA}>
      <span
        aria-hidden
        className={SEG_PILDORA}
        style={pildora(
          opciones.findIndex((o) => o.valor === actual),
          opciones.length,
        )}
      />
      {opciones.map((o) => (
        <Link
          key={o.valor}
          href={{ pathname: "/", query: { division: o.valor } }}
          scroll={false}
          aria-current={o.valor === actual ? "page" : undefined}
          className={cn(
            SEG_OPCION,
            o.valor === actual ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
          )}
        >
          {o.etiqueta}
        </Link>
      ))}
    </nav>
  );
}

export function LeyendaZonas({ division }: { division: DivisionTipo }) {
  const marca = (color: string, texto: string) => (
    <span className="inline-flex items-center gap-[7px]">
      <i aria-hidden className={cn("inline-block size-[9px] rounded-full", color)} />
      {texto}
    </span>
  );
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 pt-0.5 pb-3 text-[12.5px] text-muted-foreground">
      {division === "mayor" ? (
        <>
          {marca("bg-zona-premio", "Premian a los 3 primeros")}
          {marca("bg-zona-descenso", "Bajan los 3 últimos")}
        </>
      ) : (
        marca("bg-zona-ascenso", "Suben los 3 primeros a Mayor")
      )}
    </p>
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
    return (
      <p className="tarjeta px-4 py-8 text-center text-sm text-muted-foreground">
        Todavía no hay jugadores inscritos.
      </p>
    );
  }

  return (
    <div className="tarjeta">
      <table className="tabla-anim w-full table-fixed border-collapse">
        <caption className="sr-only">Posiciones de la División {division === "mayor" ? "Mayor" : "Menor"}</caption>
        <colgroup>
          <col className="w-12" />
          <col />
          <col className="w-8" />
          <col className="w-8" />
          <col className="w-12" />
        </colgroup>
        <thead>
          <tr className="text-[12.5px] text-faint">
            <th scope="col" className="px-1 pt-3 pb-[7px] pl-4 text-left font-normal">
              #
            </th>
            <th scope="col" className="px-1 pt-3 pb-[7px] text-left font-normal">
              Jugador
            </th>
            <th scope="col" className="px-1 pt-3 pb-[7px] text-right font-normal">
              PJ
            </th>
            <th scope="col" className="px-1 pt-3 pb-[7px] text-right font-normal">
              PG
            </th>
            <th scope="col" className="px-1 pt-3 pr-4 pb-[7px] text-right font-normal">
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, n) => {
            const yo = f.usuario_id === usuarioActualId;
            const arriba = f.zona === "premio" || f.zona === "ascenso";
            return (
              <tr
                key={f.usuario_id}
                style={{ "--n": n } as React.CSSProperties}
                className={cn("border-t border-linea-suave", yo && "bg-[#f4faf6] font-bold text-foreground")}
              >
                <td className="h-12 px-1 pl-3 text-left">
                  <span
                    className={cn(
                      "inline-grid size-7 place-items-center rounded-full text-[13.5px]",
                      arriba && "bg-uvg-suave font-bold text-primary",
                      f.zona === "descenso" && "bg-malo-suave font-semibold text-destructive",
                      !f.zona && (yo ? "text-foreground" : "text-faint"),
                    )}
                  >
                    {f.posicion}
                  </span>
                </td>
                <th scope="row" className="h-12 px-1 text-left font-[inherit] text-[15.5px]">
                  {/* El enlace ocupa la fila entera, no solo la línea de texto.
                    Medía 23px de alto: para tocar el nombre había que apuntar
                    a una franja más angosta que el dedo. */}
                  <Link
                    href={`/jugador/${encodeURIComponent(f.carnet)}` as Route}
                    className="flex h-12 items-center truncate"
                  >
                    <span className="truncate">{f.nombre}</span>
                  </Link>
                </th>
                <td className={cn("h-12 px-1 text-right text-[14px] text-muted-foreground", yo && "text-foreground")}>
                  {f.pj}
                </td>
                <td className={cn("h-12 px-1 text-right text-[14px] text-muted-foreground", yo && "text-foreground")}>
                  {f.pg}
                </td>
                <td className="h-12 px-1 pr-4 text-right text-[16px] font-semibold">{f.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
