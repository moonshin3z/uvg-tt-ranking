import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { cuadroDeTorneo, gruposDeTorneo, nombreDeRonda, torneoPorId } from "@/lib/torneos/consultas";
import { Pie, Rotulo, Segmentado } from "@/components/fila";
import { Tope } from "@/components/tope";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/torneos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await torneoPorId(id);
  return { title: t?.nombre ?? "Torneo" };
}

const ESTADO: Record<string, string> = {
  borrador: "Sin armar",
  inscripcion: "Inscripción abierta",
  en_juego: "En juego",
  cerrado: "Terminado",
};

/**
 * Un lado de una llave: el nombre y los sets. El que ganó va en negrita con
 * fondo verde lavado; un lugar todavía sin definir, en gris.
 */
function Lado({
  nombre,
  sets,
  gano,
  yo,
  bye = false,
}: {
  nombre: string | null;
  sets: number | null;
  gano: boolean;
  yo: boolean;
  /**
   * El lugar está vacío porque al rival le tocó pasar directo, no porque
   * falte definirlo. Se dice con todas las letras: dibujado como «por
   * definir», un bye se lee como un partido que falta, y con cinco jugadores
   * eso son tres lugares que parecen huecos del sistema.
   */
  bye?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1.5 px-[11px] py-[9px] text-[13.5px] not-first:border-t not-first:border-linea-suave",
        gano && "bg-uvg-suave font-semibold",
        !nombre && "text-faint",
      )}
    >
      <span className={cn("truncate", yo && "font-semibold")}>
        {nombre ?? (bye ? "pasa directo" : "por definir")}
      </span>
      <b className="shrink-0 font-bold">{sets ?? (nombre ? "-" : "")}</b>
    </div>
  );
}

export default async function PaginaTorneo({ params, searchParams }: PageProps<"/torneos/[id]">) {
  const [{ id }, { ver }, sesion] = await Promise.all([params, searchParams, obtenerSesion()]);
  const torneo = await torneoPorId(id);
  if (!torneo) notFound();

  const hayGrupos = torneo.formato === "grupos_y_llave";
  const vista = hayGrupos && ver === "grupos" ? "grupos" : "cuadro";
  const [cuadro, grupos] = await Promise.all([
    vista === "cuadro" ? cuadroDeTorneo(id) : Promise.resolve([]),
    vista === "grupos" ? gruposDeTorneo(id) : Promise.resolve([]),
  ]);

  const ultima = cuadro.reduce((n, l) => Math.max(n, l.ronda), 0);
  const rondas = [...new Set(cuadro.map((l) => l.ronda))].sort((a, b) => a - b);
  const yo = sesion?.authId;

  return (
    <>
      <Tope titulo={torneo.nombre} sub={ESTADO[torneo.estado] ?? torneo.estado} atras="/" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col bg-card pb-8">
        {hayGrupos ? (
          <Segmentado
            actual={vista}
            opciones={[
              { valor: "grupos", etiqueta: "Grupos", href: `/torneos/${id}?ver=grupos` as Route },
              { valor: "cuadro", etiqueta: "Cuadro", href: `/torneos/${id}?ver=cuadro` as Route },
            ]}
          />
        ) : null}

        {vista === "cuadro" ? (
          cuadro.length === 0 ? (
            <Pie>El cuadro todavía no está armado. Aparece cuando el coordinador sortea.</Pie>
          ) : (
            <>
              {/* Se desliza a lo ancho: un cuadro de 16 no cabe en un teléfono
                  y comprimirlo lo vuelve ilegible. */}
              <div className="flex gap-2.5 overflow-x-auto bg-card p-4">
                {rondas.map((r) => (
                  <div key={r} className="flex min-w-[136px] flex-1 flex-col justify-around gap-3">
                    <p className="text-center text-[13px] font-medium text-muted-foreground">
                      {nombreDeRonda(r, ultima)}
                    </p>
                    {cuadro
                      .filter((l) => l.ronda === r)
                      .map((l) => (
                        <div key={l.posicion} className="overflow-hidden rounded-md border border-border">
                          <Lado
                            bye={l.b != null && l.a == null && l.ganador != null}
                            nombre={l.a?.nombre ?? null}
                            sets={l.setsA}
                            gano={!!l.ganador && l.ganador === l.a?.id}
                            yo={!!yo && l.a?.id === yo}
                          />
                          <Lado
                            bye={l.a != null && l.b == null && l.ganador != null}
                            nombre={l.b?.nombre ?? null}
                            sets={l.setsB}
                            gano={!!l.ganador && l.ganador === l.b?.id}
                            yo={!!yo && l.b?.id === yo}
                          />
                        </div>
                      ))}
                  </div>
                ))}
              </div>
              <Pie>
                Se desliza a lo ancho. El ganador sube cuando el rival confirma, o solo al cumplirse el plazo.
              </Pie>
            </>
          )
        ) : grupos.length === 0 ? (
          <Pie>Los grupos todavía no están armados.</Pie>
        ) : (
          <>
            {grupos.map((g) => (
              <div key={g.nombre}>
                <Rotulo>Grupo {g.nombre}</Rotulo>
                <table className="w-full table-fixed border-collapse bg-card">
                  <caption className="sr-only">Grupo {g.nombre}</caption>
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
                        Dif
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.filas.map((f) => {
                      const clasifica = f.posicion <= (torneo.clasifican_por_grupo ?? 2);
                      const esYo = f.usuario_id === yo;
                      return (
                        <tr
                          key={f.usuario_id}
                          className={cn("border-t border-linea-suave", esYo && "font-bold text-foreground")}
                        >
                          <td
                            className={cn(
                              "h-[46px] border-l-[3px] border-l-transparent px-1 pl-[13px] text-right text-[14px] text-faint",
                              clasifica && "border-l-zona-ascenso",
                              esYo && "text-foreground",
                            )}
                          >
                            {f.posicion}
                          </td>
                          <th scope="row" className="h-[46px] truncate px-1 text-left font-[inherit] text-[15.5px]">
                            {f.nombre}
                            {f.empatado_sin_resolver ? (
                              <span className="ml-1.5 text-[12.5px] font-normal text-destructive">empate</span>
                            ) : null}
                          </th>
                          <td className="h-[46px] px-1 text-right text-[14px] text-muted-foreground">{f.pj}</td>
                          <td className="h-[46px] px-1 text-right text-[14px] text-muted-foreground">{f.pg}</td>
                          <td className="h-[46px] px-1 pr-4 text-right text-[16px] font-semibold">
                            {f.dif_sets > 0 ? `+${f.dif_sets}` : f.dif_sets}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
            <p className="flex flex-wrap gap-x-[18px] gap-y-1.5 px-4 pt-2 pb-3 text-[12.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-[7px]">
                <i aria-hidden className="inline-block h-3.5 w-[3px] rounded-[2px] bg-zona-ascenso" />
                Clasifican a la llave
              </span>
            </p>
          </>
        )}
      </main>
    </>
  );
}
