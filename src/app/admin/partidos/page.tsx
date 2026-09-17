import type { Metadata } from "next";
import Link from "next/link";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { rankingVigente } from "@/lib/ranking/consultas";
import { autoconfirmarVencidos } from "@/lib/partidos/consultas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioResolver } from "./formulario";

export const metadata: Metadata = { title: "Partidos" };

type Fila = {
  id: string;
  estado: string;
  tipo: string;
  ganador: string | null;
  sets_a: number | null;
  sets_b: number | null;
  registrado_en: string | null;
  disputa_motivo: string | null;
  division: { tipo: string };
  a: { id: string; nombre: string };
  b: { id: string; nombre: string };
};

function horasDesde(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
}

function Resultado({ p }: { p: Fila }) {
  if (!p.ganador) return <span className="text-muted-foreground">sin resultado</span>;
  const g = p.ganador === p.a.id ? p.a : p.b;
  const sets =
    p.sets_a != null ? ` ${p.ganador === p.a.id ? `${p.sets_a}-${p.sets_b}` : `${p.sets_b}-${p.sets_a}`}` : "";
  return (
    <span>
      ganó <span className="font-medium">{g.nombre}</span>
      {sets}
    </span>
  );
}

export default async function PaginaPartidosAdmin() {
  await requerirCoordinador();
  const ranking = await rankingVigente();
  if (!ranking || !["abierto", "en_desempates"].includes(ranking.estado)) {
    return <p className="text-muted-foreground">No hay un ranking en juego.</p>;
  }
  await autoconfirmarVencidos();

  const supabase = await createClient();
  const data = datos(
    await supabase
      .from("partido")
      .select(
        "id, estado, tipo, ganador, sets_a, sets_b, registrado_en, disputa_motivo, division!inner(tipo, ranking_id), a:usuario!partido_jugador_a_fkey(id, nombre), b:usuario!partido_jugador_b_fkey(id, nombre)",
      )
      .eq("division.ranking_id", ranking.id)
      .order("registrado_en", { ascending: false, nullsFirst: false }),
    "los partidos",
  );

  const todos = (data ?? []) as unknown as Fila[];
  const disputados = todos.filter((p) => p.estado === "disputado");
  const sinConfirmar = todos.filter((p) => p.estado === "jugado");
  const pendientes = todos.filter((p) => p.estado === "pendiente");
  const cerrados = todos.length - disputados.length - sinConfirmar.length - pendientes.length;

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Partidos</h1>
        <p className="text-sm text-muted-foreground">
          {ranking.nombre}: {cerrados} confirmados, {sinConfirmar.length} sin confirmar, {disputados.length} en
          disputa, {pendientes.length} sin jugar.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Disputas {disputados.length > 0 ? `(${disputados.length})` : ""}
          </CardTitle>
          <CardDescription>Hablá con los dos y decidí. Queda en la bitácora con tu nota.</CardDescription>
        </CardHeader>
        <CardContent>
          {disputados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguna abierta.</p>
          ) : (
            <ul className="divide-y">
              {disputados.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 py-3 text-sm">
                  <p>
                    <span className="font-medium">{p.a.nombre}</span> vs.{" "}
                    <span className="font-medium">{p.b.nombre}</span>{" "}
                    <Badge variant="outline" className="capitalize">
                      {p.division.tipo}
                    </Badge>
                  </p>
                  <p>
                    Registrado: <Resultado p={p} />
                  </p>
                  <p className="text-muted-foreground">Disputa: {p.disputa_motivo}</p>
                  <FormularioResolver partidoId={p.id} a={p.a} b={p.b} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sin confirmar {sinConfirmar.length > 0 ? `(${sinConfirmar.length})` : ""}
          </CardTitle>
          <CardDescription>
            Se confirman solos a las {ranking.horas_autoconfirmacion ?? "∞"} h. Podés resolverlos antes si hace falta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sinConfirmar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno.</p>
          ) : (
            <ul className="divide-y">
              {sinConfirmar.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 py-3 text-sm">
                  <p>
                    {p.a.nombre} vs. {p.b.nombre}: <Resultado p={p} />{" "}
                    <span className="text-muted-foreground">hace {horasDesde(p.registrado_en)} h</span>
                  </p>
                  <FormularioResolver partidoId={p.id} a={p.a} b={p.b} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sin jugar ({pendientes.length})</CardTitle>
          <CardDescription>Podés registrar un resultado por ellos (nace confirmado) o anularlo.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos jugados.</p>
          ) : (
            <ul className="divide-y">
              {pendientes.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p>
                      {p.a.nombre} vs. {p.b.nombre}{" "}
                      <Badge variant="outline" className="capitalize">
                        {p.division.tipo}
                      </Badge>
                    </p>
                    <Link
                      href={`/partidos/${p.id}`}
                      className="shrink-0 inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline"
                    >
                      Registrar
                    </Link>
                  </div>
                  <FormularioResolver partidoId={p.id} a={p.a} b={p.b} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
