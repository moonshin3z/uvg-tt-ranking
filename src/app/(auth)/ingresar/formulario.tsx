"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ingresar, type EstadoIngreso } from "./acciones";

const inicial: EstadoIngreso = {};

export function FormularioIngreso() {
  const [estado, accion, pendiente] = useActionState(ingresar, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="carnet">Carnet</Label>
        <Input
          id="carnet"
          name="carnet"
          autoComplete="username"
          autoCapitalize="characters"
          autoFocus
          required
          defaultValue={estado.carnet ?? ""}
          placeholder="20001"
          aria-invalid={Boolean(estado.error) || undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="current-password"
          required
          placeholder="6 dígitos"
          aria-invalid={Boolean(estado.error) || undefined}
        />
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pendiente} className="mt-2">
        {pendiente ? "Ingresando..." : "Ingresar"}
      </Button>
    </form>
  );
}
