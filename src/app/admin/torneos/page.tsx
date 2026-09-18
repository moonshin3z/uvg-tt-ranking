import type { Metadata, Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gestion } from "@/app/admin/gestion";
import { FormularioTorneo } from "./formularios";
import Link from "next/link";

export const metadata: Metadata = { title: "Torneos" };

const ETIQUETA: Record<string, string> = {
  borrador: "Borrador",
  inscripcion: "Inscripción abierta",
  en_juego: "En juego",
  cerrado: "Cerrado",
};

function fechaCorta(iso: string | null) {
  if (!iso) return "sin fecha";
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Guatemala",
  }).format(new Date(`${iso}T12:00:00`));
}

export default async function PaginaTorneos() {
  const supabase = await createClient();
  const [semestres, torneos] = await Promise.all([
    supabase.from("semestre").select("id, nombre").order("inicio", { ascending: false }),
    supabase.from("torneo").select("id, nombre, estado, formato, fecha").order("fecha", { ascending: false }),
  ]);

  const lista = datos(semestres, "los semestres") ?? [];
  const todos = datos(torneos, "los torneos") ?? [];

  return (
    <Gestion titulo="Torneos" sub="Crear, inscribir y armar el cuadro">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo torneo</CardTitle>
          <CardDescription>
            Se crea en borrador. Después se abre la inscripción, se arma el cuadro y recién ahí empieza a jugarse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Primero hace falta un semestre. Se crea en la pantalla de Ranking.
            </p>
          ) : (
            <FormularioTorneo semestres={lista} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Torneos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {todos.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-6">Todavía no hay ninguno.</p>
          ) : (
            <ul className="divide-y border-t">
              {todos.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/torneos/${t.id}` as Route}
                    className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-secondary sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {fechaCorta(t.fecha)} · {t.formato === "llave" ? "llave directa" : "grupos y llave"}
                      </p>
                    </div>
                    <Badge variant={t.estado === "en_juego" ? "secondary" : "outline"}>
                      {ETIQUETA[t.estado] ?? t.estado}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </Gestion>
  );
}
