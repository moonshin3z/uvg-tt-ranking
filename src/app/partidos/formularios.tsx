"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmarResultado, disputarResultado, registrarResultado, type EstadoResultado } from "./acciones";

const vacio: EstadoResultado = {};

function Mensaje({ estado }: { estado: EstadoResultado }) {
  if (estado.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {estado.error}
      </p>
    );
  if (estado.ok)
    return (
      <p role="status" className="text-sm text-primary">
        {estado.ok}
      </p>
    );
  return null;
}

/**
 * El resultado se registra por sets ganados; el ganador sale de ahí.
 * Los puntos de cada set son opcionales.
 *
 * En la base los sets se guardan en orden canónico (jugador_a, jugador_b),
 * pero en pantalla la primera columna siempre es "yo": por eso los `name` de
 * los campos se eligen según `soyA`.
 */
/**
 * Anotar el resultado, copiado de `.anotar` del prototipo.
 *
 * Dos contadores de más y menos, un resumen que dice en palabras qué pasó, y
 * el botón. Nada de escribir números en un campo: en un teléfono, al lado de
 * una mesa, dos toques son más rápidos y no se equivocan.
 *
 * El prototipo no tiene los puntos de cada set en esta pantalla, porque son
 * opcionales y se llenan solos con el marcador en vivo. Los dejo detrás de una
 * casilla, escondidos, para no perder la posibilidad de anotarlos a mano.
 */
