"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ingresar, type EstadoIngreso } from "./acciones";

const inicial: EstadoIngreso = {};

export function FormularioIngreso() {
  const [estado, accion, pendiente] = useActionState(ingresar, inicial);

  return (
    <form action={accion} noValidate>
      <div className="grupo">
        <label className="campo">
          <span>Carnet</span>
          <input
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
        </label>
        <label className="campo">
          <span>PIN</span>
          <input
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
        </label>
      </div>

      {estado.error ? (
        <p role="alert" className="alerta">
          {estado.error}
        </p>
      ) : null}

      <div className="pila-botones mt-[22px]">
        <button type="submit" className="btn bloque" disabled={pendiente}>
          {pendiente ? "Ingresando…" : "Ingresar"}
        </button>
        <Link href="/" className="btn texto bloque">
          Ver la tabla sin ingresar
        </Link>
      </div>
    </form>
  );
}
