import Link from "next/link";
import { DIBUJO } from "@/components/iconos";

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
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-16"
    >
      {/* La pantalla vacía del prototipo: el dibujo, qué pasó y qué hacer. */}
      <div className="vacio">
        {esError ? DIBUJO.sinRed : DIBUJO.pregunta}
        <h1 className="t">{titulo}</h1>
        {detalle ? <p className="d">{detalle}</p> : null}
        <div className="acciones-vacio">{children}</div>
      </div>
    </main>
  );
}

export function BotonInicio() {
  return (
    <Link href="/" className="btn gris">
      Ir a la tabla
    </Link>
  );
}
