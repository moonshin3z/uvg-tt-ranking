"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resolverPartido, type EstadoResolver } from "./acciones";

export function FormularioResolver({
  partidoId,
  a,
  b,
}: {
  partidoId: string;
  a: { id: string; nombre: string };
  b: { id: string; nombre: string };
}) {
  const [estado, accion, pendiente] = useActionState(resolverPartido, {} as EstadoResolver);
  if (estado.ok)
    return (
      <p role="status" className="text-sm text-zona-ascenso">
        {estado.ok}
      </p>
    );

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="partido_id" value={partidoId} />
      <div className="flex flex-wrap gap-2">
        <select
          name="decision"
          required
          className="min-h-10 rounded-md border border-input bg-background px-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Decisión...
          </option>
          <option value={a.id}>Ganó {a.nombre}</option>
          <option value={b.id}>Ganó {b.nombre}</option>
          <option value="anular">Anular (no cuenta)</option>
        </select>
        <input
          name="nota"
          placeholder="Nota (queda en la bitácora)"
          className="min-h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button type="submit" size="sm" disabled={pendiente}>
          {pendiente ? "..." : "Resolver"}
        </Button>
      </div>
      {estado.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
