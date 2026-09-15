"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cambiarPin, type EstadoCambioPin } from "./acciones";

const inicial: EstadoCambioPin = {};

export function FormularioCambioPin() {
  const [estado, accion, pendiente] = useActionState(cambiarPin, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pin">PIN nuevo</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="new-password"
          autoFocus
          required
          placeholder="6 dígitos"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmacion">Repetí el PIN</Label>
        <Input
          id="confirmacion"
          name="confirmacion"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="new-password"
          required
        />
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pendiente} className="mt-2">
        {pendiente ? "Guardando..." : "Guardar PIN"}
      </Button>
    </form>
  );
}
