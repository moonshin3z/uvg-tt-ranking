"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
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
      <p role="status" className="text-sm text-zona-ascenso">
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
export function FormularioResultado({
  partidoId,
  yo,
  rival,
  soyA,
  setsA,
  setsB,
  puntos,
}: {
  partidoId: string;
  yo: { id: string; nombre: string };
  rival: { id: string; nombre: string };
  soyA: boolean;
  setsA: number | null;
  setsB: number | null;
  puntos: { numero: number; puntos_a: number; puntos_b: number }[];
}) {
  const [estado, accion, pendiente] = useActionState(registrarResultado, vacio);

  const inicialMios = soyA ? setsA : setsB;
  const inicialSuyos = soyA ? setsB : setsA;
  const [misSets, setMisSets] = useState(inicialMios?.toString() ?? "");
  const [susSets, setSusSets] = useState(inicialSuyos?.toString() ?? "");
  const [conPuntos, setConPuntos] = useState(puntos.length > 0);

  const m = Number(misSets);
  const s = Number(susSets);
  const validos = misSets !== "" && susSets !== "" && Number.isInteger(m) && Number.isInteger(s) && m !== s;
  const total = validos ? m + s : 0;
  const nombreRival = rival.nombre.split(" ")[0];

  const nombreMisSets = soyA ? "sets_a" : "sets_b";
  const nombreSusSets = soyA ? "sets_b" : "sets_a";
  const misPuntos = (p: { puntos_a: number; puntos_b: number }) => (soyA ? p.puntos_a : p.puntos_b);
  const susPuntos = (p: { puntos_a: number; puntos_b: number }) => (soyA ? p.puntos_b : p.puntos_a);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="partido_id" value={partidoId} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Sets ganados</legend>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mis-sets" className="truncate">
              Yo ({yo.nombre.split(" ")[0]})
            </Label>
            <Input
              id="mis-sets"
              name={nombreMisSets}
              type="number"
              inputMode="numeric"
              min={0}
              max={4}
              required
              autoFocus
              value={misSets}
              onChange={(e) => setMisSets(e.target.value)}
              className="h-14 text-center text-2xl font-bold"
            />
          </div>
          <span aria-hidden className="pb-4 text-xl text-muted-foreground">
            –
          </span>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sus-sets" className="truncate">
              {nombreRival}
            </Label>
            <Input
              id="sus-sets"
              name={nombreSusSets}
              type="number"
              inputMode="numeric"
              min={0}
              max={4}
              required
              value={susSets}
              onChange={(e) => setSusSets(e.target.value)}
              className="h-14 text-center text-2xl font-bold"
            />
          </div>
        </div>

        <p aria-live="polite" className="min-h-5 text-sm">
          {validos ? (
            m > s ? (
              <span className="font-medium text-zona-ascenso">
                Ganaste {m}-{s}
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">
                Ganó {nombreRival} {s}-{m}
              </span>
            )
          ) : misSets !== "" && susSets !== "" && m === s ? (
            <span className="text-destructive">No puede quedar empatado en sets</span>
          ) : (
            <span className="text-muted-foreground">El ganador sale del marcador en sets.</span>
          )}
        </p>
      </fieldset>

      {validos ? (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={conPuntos}
              onChange={(e) => setConPuntos(e.target.checked)}
              className="size-4 accent-primary"
            />
            Anotar los puntos de cada set (opcional)
          </label>

          {conPuntos ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
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
        </div>
      ) : null}

      <Mensaje estado={estado} />
      <Button type="submit" size="lg" disabled={pendiente || !validos}>
        {pendiente ? "Guardando..." : "Registrar resultado"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {nombreRival} tendrá que confirmarlo. Si no responde en el plazo, se confirma solo.
      </p>
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
