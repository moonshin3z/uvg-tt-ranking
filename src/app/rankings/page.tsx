import type { Metadata, Route } from "next";
import { todosLosRankings } from "@/lib/ranking/consultas";
import { Badge } from "@/components/ui/badge";
import { Fila, Flecha, Lista, Pie } from "@/components/fila";
import { formatearFecha } from "@/lib/fechas";
import { Tope } from "@/components/tope";

export const metadata: Metadata = { title: "Rankings" };

const ETIQUETA: Record<string, string> = {
  abierto: "En juego",
  fase_regular_cerrada: "Fase regular cerrada",
  en_desempates: "En desempates",
  cerrado: "Terminado",
};

export default async function PaginaRankings() {
  const rankings = await todosLosRankings();

  return (
    <>
      <Tope titulo="Rankings" sub="Del más reciente al más viejo" atras="/" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
        <div className="h-1.5" />
        {rankings.length === 0 ? (
          <Pie>Todavía no hay ninguno publicado.</Pie>
        ) : (
          <Lista>
            {rankings.map((r) => (
              <Fila
                key={r.id}
                sinInicial
                nombre={r.nombre}
                sub={`Fecha límite ${formatearFecha(r.fecha_limite)}`}
                href={`/rankings/${r.id}` as Route}
                derecha={
                  <>
                    <Badge variant={r.estado === "cerrado" ? "outline" : "default"}>
                      {ETIQUETA[r.estado] ?? r.estado}
                    </Badge>
                    <Flecha />
                  </>
                }
              />
            ))}
          </Lista>
        )}
      </main>
    </>
  );
}
