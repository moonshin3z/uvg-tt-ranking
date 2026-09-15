import type { Metadata } from "next";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cambiarActivo } from "./acciones";
import { BotonReiniciarPin, FormularioAlta } from "./formularios";

export const metadata: Metadata = { title: "Jugadores" };

export default async function PaginaJugadores() {
  const sesion = await requerirCoordinador();
  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("usuario")
    .select("id, carnet, nombre, rol, activo, debe_cambiar_pin")
    .order("activo", { ascending: false })
    .order("nombre");

  const lista = usuarios ?? [];
  const activos = lista.filter((u) => u.activo).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nuevo jugador</CardTitle>
          <CardDescription>El sistema genera el PIN; el jugador lo cambia en su primer ingreso.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioAlta />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Jugadores <span className="text-muted-foreground">({activos} activos)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <ul className="divide-y">
            {lista.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className={u.activo ? "truncate font-medium" : "truncate text-muted-foreground line-through"}>
                    {u.nombre}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono">{u.carnet}</span>
                    {u.rol === "coordinador" ? <Badge variant="secondary">coordinador</Badge> : null}
                    {u.debe_cambiar_pin ? <Badge variant="outline">PIN sin cambiar</Badge> : null}
                  </p>
                </div>
                <BotonReiniciarPin id={u.id} carnet={u.carnet} />
                {u.id !== sesion.authId ? (
                  <form action={cambiarActivo}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="activo" value={u.activo ? "false" : "true"} />
                    <Button type="submit" variant="ghost" size="sm">
                      {u.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
