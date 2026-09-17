import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Pantalla de mensaje a página completa: errores, 404, estados vacíos grandes. */
export function Aviso({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span aria-hidden className="text-4xl">
        🏓
      </span>
      <h1 className="text-xl font-bold tracking-tight text-balance">{titulo}</h1>
      {detalle ? <p className="text-pretty text-muted-foreground">{detalle}</p> : null}
      <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>
    </main>
  );
}

export function BotonInicio() {
  return (
    <Button asChild variant="outline">
      <Link href="/">Ir a la tabla</Link>
    </Button>
  );
}
