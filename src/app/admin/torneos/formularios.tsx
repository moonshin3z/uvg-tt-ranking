"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  abrirInscripcion,
  armarTorneo,
  cerrarGrupos,
  cerrarTorneo,
  crearTorneo,
  guardarInscritos,
  type EstadoTorneo,
} from "./acciones";

const vacio: EstadoTorneo = {};
const claseSelect = "min-h-11 rounded-[10px] border-0 bg-relleno px-3 text-base";

function Mensaje({ estado }: { estado: EstadoTorneo }) {
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

export function FormularioTorneo({ semestres }: { semestres: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(crearTorneo, vacio);
  const [formato, setFormato] = useState("llave");

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-nombre">Nombre</Label>
          <Input id="t-nombre" name="nombre" placeholder="Copa UVG" maxLength={60} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-fecha">Fecha</Label>
          <Input id="t-fecha" name="fecha" type="date" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-semestre">Semestre</Label>
          <select id="t-semestre" name="semestre_id" className={claseSelect} defaultValue={semestres[0]?.id ?? ""}>
            {semestres.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-formato">Formato</Label>
          <select
            id="t-formato"
            name="formato"
            className={claseSelect}
            value={formato}
            onChange={(e) => setFormato(e.target.value)}
          >
            <option value="llave">Llave directa (elimina el que pierde)</option>
            <option value="grupos_y_llave">Grupos y después llave</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-sets">Formato del partido</Label>
          <select id="t-sets" name="sets_para_ganar" className={claseSelect} defaultValue="3">
            <option value="1">Un solo set</option>
            <option value="2">Al mejor de 3 (gana 2)</option>
            <option value="3">Al mejor de 5 (gana 3)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-puntos">Puntos por set</Label>
          <select id="t-puntos" name="puntos_por_set" className={claseSelect} defaultValue="11">
            <option value="11">11 puntos</option>
            <option value="21">21 puntos</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-horas">Horas para autoconfirmar</Label>
          <Input
            id="t-horas"
            name="horas_autoconfirmacion"
            type="number"
            inputMode="numeric"
            defaultValue={24}
            min={0}
            max={720}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Un torneo se juega en un día, así que 24 horas para autoconfirmar suele alcanzar. El formato del partido no se
        puede cambiar después del primer resultado.
      </p>

      <Mensaje estado={estado} />
      <Button type="submit" disabled={pendiente || semestres.length === 0} className="sm:self-start">
        {pendiente ? "Creando..." : "Crear torneo en borrador"}
      </Button>
    </form>
  );
}

export function BotonTorneo({
  accion,
  torneoId,
  etiqueta,
  etiquetaPendiente,
  variant = "default",
}: {
  accion: typeof abrirInscripcion | typeof cerrarGrupos | typeof cerrarTorneo;
  torneoId: string;
  etiqueta: string;
  etiquetaPendiente: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, vacio);
  return (
    <form action={ejecutar} className="flex flex-col gap-2">
      <input type="hidden" name="torneo_id" value={torneoId} />
      <Button type="submit" variant={variant} disabled={pendiente} className="sm:self-start">
        {pendiente ? etiquetaPendiente : etiqueta}
      </Button>
      <Mensaje estado={estado} />
    </form>
  );
}

export type JugadorInscribible = { id: string; carnet: string; nombre: string; inscrito: boolean };
export type JugadorSembrable = { id: string; nombre: string; siembra: number | null };

/**
 * La lista de inscritos se guarda entera de una vez.
 *
 * Marcar y desmarcar uno por uno con una llamada al servidor cada vez sería
 * insoportable en el teléfono, y además deja la lista a medias si se corta la
 * red. Acá el coordinador arma la lista completa y guarda una sola vez.
 */
export function FormularioInscripcion({
  torneoId,
  jugadores,
}: {
  torneoId: string;
  jugadores: JugadorInscribible[];
}) {
  const [estado, accion, pendiente] = useActionState(guardarInscritos, vacio);
  const formRef = useRef<HTMLFormElement>(null);

  function marcarTodos(marcar: boolean) {
    formRef.current?.querySelectorAll<HTMLInputElement>('input[name="inscrito"]').forEach((c) => {
      c.checked = marcar;
    });
  }

  return (
    <form ref={formRef} action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="torneo_id" value={torneoId} />
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{jugadores.length} jugadores activos</span>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => marcarTodos(true)}>
            Marcar todos
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => marcarTodos(false)}>
            Desmarcar
          </Button>
        </div>
      </div>

      <ul className="divide-y rounded-lg border">
        {jugadores.map((j) => (
          <li key={j.id} className="flex items-center gap-3 px-3 py-2">
            <input
              type="checkbox"
              name="inscrito"
              value={j.id}
              defaultChecked={j.inscrito}
              aria-label={`Inscribir a ${j.nombre}`}
              className="size-5 accent-primary"
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              {j.nombre} <span className="text-xs text-muted-foreground">{j.carnet}</span>
            </span>
          </li>
        ))}
      </ul>

      <Mensaje estado={estado} />
      <Button type="submit" variant="outline" disabled={pendiente} className="sm:self-start">
        {pendiente ? "Guardando..." : "Guardar inscripción"}
      </Button>
    </form>
  );
}