export function FormularioResultado({
  partidoId,
  yo,
  rival,
  soyA,
  setsA,
  setsB,
  puntos,
  setsParaGanar,
}: {
  partidoId: string;
  yo: { id: string; nombre: string };
  rival: { id: string; nombre: string };
  soyA: boolean;
  setsA: number | null;
  setsB: number | null;
  puntos: { numero: number; puntos_a: number; puntos_b: number }[];
  /** Cuántos sets hay que ganar en este ranking o torneo. */
  setsParaGanar: number;
}) {
  const [estado, accion, pendiente] = useActionState(registrarResultado, vacio);

  const [mios, setMios] = useState(soyA ? (setsA ?? 0) : (setsB ?? 0));
  const [suyos, setSuyos] = useState(soyA ? (setsB ?? 0) : (setsA ?? 0));
  const [conPuntos, setConPuntos] = useState(puntos.length > 0);

  const total = mios + suyos;
  const nombreRival = rival.nombre.split(" ")[0];
  const maximo = Math.max(mios, suyos);

  // El ganador tiene que llegar exactamente a los sets que se juegan: es la
  // misma regla que valida la base, dicha acá antes de mandar nada.
  let resumen = `Poné cuántos sets ganó cada uno. Se juega a ${setsParaGanar}.`;
  let malo = false;
  if (total > 0 && mios === suyos) {
    resumen = "Un partido no puede terminar empatado.";
    malo = true;
  } else if (maximo > setsParaGanar) {
    resumen = `Acá se juega a ${setsParaGanar} sets, no a ${maximo}.`;
    malo = true;
  } else if (total > 0 && maximo < setsParaGanar) {
    resumen = `Falta: el que gana tiene que llegar a ${setsParaGanar} sets.`;
    malo = true;
  } else if (total > 0) {
    resumen = mios > suyos ? `Ganaste ${mios}-${suyos}.` : `Ganó ${nombreRival} ${suyos}-${mios}.`;
  }
  const listo = total > 0 && mios !== suyos && maximo === setsParaGanar;

  const nombreMisSets = soyA ? "sets_a" : "sets_b";
  const nombreSusSets = soyA ? "sets_b" : "sets_a";
  const misPuntos = (p: { puntos_a: number; puntos_b: number }) => (soyA ? p.puntos_a : p.puntos_b);
  const susPuntos = (p: { puntos_a: number; puntos_b: number }) => (soyA ? p.puntos_b : p.puntos_a);

  const contador = (etiqueta: string, valor: number, poner: (n: number) => void) => (
    <div className="flex items-center gap-3.5 border-b border-linea-suave py-3.5">
      <span className="min-w-0 flex-1 truncate text-base font-medium">{etiqueta}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => poner(valor - 1)}
          disabled={valor === 0}
          aria-label={`Quitar un set a ${etiqueta}`}
          className="grid size-11 place-items-center rounded-full border border-border bg-card text-xl font-medium disabled:opacity-35"
        >
          −
        </button>
        <span aria-live="polite" className="tabular min-w-[34px] text-center text-[26px] font-bold">
          {valor}
        </span>
        <button
          type="button"
          onClick={() => poner(valor + 1)}
          disabled={valor >= setsParaGanar}
          aria-label={`Sumar un set a ${etiqueta}`}
          className="grid size-11 place-items-center rounded-full border border-border bg-card text-xl font-medium disabled:opacity-35"
        >
          +
        </button>
      </span>
    </div>
  );

  return (
    <form action={accion} className="flex flex-col" noValidate>
      <input type="hidden" name="partido_id" value={partidoId} />
      <input type="hidden" name={nombreMisSets} value={mios} />
      <input type="hidden" name={nombreSusSets} value={suyos} />

      {contador(yo.nombre, mios, (n) => setMios(Math.max(0, Math.min(setsParaGanar, n))))}
      {contador(rival.nombre, suyos, (n) => setSuyos(Math.max(0, Math.min(setsParaGanar, n))))}

      <p
        aria-live="polite"
        className={cn(
          "my-[18px] rounded-md px-3.5 py-3.5 text-center text-[15px] font-medium",
          malo ? "bg-malo-suave text-malo-hondo" : "bg-uvg-suave text-uvg-profundo",
        )}
      >
        {resumen}
      </p>

      {listo ? (
        <label className="mb-3 flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={conPuntos}
            onChange={(e) => setConPuntos(e.target.checked)}
            className="size-4 accent-primary"
          />
          Anotar también los puntos de cada set
        </label>
      ) : null}

      {listo && conPuntos ? (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2 text-xs text-muted-foreground">
            <span />
            <span className="text-center">Yo</span>
            <span className="truncate text-center">{nombreRival}</span>
          </div>
          {Array.from({ length: total }, (_, i) => {
            const p = puntos[i];
            return (
              <div key={i} className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2">
                <Label className="text-muted-foreground">Set {i + 1}</Label>
                <Input
                  name={soyA ? `set${i + 1}a` : `set${i + 1}b`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  defaultValue={p ? misPuntos(p) : ""}
                  className="text-center"
                  aria-label={`Mis puntos en el set ${i + 1}`}
                />
                <Input
                  name={soyA ? `set${i + 1}b` : `set${i + 1}a`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  defaultValue={p ? susPuntos(p) : ""}
                  className="text-center"
                  aria-label={`Puntos de ${rival.nombre} en el set ${i + 1}`}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <Mensaje estado={estado} />
      <Button type="submit" size="lg" disabled={pendiente || !listo} className="w-full">
        {pendiente ? "Guardando..." : "Registrar"}
      </Button>
    </form>
  );
}

export function BotonesConfirmar({ partidoId }: { partidoId: string }) {
  const [estadoC, confirmar, pendienteC] = useActionState(confirmarResultado, vacio);
  const [estadoD, disputar, pendienteD] = useActionState(disputarResultado, vacio);
  const [disputando, setDisputando] = useState(false);
  const pendiente = pendienteC || pendienteD;

  if (estadoC.ok || estadoD.ok) return <Mensaje estado={estadoC.ok ? estadoC : estadoD} />;

  return (
    <div className="flex flex-col gap-3">
      {!disputando ? (
        <div className="flex gap-2">
          <form action={confirmar} className="flex-1">
            <input type="hidden" name="partido_id" value={partidoId} />
            <Button type="submit" className="w-full" disabled={pendiente}>
              {pendienteC ? "..." : "Confirmar"}
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setDisputando(true)}
            disabled={pendiente}
          >
            No es así
          </Button>
        </div>
      ) : (
        <form action={disputar} className="flex flex-col gap-2">
          <input type="hidden" name="partido_id" value={partidoId} />
          <Label htmlFor={`motivo-${partidoId}`}>¿Qué pasó?</Label>
          <textarea
            id={`motivo-${partidoId}`}
            name="motivo"
            required
            minLength={5}
            rows={2}
            placeholder="Ej: el marcador fue 3-2 para mí"
            className="rounded-md border border-input bg-background px-3 py-2 text-base"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={pendiente}>
              {pendienteD ? "..." : "Enviar disputa"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDisputando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
      <Mensaje estado={estadoC.error ? estadoC : estadoD} />
    </div>
  );
}

export function BotonDisputar({ partidoId }: { partidoId: string }) {
  const [estado, disputar, pendiente] = useActionState(disputarResultado, vacio);
  const [abierto, setAbierto] = useState(false);
  if (estado.ok) return <Mensaje estado={estado} />;
  if (!abierto)
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(true)}>
        Disputar
      </Button>
    );
  return (
    <form action={disputar} className="flex flex-col gap-2">
      <input type="hidden" name="partido_id" value={partidoId} />
      <textarea
        name="motivo"
        required
        minLength={5}
        rows={2}
        placeholder="¿Qué pasó?"
        className="rounded-md border border-input bg-background px-3 py-2 text-base"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={pendiente}>
          Enviar disputa
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
      <Mensaje estado={estado} />
    </form>
  );
}
