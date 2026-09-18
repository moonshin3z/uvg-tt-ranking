import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Pantalla de mensaje a página completa: errores, 404, estados vacíos grandes. */
export function Aviso({
  titulo,
  detalle,
  esError = false,
  children,
}: {
  titulo: string;
  detalle?: string;
  /**
   * Marca la pantalla como un error de verdad, no un vacío ni un 404.
   *
   * Sale en el HTML como `data-uvgtt-error` para que las pruebas lo vean. El
   * nombre lleva el prefijo del proyecto por algo: con `data-error` a secas, el
   * overlay de desarrollo de Next trae su propio `<div data-error="false">`
   * dentro de su shadow DOM, y Playwright atraviesa shadow DOM, así que la
   * comprobación daba positivo en todas las pantallas. Sin esto,
   * una pantalla que revienta se ve perfecta para una auditoría de layout: no
   * tiene nada que se salga ni nada ilegible, así que pasaba en verde. Fue
   * exactamente lo que dejó /admin/jugadores roto sin que nadie lo notara.
   */
  esError?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <main
      {...(esError ? { "data-uvgtt-error": "1" } : {})}
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
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