export function FormularioArmar({
  torneoId,
  conGrupos,
  inscritos,
  gruposSugeridos,
  jugadores,
}: {
  torneoId: string;
  conGrupos: boolean;
  inscritos: number;
  gruposSugeridos: number;
  jugadores: JugadorSembrable[];
}) {
  const [estado, accion, pendiente] = useActionState(armarTorneo, vacio);
  const [modo, setModo] = useState<"sorteo" | "manual">("sorteo");
  const [orden, setOrden] = useState(() => jugadores.map((j) => j.id));
  const maximo = Math.max(2, Math.floor(inscritos / 2));

  const nombreDe = new Map(jugadores.map((j) => [j.id, j.nombre]));

  function mover(indice: number, delta: -1 | 1) {
    const destino = indice + delta;
    if (destino < 0 || destino >= orden.length) return;
    setOrden((actual) => {
      const siguiente = [...actual];
      [siguiente[indice], siguiente[destino]] = [siguiente[destino], siguiente[indice]];
      return siguiente;
    });
  }

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="torneo_id" value={torneoId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Cómo ordenar la siembra</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="modo"
            value="sorteo"
            checked={modo === "sorteo"}
            onChange={() => setModo("sorteo")}
            className="size-4 accent-primary"
          />
          Sortear automáticamente
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="modo"
            value="manual"
            checked={modo === "manual"}
            onChange={() => setModo("manual")}
            className="size-4 accent-primary"
          />
          Elegir el orden manualmente
        </label>
      </fieldset>

      {modo === "manual" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            El primero queda como cabeza de serie 1. Usá los botones para acomodar la lista desde el teléfono.
          </p>
          <ol className="divide-y rounded-lg border" aria-label="Orden manual de siembra">
            {orden.map((id, indice) => (
              <li key={id} className="flex min-h-12 items-center gap-2 px-3 py-2">
                <span className="w-6 shrink-0 text-right text-sm text-muted-foreground">{indice + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-sm">{nombreDe.get(id) ?? "Jugador desconocido"}</span>
                <button
                  type="button"
                  onClick={() => mover(indice, -1)}
                  disabled={indice === 0 || pendiente}
                  aria-label={"Subir " + (nombreDe.get(id) ?? "jugador")}
                  className="inline-flex size-10 items-center justify-center rounded-md border text-lg disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => mover(indice, 1)}
                  disabled={indice === orden.length - 1 || pendiente}
                  aria-label={"Bajar " + (nombreDe.get(id) ?? "jugador")}
                  className="inline-flex size-10 items-center justify-center rounded-md border text-lg disabled:opacity-40"
                >
                  ↓
                </button>
                <input type="hidden" name="orden" value={id} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {conGrupos ? (
        <div className="flex flex-col gap-2 sm:max-w-xs">
          <Label htmlFor="cant_grupos">Cuántos grupos</Label>
          <select
            id="cant_grupos"
            name="cant_grupos"
            className={claseSelect}
            defaultValue={String(Math.min(gruposSugeridos, maximo))}
          >
            {Array.from({ length: Math.max(1, maximo - 1) }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n} grupos ({Math.floor(inscritos / n)} o {Math.ceil(inscritos / n)} por grupo)
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="cant_grupos" value="0" />
      )}

      <p className="text-sm text-muted-foreground">
        {modo === "manual"
          ? "Se guarda el orden completo y queda marcado como siembra manual."
          : "El sorteo usa una semilla que queda guardada con el torneo, así que cualquiera puede rehacerlo y comprobar que no se acomodó a nadie."}{" "}
        Volver a armar borra los partidos que ya se hayan jugado.
      </p>

      <Mensaje estado={estado} />
      <Button type="submit" disabled={pendiente || inscritos < 2} className="sm:self-start">
        {pendiente ? "Armando..." : modo === "manual" ? "Armar con esta siembra" : "Sortear y armar"}
      </Button>
    </form>
  );
}
