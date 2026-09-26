"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { crearLote, revisarLote, type EstadoLote } from "./acciones";

const vacio: EstadoLote = {};

const EJEMPLO = "20001\tAna López\n20002\tBruno Pérez\n20003\tCarla Méndez";

/**
 * Alta de todo el club de una vez, pegando la lista desde Excel.
 *
 * Dos pasos y no uno: primero se muestra qué entendió el sistema y recién
 * después se crea. Crear veinte cuentas es irreversible en la práctica —hay
 * que borrarlas una por una desde el panel de Supabase—, así que ver la tabla
 * antes no es un lujo.
 */
export function AltaEnLote() {
  const [estado, accion, pendiente] = useActionState(
    async (previo: EstadoLote, datos: FormData) =>
      datos.get("paso") === "crear" ? crearLote(previo, datos) : revisarLote(previo, datos),
    vacio,
  );
  const [texto, setTexto] = useState("");

  if (estado.creadas) return <Resultado creadas={estado.creadas} />;

  const revision = estado.revision;
  const puedeCrear = revision !== undefined && revision.conProblema === 0 && revision.buenas > 0;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="lista" className="text-sm font-medium">
          Pegá dos columnas: carnet y nombre
        </label>
        <textarea
          id="lista"
          name="lista"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={EJEMPLO}
          className="min-h-40 rounded-[10px] border-0 bg-relleno p-3 text-base leading-relaxed"
        />
        <p className="text-sm text-muted-foreground">
          Seleccionás las dos columnas en Excel o Sheets, Ctrl+C, y pegás acá. El orden de las columnas no importa y
          el encabezado se ignora solo. Si alguien no es de la U, su carnet va como EXT-01.
        </p>
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}

      {revision ? <TablaRevision filas={revision.filas} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="paso"
          value="revisar"
          variant="outline"
          disabled={pendiente || texto.trim() === ""}
        >
          {pendiente ? "Leyendo..." : revision ? "Volver a revisar" : "Revisar la lista"}
        </Button>
        {puedeCrear ? (
          <Button type="submit" name="paso" value="crear" disabled={pendiente}>
            {pendiente ? "Creando..." : `Crear ${revision.buenas} cuenta${revision.buenas === 1 ? "" : "s"}`}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function TablaRevision({ filas }: { filas: { linea: number; carnet: string; nombre: string; problema?: string }[] }) {
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {filas.map((f) => (
        <li key={f.linea} className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{f.linea}</span>
          {f.problema ? (
            <>
              <span className="min-w-0 flex-1 truncate text-muted-foreground line-through">{f.nombre}</span>
              <Badge variant="descenso">{f.problema}</Badge>
            </>
          ) : (
            <>
              <span className="w-24 shrink-0 font-semibold tabular-nums">{f.carnet}</span>
              <span className="min-w-0 flex-1 truncate">{f.nombre}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function Resultado({ creadas }: { creadas: { carnet: string; nombre: string; pin?: string; nota?: string }[] }) {
  const conPin = creadas.filter((c) => c.pin);
  const sinPin = creadas.filter((c) => !c.pin);
  const origen = typeof window !== "undefined" ? window.location.origin : "";

  function mensajeDe(c: { carnet: string; nombre: string; pin?: string }) {
    return [
      `Hola ${c.nombre.split(" ")[0]}, tu acceso al ranking del club:`,
      `Carnet: ${c.carnet}`,
      `PIN: ${c.pin}`,
      origen ? `Entrá en ${origen}/ingresar y cambiá el PIN la primera vez.` : "Cambiá el PIN la primera vez.",
    ].join("\n");
  }

  function descargar() {
    const filas = [["carnet", "nombre", "pin"], ...conPin.map((c) => [c.carnet, c.nombre, c.pin ?? ""])];
    // Comillas dobles por si un nombre trae una coma. El BOM va porque sin él
    // Excel en Windows abre los acentos como caracteres raros.
    const csv = "﻿" + filas.map((f) => f.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pines-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-accent/40 bg-accent/10 p-4">
        <p className="text-sm font-medium">
          {conPin.length} cuenta{conPin.length === 1 ? "" : "s"} creada{conPin.length === 1 ? "" : "s"}
          {sinPin.length > 0 ? `, ${sinPin.length} sin tocar` : ""}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Estos PIN se ven una sola vez. Si salís de esta pantalla sin repartirlos, hay que reiniciarlos uno por uno
          desde la lista de jugadores.
        </p>
      </div>

      {conPin.length > 0 ? (
        <>
          <ul className="divide-y rounded-lg border text-sm">
            {conPin.map((c) => (
              <li key={c.carnet} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="w-24 shrink-0 font-semibold tabular-nums">{c.carnet}</span>
                <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                <span className="shrink-0 rounded bg-secondary px-2 py-1 font-semibold tabular-nums">{c.pin}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void navigator.clipboard?.writeText(mensajeDe(c))}
                >
                  Copiar mensaje
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={descargar}>
              Descargar la lista con los PIN
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            El archivo queda en tus descargas con los PIN en texto plano. Borralo cuando termines de repartirlos.
          </p>
        </>
      ) : null}

      {sinPin.length > 0 ? (
        <ul className="divide-y rounded-lg border text-sm">
          {sinPin.map((c) => (
            <li key={c.carnet} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="w-24 shrink-0 tabular-nums">{c.carnet}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.nombre}</span>
              <Badge variant="outline">{c.nota}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
