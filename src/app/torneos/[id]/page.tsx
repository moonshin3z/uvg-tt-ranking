import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { cuadroDeTorneo, gruposDeTorneo, nombreDeRonda, torneoPorId } from "@/lib/torneos/consultas";
import { Pie, Rotulo, Segmentado } from "@/components/fila";
import { Tabla } from "@/components/tabla-posiciones";
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
 * Un lado de una llave: el nombre y los sets. El que ganó va en negrita, con
 * sus sets en verde; un lugar todavía sin definir, en gris claro.
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
   * El lugar está vacío porque al de al lado le tocó BYE y pasa sin jugar, no
   * porque falte definir al rival. Son dos cosas distintas y se dicen
   * distinto: dibujados los dos como «por definir», los byes se leen como
   * partidos que faltan, y con cinco jugadores eso son tres lugares que
   * parecen huecos del sistema.
   */
  bye?: boolean;
}) {
  return (
    <div className={cn("lado", gano && "gana", !nombre && "vacio-lado")}>
      <span className={cn(yo && "font-semibold")}>{nombre ?? (bye ? "BYE" : "Por definir")}</span>
      <b>{sets ?? (nombre ? "–" : "")}</b>
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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
        <div className="h-1.5" />
        {hayGrupos ? (
          <Segmentado
            etiqueta="Vista del torneo"
            actual={vista}
            opciones={[
              { valor: "grupos", etiqueta: "Grupos", href: `/torneos/${id}?ver=grupos` as Route },
              { valor: "cuadro", etiqueta: "Cuadro", href: `/torneos/${id}?ver=cuadro` as Route },
            ]}
          />
        ) : null}

        {vista === "cuadro" ? (
          cuadro.length === 0 ? (
            <Pie>El cuadro todavía no está armado. Aparece cuando el coordinador lo arme.</Pie>
          ) : (
            <>
              {/* Se desliza a lo ancho: un cuadro de 16 no cabe en un teléfono
                  y comprimirlo lo vuelve ilegible. */}
              <div className="cuadro">
                {rondas.map((r) => (
                  <div key={r} className="ronda">
                    <p className="rh">{nombreDeRonda(r, ultima)}</p>
                    {cuadro
                      .filter((l) => l.ronda === r)
                      .map((l) => (
                        <div key={l.posicion} className="llave">
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
                <Tabla
                  titulo={`Grupo ${g.nombre}`}
                  ultima="Dif"
                  filas={g.filas.map((f) => ({
                    id: f.usuario_id,
                    posicion: f.posicion,
                    nombre: f.nombre,
                    pj: f.pj,
                    pg: f.pg,
                    ultima: f.dif_sets > 0 ? `+${f.dif_sets}` : f.dif_sets < 0 ? `−${-f.dif_sets}` : "0",
                    zona: f.posicion <= (torneo.clasifican_por_grupo ?? 2) ? "bueno" : null,
                    yo: f.usuario_id === yo,
                    marca: f.empatado_sin_resolver ? "empate" : undefined,
                  }))}
                />
              </div>
            ))}
            <Pie>
              {torneo.clasifican_por_grupo === 1
                ? "El primero de cada grupo pasa a la llave."
                : `Los ${torneo.clasifican_por_grupo ?? 2} primeros de cada grupo pasan a la llave.`}
            </Pie>
          </>
        )}
      </main>
    </>
  );
}
