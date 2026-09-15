"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  abrirRanking,
  asignarManual,
  cerrarFaseRegular,
  cerrarRanking,
  crearRanking,
  crearRankingSiguiente,
  crearSemestre,
  generarCalendario,
  generarDesempates,
  sortear,
  type EstadoAccion,
} from "./acciones";

const vacio: EstadoAccion = {};

function Mensaje({ estado }: { estado: EstadoAccion }) {
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

const claseSelect = "min-h-11 rounded-md border border-input bg-background px-3 text-base";

export function FormularioSemestre() {
  const [estado, accion, pendiente] = useActionState(crearSemestre, vacio);
  const anio = new Date().getFullYear();
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-nombre">Nombre</Label>
        <Input id="s-nombre" name="nombre" placeholder={`${anio}-2`} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-inicio">Inicio</Label>
        <Input id="s-inicio" name="inicio" type="date" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-fin">Fin</Label>
        <Input id="s-fin" name="fin" type="date" required />
      </div>
      <Button type="submit" variant="outline" disabled={pendiente}>
        Crear semestre
      </Button>
      <div className="sm:col-span-4">
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

export function FormularioRanking({ semestres }: { semestres: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(crearRanking, vacio);
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="semestre_id">Semestre</Label>
          <select id="semestre_id" name="semestre_id" className={claseSelect} defaultValue={semestres[0]?.id ?? ""}>
            {semestres.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="numero">Número</Label>
          <select id="numero" name="numero" className={claseSelect} defaultValue="1">
            <option value="1">1 (inicio a mitad)</option>
            <option value="2">2 (mitad a final)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha_limite">Fecha límite</Label>
          <Input id="fecha_limite" name="fecha_limite" type="date" required />
        </div>
      </div>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Parámetros del reglamento</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["pts_victoria", "Pts por victoria", 1],
            ["pts_derrota", "Pts por derrota", 0],
            ["n_premiados", "Premiados por división", 3],
            ["n_ascienden", "Suben de Menor", 3],
            ["n_descienden", "Bajan de Mayor", 3],
            ["horas_autoconfirmacion", "Horas para autoconfirmar (0 = nunca)", 72],
          ].map(([name, label, def]) => (
            <div key={String(name)} className="flex flex-col gap-2">
              <Label htmlFor={String(name)}>{label}</Label>
              <Input
                id={String(name)}
                name={String(name)}
                type="number"
                inputMode="numeric"
                defaultValue={def}
                min={0}
              />
            </div>
          ))}
        </div>
      </details>

      <Mensaje estado={estado} />
      <Button type="submit" disabled={pendiente || semestres.length === 0} className="sm:self-start">
        {pendiente ? "Creando..." : "Crear ranking en borrador"}
      </Button>
    </form>
  );
}

export type JugadorAsignable = {
  id: string;
  carnet: string;
  nombre: string;
  division: "mayor" | "menor" | null;
};

export function FormularioDivisiones({ rankingId, jugadores }: { rankingId: string; jugadores: JugadorAsignable[] }) {
  const [estadoSorteo, accionSorteo, pendienteSorteo] = useActionState(sortear, vacio);
  const [estadoManual, accionManual, pendienteManual] = useActionState(asignarManual, vacio);
  const pendiente = pendienteSorteo || pendienteManual;
  const formRef = useRef<HTMLFormElement>(null);

  function marcarTodos(marcar: boolean) {
    formRef.current
      ?.querySelectorAll<HTMLInputElement>('input[name="participa"]')
      .forEach((c) => (c.checked = marcar));
  }

  return (
    <form ref={formRef} className="flex flex-col gap-4">
      <input type="hidden" name="ranking_id" value={rankingId} />
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
              name="participa"
              value={j.id}
              defaultChecked={j.division !== null}
              aria-label={`Participa ${j.nombre}`}
              className="size-5 accent-primary"
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              {j.nombre} <span className="font-mono text-xs text-muted-foreground">{j.carnet}</span>
            </span>
            <select
              name={`division:${j.id}`}
              defaultValue={j.division ?? ""}
              aria-label={`División de ${j.nombre}`}
              className="min-h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Sortear</option>
              <option value="mayor">Mayor</option>
              <option value="menor">Menor</option>
            </select>
          </li>
        ))}
      </ul>

      <Mensaje estado={estadoSorteo.error || estadoSorteo.ok ? estadoSorteo : estadoManual} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" formAction={accionSorteo} disabled={pendiente}>
          {pendienteSorteo ? "Sorteando..." : "Sortear divisiones"}
        </Button>
        <Button type="submit" formAction={accionManual} variant="outline" disabled={pendiente}>
          {pendienteManual ? "Guardando..." : "Guardar asignación manual"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sortear reparte a los marcados al azar (mitad a Mayor, mitad a Menor) e ignora la columna de división. Guardar
        manual usa la división elegida por jugador. Ambos reemplazan la asignación anterior.
      </p>
    </form>
  );
}

export function BotonAccion({
  accion,
  rankingId,
  etiqueta,
  etiquetaPendiente,
  variant = "default",
}: {
  accion: typeof generarCalendario | typeof abrirRanking;
  rankingId: string;
  etiqueta: string;
  etiquetaPendiente: string;
  variant?: "default" | "accent" | "outline";
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, vacio);
  return (
    <form action={ejecutar} className="flex flex-col gap-2">
      <input type="hidden" name="ranking_id" value={rankingId} />
      <Button type="submit" variant={variant} disabled={pendiente} className="sm:self-start">
        {pendiente ? etiquetaPendiente : etiqueta}
      </Button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function BotonCierre({
  accion,
  rankingId,
  etiqueta,
  etiquetaPendiente,
  variant = "default",
}: {
  accion: typeof cerrarFaseRegular | typeof generarDesempates | typeof cerrarRanking;
  rankingId: string;
  etiqueta: string;
  etiquetaPendiente: string;
  variant?: "default" | "accent" | "outline" | "destructive";
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, vacio);
  return (
    <form action={ejecutar} className="flex flex-col gap-2">
      <input type="hidden" name="ranking_id" value={rankingId} />
      <Button type="submit" variant={variant} disabled={pendiente} className="sm:self-start">
        {pendiente ? etiquetaPendiente : etiqueta}
      </Button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function FormularioSiguiente({
  rankingAnterior,
  semestres,
  numeroSugerido,
  semestreSugerido,
}: {
  rankingAnterior: string;
  semestres: { id: string; nombre: string }[];
  numeroSugerido: number;
  semestreSugerido: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearRankingSiguiente, vacio);
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="ranking_anterior" value={rankingAnterior} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sig-semestre">Semestre</Label>
          <select id="sig-semestre" name="semestre_id" className={claseSelect} defaultValue={semestreSugerido}>
            {semestres.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sig-numero">Número</Label>
          <select id="sig-numero" name="numero" className={claseSelect} defaultValue={String(numeroSugerido)}>
            <option value="1">1 (inicio a mitad)</option>
            <option value="2">2 (mitad a final)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sig-fecha">Fecha límite</Label>
          <Input id="sig-fecha" name="fecha_limite" type="date" required />
        </div>
      </div>
      <Mensaje estado={estado} />
      <Button type="submit" variant="accent" disabled={pendiente} className="sm:self-start">
        {pendiente ? "Creando..." : "Crear ranking siguiente"}
      </Button>
    </form>
  );
}
