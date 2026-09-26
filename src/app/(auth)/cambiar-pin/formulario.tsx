"use client";

import { useActionState } from "react";
import { cambiarPin, type EstadoCambioPin } from "./acciones";

const inicial: EstadoCambioPin = {};

export function FormularioCambioPin() {
  const [estado, accion, pendiente] = useActionState(cambiarPin, inicial);

  return (
    <form action={accion} noValidate>
      <div className="grupo">
        <label className="campo">
          <span>Nuevo</span>
          <input
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
            aria-label="PIN nuevo"
          />
        </label>
        <label className="campo">
          <span>Repetir</span>
          <input
            id="confirmacion"
            name="confirmacion"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="new-password"
            required
            placeholder="El mismo otra vez"
            aria-label="Repetí el PIN"
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
          {pendiente ? "Guardando…" : "Guardar PIN"}
        </button>
      </div>
    </form>
  );
}
