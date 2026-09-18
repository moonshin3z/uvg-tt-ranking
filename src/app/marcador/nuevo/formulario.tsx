"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { abrirMarcadorLibre, type EstadoMarcadorLibre } from "@/app/partidos/acciones";

const claseSelect = "min-h-11 rounded-md border border-input bg-background px-3 text-base text-foreground";

export function FormularioMarcadorLibre({ nombrePropio }: { nombrePropio: string }) {
  const [estado, accion, pendiente] = useActionState(abrirMarcadorLibre, {} as EstadoMarcadorLibre);

  return (
    <form action={accion} className="flex flex-col gap-4 px-4 pt-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre_a">Quién juega de este lado</Label>
        <Input id="nombre_a" name="nombre_a" defaultValue={nombrePropio} maxLength={40} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre_b">Contra quién</Label>
        <Input id="nombre_b" name="nombre_b" placeholder="Nombre del rival" maxLength={40} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sets_para_ganar">Formato</Label>
          <select id="sets_para_ganar" name="sets_para_ganar" className={claseSelect} defaultValue="2">
            <option value="1">Un solo set</option>
            <option value="2">Al mejor de 3 (gana 2 sets)</option>
            <option value="3">Al mejor de 5 (gana 3 sets)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="puntos_por_set">Puntos por set</Label>
          <select id="puntos_por_set" name="puntos_por_set" className={claseSelect} defaultValue="11">
            <option value="11">11 puntos</option>
            <option value="21">21 puntos</option>
          </select>
        </div>
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pendiente} className="min-h-12 text-base">
        {pendiente ? "Abriendo..." : "Empezar a anotar"}
      </Button>
    </form>
  );
}
