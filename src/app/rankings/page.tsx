import type { Metadata } from "next";
import Link from "next/link";
import { todosLosRankings } from "@/lib/ranking/consultas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <Tope titulo="Rankings" sub="Los que ya cerraron" atras="/" />
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Rankings</h1>
        <p className="text-sm text-muted-foreground">Todos los rankings del club, del más reciente al más viejo.</p>
      </header>

      {rankings.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay ninguno publicado.</p>
      ) : (
        <Card>
          <CardContent className="p-0 sm:p-0">
            <ul className="divide-y">
              {rankings.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/rankings/${r.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.nombre}</p>
                      <p className="text-xs text-muted-foreground">Fecha límite {formatearFecha(r.fecha_limite)}</p>
                    </div>
                    <Badge variant={r.estado === "cerrado" ? "outline" : "secondary"}>
                      {ETIQUETA[r.estado] ?? r.estado}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
    </>
  );
}
