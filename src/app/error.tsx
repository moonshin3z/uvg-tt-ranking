"use client";

import { useEffect } from "react";
import { Aviso, BotonInicio } from "@/components/aviso";
import { Button } from "@/components/ui/button";

/**
 * Captura cualquier error de renderizado o de consulta dentro de la app.
 * El mensaje real no se muestra (puede tener detalles internos); queda en la
 * consola del servidor y, en desarrollo, en la del navegador.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Aviso
      titulo="No pudimos cargar esta página"
      detalle="Puede ser la conexión o que el servidor no esté respondiendo. Probá de nuevo en unos segundos."
    >
      <Button onClick={reset}>Reintentar</Button>
      <BotonInicio />
    </Aviso>
  );
}
