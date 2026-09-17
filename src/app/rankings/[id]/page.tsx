import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { calendarioDeRanking, rankingPorId, tablaDeDivision } from "@/lib/ranking/consultas";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import { TablaPosiciones } from "@/components/tabla-posiciones";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Tope } from "@/components/tope";

export async function generateMetadata({ params }: PageProps<"/rankings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ranking = await rankingPorId(id);
  return { title: ranking?.nombre ?? "Ranking" };
}

const ETIQUETA: Record<string, string> = {
  abierto: "En juego",
  fase_regular_cerrada: "Fase regular cerrada",
  en_desempates: "En desempates",
  cerrado: "Terminado",
};

const ETIQUETA_PARTIDO: Record<string, string> = {
  pendiente: "Sin jugar",
  jugado: "Sin confirmar",
  disputado: "En disputa",
  anulado: "Anulado",
};

function Pestania({
  href,
  activa,
  children,
}: {
  href: React.ComponentProps<typeof Link>["href"];
  activa: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={activa ? "page" : undefined}
      className={cn(
        "flex min-h-10 flex-1 items-center justify-center rounded-md text-sm font-medium transition-colors",
        activa ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export default async function PaginaRanking({ params, searchParams }: PageProps<"/rankings/[id]">) {
  const [{ id }, { division: divParam, ver }, sesion] = await Promise.all([params, searchParams, obtenerSesion()]);

  const ranking = await rankingPorId(id);
  if (!ranking) notFound();

  const division: DivisionTipo = divParam === "menor" ? "menor" : "mayor";
  const verCalendario = ver === "calendario";

  const [filas, calendario] = await Promise.all([
    tablaDeDivision(ranking, division),
    verCalendario ? calendarioDeRanking(ranking.id) : Promise.resolve([]),
  ]);

  const deLaDivision = calendario.filter((p) => p.division === division);
  const base = `/rankings/${ranking.id}` as const;

  return (
    <>
      <Tope titulo={ranking.nombre} sub="Ranking cerrado" atras="/rankings" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-2">
          <Link href="/rankings" className="text-sm text-muted-foreground hover:underline">
            ← Todos los rankings
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{ranking.nombre}</h1>
            <Badge variant={ranking.estado === "cerrado" ? "outline" : "secondary"}>
              {ETIQUETA[ranking.estado] ?? ranking.estado}
            </Badge>
          </div>
        </header>

        <nav aria-label="División" className="grid grid-cols-2 rounded-lg bg-secondary p-1">
          {(["mayor", "menor"] as const).map((d) => (
            <Pestania
              key={d}
              href={{ pathname: base, query: verCalendario ? { division: d, ver: "calendario" } : { division: d } }}
              activa={d === division}
            >
              {d === "mayor" ? "Mayor" : "Menor"}
            </Pestania>
          ))}
        </nav>

        <nav aria-label="Vista" className="grid grid-cols-2 rounded-lg bg-secondary p-1">
          <Pestania href={{ pathname: base, query: { division } }} activa={!verCalendario}>
            Tabla
          </Pestania>
          <Pestania href={{ pathname: base, query: { division, ver: "calendario" } }} activa={verCalendario}>
            Calendario
          </Pestania>
        </nav>

        {!verCalendario ? (
          <>
            <Card>
              <CardContent className="p-0 sm:p-0">
                <TablaPosiciones filas={filas} division={division} usuarioActualId={sesion?.authId} />
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-0 sm:p-0">
              {deLaDivision.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground sm:p-6">No hay partidos en esta división.</p>
              ) : (
                <ul className="divide-y">
                  {deLaDivision.map((p) => {
                    const ganoA = p.ganador === p.jugador_a;
                    const definido = p.estado === "confirmado" || p.estado === "resuelto";
                    const sets = p.sets_a != null && p.sets_b != null ? `${p.sets_a}-${p.sets_b}` : null;
                    return (
                      <li key={p.id} className="flex items-center gap-2 px-4 py-2.5 text-sm sm:px-6">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <Link
                              href={`/jugador/${encodeURIComponent(p.a.carnet)}`}
                              className={cn("truncate hover:underline", definido && ganoA && "font-semibold")}
                            >
                              {p.a.nombre}
                            </Link>
                            <span className="shrink-0 text-xs text-muted-foreground">vs</span>
                            <Link
                              href={`/jugador/${encodeURIComponent(p.b.carnet)}`}
                              className={cn("truncate hover:underline", definido && !ganoA && "font-semibold")}
                            >
                              {p.b.nombre}
                            </Link>
                          </div>
                          {p.tipo === "desempate" ? (
                            <span className="text-xs text-muted-foreground">desempate</span>
                          ) : null}
                        </div>
                        {definido ? (
                          <span className="tabular shrink-0 font-medium">{sets ?? "jugado"}</span>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {ETIQUETA_PARTIDO[p.estado] ?? p.estado}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
