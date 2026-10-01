"use client";

import { useActionState } from "react";
import { moverASemana, type EstadoSemana } from "@/app/admin/partidos/acciones";

const vacio: EstadoSemana = {};

/**
 * Para el coordinador: pasar un partido pendiente a otra semana, o soltarlo
 * para que lo acomode la app. Las semanas que ya pasaron no se ofrecen.
 */
export function MoverSemana({
  partidoId,
  semana,
  desde,
  hasta,
  enCurso,
}: {
  partidoId: string;
  semana: number | null;
  desde: number;
  hasta: number;
  /** La semana que se está jugando hoy; antes de la 1, ninguna. */
  enCurso: number | null;
}) {
  const [estado, mover, pendiente] = useActionState(moverASemana, vacio);
  const opciones = Array.from({ length: Math.max(hasta - desde + 1, 1) }, (_, i) => desde + i);

  return (
    <form action={mover} className="flex flex-col gap-2">
      <h2 className="seccion">Semana</h2>
      <input type="hidden" name="partido_id" value={partidoId} />
      <div className="grupo">
        <label className="campo">
          <span>Pasar a</span>
          <select
            // Con `key` vuelve a tomar la semana guardada después de cambiarla.
            key={semana ?? "auto"}
            name="semana"
            defaultValue={semana !== null && semana >= desde ? String(semana) : String(desde)}
            className="min-h-[50px] min-w-0 flex-1 border-0 bg-transparent text-[17px] outline-none"
          >
            {opciones.map((n) => (
              <option key={n} value={n}>
                Semana {n}
                {n === enCurso ? " (esta)" : ""}
              </option>
            ))}
            <option value="auto">Que lo acomode la app</option>
          </select>
        </label>
      </div>
      <div className="pila-botones">
        <button type="submit" className="btn gris bloque" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Cambiar de semana"}
        </button>
      </div>
      {estado.error ? (
        <p role="alert" className="pie text-destructive">
          {estado.error}
        </p>
      ) : estado.ok ? (
        <p role="status" className="pie text-primary">
          {estado.ok}
        </p>
      ) : (
        <p className="pie">
          {semana !== null && semana < desde
            ? `Era de la semana ${semana} y no se jugó.`
            : "Solo cambia este partido; los demás de esa semana siguen igual."}
        </p>
      )}
    </form>
  );
}
