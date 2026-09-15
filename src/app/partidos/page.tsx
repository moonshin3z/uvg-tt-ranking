import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import { rankingVigente } from "@/lib/ranking/consultas";
import { autoconfirmarVencidos, misPartidos, type PartidoMio } from "@/lib/partidos/consultas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonDisputar, BotonesConfirmar } from "./formularios";

export const metadata: Metadata = { title: "Mis partidos" };

function Marcador({ p }: { p: PartidoMio }) {
  if (p.estado === "anulado") return <Badge variant="outline">Anulado</Badge>;
  if (p.gane === null) return null;
  return (
    <span className={p.gane ? "font-semibold text-zona-ascenso" : "font-semibold text-muted-foreground"}>
      {p.gane ? "Gané" : "Perdí"}
      {p.sets ? ` ${p.sets}` : ""}
    </span>
  );
}

function Fila({ p, children }: { p: PartidoMio; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">vs. {p.rival.nombre}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {p.division}
            {p.tipo === "desempate" ? " · desempate" : ""}
          </p>
        </div>
        <Marcador p={p} />
      </div>
      {children}
    </li>
  );
}

function Seccion({
  titulo,
  partidos,
  vacio,
  children,
}: {
  titulo: string;
  partidos: PartidoMio[];
  vacio: string;
  children: (p: PartidoMio) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {titulo} {partidos.length > 0 ? <span className="text-muted-foreground">({partidos.length})</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {partidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vacio}</p>
        ) : (
          <ul className="divide-y">{partidos.map(children)}</ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function PaginaMisPartidos({ searchParams }: PageProps<"/partidos">) {
  const [{ registrado }, sesion, ranking] = await Promise.all([searchParams, requerirSesion(), rankingVigente()]);
  if (sesion.usuario.debe_cambiar_pin) redirect("/cambiar-pin");

  if (!ranking || !["abierto", "en_desempates"].includes(ranking.estado)) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Mis partidos</h1>
        <p className="text-muted-foreground">No hay un ranking en juego ahora mismo.</p>
      </main>
    );
  }

  await autoconfirmarVencidos();
  const mp = await misPartidos(sesion.authId, ranking.id);
  const inscrito =
    mp.pendientes.length +
      mp.porConfirmar.length +
      mp.esperandoRival.length +
      mp.enDisputa.length +
      mp.historial.length >
    0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Mis partidos</h1>
        <p className="text-sm text-muted-foreground">{ranking.nombre}</p>
      </header>

      {registrado ? (
        <p role="status" className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          Resultado registrado. Tu rival tiene {ranking.horas_autoconfirmacion ?? "un tiempo"}
          {ranking.horas_autoconfirmacion ? " horas" : ""} para confirmarlo.
        </p>
      ) : null}

      {!inscrito ? (
        <p className="text-muted-foreground">No estás inscrito en este ranking. Hablá con el coordinador.</p>
      ) : (
        <>
          <Seccion titulo="Por confirmar" partidos={mp.porConfirmar} vacio="Nada pendiente de tu parte.">
            {(p) => (
              <Fila key={p.id} p={p}>
                <p className="text-sm">
                  {p.rival.nombre.split(" ")[0]} registró:{" "}
                  <span className="font-medium">{p.gane ? "ganaste vos" : "ganó él"}</span>
                  {p.sets ? ` (${p.sets})` : ""}
                </p>
                <BotonesConfirmar partidoId={p.id} />
              </Fila>
            )}
          </Seccion>

          <Seccion titulo="Pendientes" partidos={mp.pendientes} vacio="Ya jugaste todos tus partidos.">
            {(p) => (
              <Fila key={p.id} p={p}>
                <Button asChild variant="outline" size="sm" className="self-start">
                  <Link href={`/partidos/${p.id}`}>Registrar resultado</Link>
                </Button>
              </Fila>
            )}
          </Seccion>

          {mp.esperandoRival.length > 0 ? (
            <Seccion titulo="Esperando confirmación del rival" partidos={mp.esperandoRival} vacio="">
              {(p) => (
                <Fila key={p.id} p={p}>
                  <Link
                    href={`/partidos/${p.id}`}
                    className="self-start text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Corregir
                  </Link>
                </Fila>
              )}
            </Seccion>
          ) : null}

          {mp.enDisputa.length > 0 ? (
            <Seccion titulo="En disputa" partidos={mp.enDisputa} vacio="">
              {(p) => (
                <Fila key={p.id} p={p}>
                  <p className="text-sm text-muted-foreground">
                    El coordinador lo va a resolver. Motivo: {p.disputaMotivo}
                  </p>
                </Fila>
              )}
            </Seccion>
          ) : null}

          <Seccion titulo="Jugados" partidos={mp.historial} vacio="Todavía no tenés resultados confirmados.">
            {(p) => (
              <Fila key={p.id} p={p}>
                {p.estado === "resuelto" && p.resolucion ? (
                  <p className="text-xs text-muted-foreground">Resuelto por el coordinador: {p.resolucion}</p>
                ) : null}
                {p.estado === "confirmado" ? (
                  <div className="self-start">
                    <BotonDisputar partidoId={p.id} />
                  </div>
                ) : null}
              </Fila>
            )}
          </Seccion>
        </>
      )}
    </main>
  );
}
