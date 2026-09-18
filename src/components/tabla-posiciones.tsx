import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import type { FilaOrdenada } from "@/lib/ranking/tabla";

/**
 * La tabla de posiciones, copiada de `docs/diseno/prototipo.html`.
 *
 * Es un `<table>` de verdad y no una rejilla de divs: con divs, un lector de
 * pantalla no anuncia ni filas ni columnas, y esta es la pantalla principal
 * de la aplicación.
 *
 * Las zonas se marcan con una barra de 3px en el borde izquierdo de la fila,
 * y la leyenda de arriba dice qué significa cada color. Tu fila va en negrita,
 * sin recuadro: un cuadro de color parecía un campo de formulario.
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
    <nav aria-label="División" className="mx-4 mt-3 mb-3.5 flex gap-0.5 rounded-md bg-linea-suave p-0.5">
      {opciones.map((o) => (
        <Link
          key={o.valor}
          href={{ pathname: "/", query: { division: o.valor } }}
          scroll={false}
          aria-current={o.valor === actual ? "page" : undefined}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center rounded-[6px] text-[14.5px] transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]",
            o.valor === actual
              ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(6,56,31,0.08)]"
              : "font-medium text-muted-foreground",
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
      <i aria-hidden className={cn("inline-block h-3.5 w-[3px] rounded-[2px]", color)} />
      {texto}
    </span>
  );
  return (
    <p className="flex flex-wrap gap-x-[18px] gap-y-1.5 px-4 pt-0.5 pb-3 text-[12.5px] text-muted-foreground">
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
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Todavía no hay jugadores inscritos.</p>;
  }

  return (
    <table className="w-full table-fixed border-collapse bg-card">
      <caption className="sr-only">Posiciones de la División {division === "mayor" ? "Mayor" : "Menor"}</caption>
      <colgroup>
        <col className="w-11" />
        <col />
        <col className="w-8" />
        <col className="w-8" />
        <col className="w-12" />
      </colgroup>
      <thead>
        <tr className="text-[12.5px] text-faint">
          <th scope="col" className="px-1 pb-[9px] pl-4 text-right font-normal">
            #
          </th>
          <th scope="col" className="px-1 pb-[9px] text-left font-normal">
            Jugador
          </th>
          <th scope="col" className="px-1 pb-[9px] text-right font-normal">
            PJ
          </th>
          <th scope="col" className="px-1 pb-[9px] text-right font-normal">
            PG
          </th>
          <th scope="col" className="px-1 pr-4 pb-[9px] text-right font-normal">
            Pts
          </th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const yo = f.usuario_id === usuarioActualId;
          return (
            <tr key={f.usuario_id} className={cn("border-t border-linea-suave", yo && "font-bold text-foreground")}>
              <td
                className={cn(
                  "h-[46px] border-l-[3px] border-l-transparent px-1 pl-[13px] text-right text-[14px] text-faint",
                  f.zona === "descenso" && "border-l-zona-descenso",
                  f.zona === "premio" && "border-l-zona-premio",
                  f.zona === "ascenso" && "border-l-zona-ascenso",
                  yo && "text-foreground",
                )}
              >
                {f.posicion}
              </td>
              <th scope="row" className="h-[46px] px-1 text-left font-[inherit] text-[15.5px]">
                {/* El enlace ocupa la fila entera, no solo la línea de texto.
                    Medía 23px de alto: para tocar el nombre había que apuntar
                    a una franja más angosta que el dedo. */}
                <Link
                  href={`/jugador/${encodeURIComponent(f.carnet)}` as Route}
                  className="flex h-[46px] items-center truncate"
                >
                  <span className="truncate">{f.nombre}</span>
                </Link>
              </th>
              <td
                className={cn("h-[46px] px-1 text-right text-[14px] text-muted-foreground", yo && "text-foreground")}
              >
                {f.pj}
              </td>
              <td
                className={cn("h-[46px] px-1 text-right text-[14px] text-muted-foreground", yo && "text-foreground")}
              >
                {f.pg}
              </td>
              <td className="h-[46px] px-1 pr-4 text-right text-[16px] font-semibold">{f.pts}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
