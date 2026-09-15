import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DivisionTipo } from "@/lib/supabase/database.types";
import type { FilaOrdenada } from "@/lib/ranking/tabla";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ETIQUETA_ZONA: Record<NonNullable<FilaOrdenada["zona"]>, string> = {
  premio: "Premio",
  ascenso: "Sube",
  descenso: "Baja",
};

const CLASE_ZONA: Record<NonNullable<FilaOrdenada["zona"]>, string> = {
  premio: "border-l-zona-premio",
  ascenso: "border-l-zona-ascenso",
  descenso: "border-l-zona-descenso",
};

export function SelectorDivision({ actual }: { actual: DivisionTipo }) {
  const opciones: { valor: DivisionTipo; etiqueta: string }[] = [
    { valor: "mayor", etiqueta: "Mayor" },
    { valor: "menor", etiqueta: "Menor" },
  ];
  return (
    <nav aria-label="División" className="grid grid-cols-2 rounded-lg bg-secondary p-1">
      {opciones.map((o) => (
        <Link
          key={o.valor}
          href={{ pathname: "/", query: { division: o.valor } }}
          scroll={false}
          aria-current={o.valor === actual ? "page" : undefined}
          className={cn(
            "flex min-h-10 items-center justify-center rounded-md text-sm font-medium transition-colors",
            o.valor === actual
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.etiqueta}
        </Link>
      ))}
    </nav>
  );
}

export function TablaPosiciones({ filas, usuarioActualId }: { filas: FilaOrdenada[]; usuarioActualId?: string }) {
  if (filas.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay jugadores inscritos.</p>;
  }

  return (
    <Table className="tabular">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-8 text-right">#</TableHead>
          <TableHead>Jugador</TableHead>
          <TableHead className="w-10 text-right">PJ</TableHead>
          <TableHead className="w-10 text-right">PG</TableHead>
          <TableHead className="w-10 text-right">PP</TableHead>
          <TableHead className="w-12 text-right font-semibold text-foreground">Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((f) => (
          <TableRow
            key={f.usuario_id}
            className={cn(
              "border-l-4 border-l-transparent",
              f.zona && CLASE_ZONA[f.zona],
              f.usuario_id === usuarioActualId && "bg-primary/5 font-medium",
            )}
          >
            <TableCell className="text-right text-muted-foreground">{f.posicion}</TableCell>
            <TableCell className="max-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate">{f.nombre}</span>
                {f.zona ? (
                  <span className="sr-only sm:not-sr-only sm:text-xs sm:text-muted-foreground">
                    {ETIQUETA_ZONA[f.zona]}
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-right">{f.pj}</TableCell>
            <TableCell className="text-right">{f.pg}</TableCell>
            <TableCell className="text-right">{f.pp}</TableCell>
            <TableCell className="text-right font-semibold">{f.pts}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function LeyendaZonas({ division }: { division: DivisionTipo }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-1 rounded bg-zona-premio" /> Premio
      </li>
      {division === "menor" ? (
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded bg-zona-ascenso" /> Sube a Mayor
        </li>
      ) : (
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded bg-zona-descenso" /> Baja a Menor
        </li>
      )}
    </ul>
  );
}
