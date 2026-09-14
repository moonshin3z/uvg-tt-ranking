import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Portada provisional de la fase 0. En la fase 1 la reemplaza la tabla de
 * posiciones pública leída de Supabase.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          Fase 0 · cimientos
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">Club de Tenis de Mesa UVG</h1>
        <p className="text-pretty text-muted-foreground">
          Ranking por divisiones, registro de resultados y torneos del club. El proyecto está en construcción.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lo que ya existe</CardTitle>
          <CardDescription>Base de datos y estructura del proyecto listas para la fase 1.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Esquema del ranking en Postgres con reglas del reglamento aplicadas en la base: una sola vez por pareja,
            un jugador por división y ningún resultado que sume sin estar confirmado.
          </p>
          <p>La tabla de posiciones se calcula, nunca se guarda, así que no puede quedar desincronizada.</p>
        </CardContent>
      </Card>

      <p className="mt-auto text-xs text-muted-foreground">Fase 1: tabla pública e ingreso con carnet y PIN.</p>
    </main>
  );
}
