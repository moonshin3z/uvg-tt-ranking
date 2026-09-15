import Link from "next/link";
import { obtenerSesion } from "@/lib/auth/sesion";
import { salir } from "@/app/(auth)/ingresar/acciones";
import { Button } from "@/components/ui/button";

export async function Encabezado() {
  const sesion = await obtenerSesion();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="inline-block size-3 rounded-full bg-accent" />
          Club TM UVG
        </Link>

        {sesion ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{sesion.usuario.nombre}</span>
            <form action={salir}>
              <Button type="submit" variant="ghost" size="sm">
                Salir
              </Button>
            </form>
          </div>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/ingresar">Ingresar</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
