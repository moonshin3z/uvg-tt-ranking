"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Texto listo para pegar en el grupo del club. El PIN no va acá: ese se manda
 * por privado a cada uno con el botón Copiar datos de su fila.
 */
function armarMensaje(origen: string, ranking: string | null) {
  return [
    "🏓 Ya está en línea el sistema del club.",
    "",
    ranking
      ? `Podés ver la tabla del ${ranking}, el calendario y los resultados acá:`
      : "Tabla, calendario y resultados:",
    origen,
    "",
    "Para eso no necesitás cuenta. Si querés registrar tus partidos, entrá con tu carnet y el PIN que les paso por privado a cada uno. La primera vez les va a pedir cambiarlo por uno suyo.",
    "",
    "Cuando jueguen, cualquiera de los dos registra el resultado y el otro lo confirma desde la app.",
    "",
    `Cómo funciona todo: ${origen}/reglas`,
  ].join("\n");
}

export function MensajeParaElGrupo({ ranking }: { ranking: string | null }) {
  const [copiado, setCopiado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  const mensaje = armarMensaje(origen, ranking);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setAbierto(true);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mensaje para el grupo</CardTitle>
        <CardDescription>
          Para anunciar el sistema. El PIN de cada uno va aparte, con Copiar datos en su fila.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copiar}>
            {copiado ? "Copiado" : "Copiar mensaje"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAbierto((v) => !v)}>
            {abierto ? "Ocultar" : "Ver texto"}
          </Button>
        </div>
        {abierto ? (
          <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
            {mensaje}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
