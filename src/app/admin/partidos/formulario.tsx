"use client";

import { useActionState, useState } from "react";
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
  const [decision, setDecision] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const anula = decision === "anular";

  if (estado.ok)
    return (
      <p role="status" className="text-sm text-primary">
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
          value={decision}
          onChange={(e) => {
            setDecision(e.target.value);
            setConfirmando(false);
          }}
          className="min-h-10 rounded-md border border-input bg-background px-2 text-sm"
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
          className="min-h-10 w-full min-w-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        {anula && !confirmando ? (
          <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmando(true)}>
            Anular
          </Button>
        ) : (
          <Button type="submit" variant={anula ? "destructive" : "default"} size="sm" disabled={pendiente}>
            {pendiente ? "..." : anula ? "Sí, anular" : "Resolver"}
          </Button>
        )}
        {anula && confirmando ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
        ) : null}
      </div>
      {anula && confirmando ? (
        <p className="text-xs text-muted-foreground">
          El partido deja de contar para los dos y no se puede deshacer desde la app.
        </p>
      ) : null}
      {estado.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
