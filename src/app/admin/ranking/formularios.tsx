"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DivisionTipo } from "@/lib/supabase/tipos";
import { nombreDivision } from "@/lib/ranking/divisiones";
import {
  abrirRanking,
  ajustarPartidosPorSemana,
  asignarManual,
  cerrarFaseRegular,
  cerrarRanking,
  crearRanking,
  crearRankingSiguiente,
  crearSemestre,
  decidirEmpate,
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
      <p role="status" className="text-sm text-primary">
        {estado.ok}
      </p>
    );
  return null;
}

const claseSelect = "min-h-11 rounded-[10px] border-0 bg-relleno px-3 text-base";

export function FormularioSemestre() {
  const [estado, accion, pendiente] = useActionState(crearSemestre, vacio);
  const anio = new Date().getFullYear();
  return (
    // Las cuatro columnas esperan a md: a 640 px las dos fechas y el botón no
    // caben y el formulario se salía de la tarjeta.
    <form
      action={accion}
      className="grid gap-3 sm:grid-cols-3 sm:items-end md:grid-cols-[1fr_1fr_1fr_auto]"
      noValidate
    >
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
      <Button
        type="submit"
        variant="outline"
        disabled={pendiente}
        className="sm:justify-self-start md:justify-self-auto"
      >
        Crear semestre
      </Button>
      <div className="sm:col-span-3 md:col-span-4">
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

      {/*
        El formato va acá arriba y no dentro de «Parámetros del reglamento»
        porque no se puede cambiar después: `sets_para_ganar` con partidos ya
        registrados deja los resultados viejos contradiciendo la configuración
        nueva. Es la única decisión de esta pantalla que no tiene vuelta atrás.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sets_para_ganar">Formato del partido</Label>
          <select id="sets_para_ganar" name="sets_para_ganar" className={claseSelect} defaultValue="2">
            <option value="1">Un solo set</option>
            <option value="2">Al mejor de 3 (gana 2 sets)</option>
            <option value="3">Al mejor de 5 (gana 3 sets)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="puntos_por_set">Puntos por set</Label>
          <select id="puntos_por_set" name="puntos_por_set" className={claseSelect} defaultValue="11">
            <option value="11">11 puntos</option>
            <option value="21">21 puntos</option>
          </select>
        </div>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Esto no se puede cambiar una vez que se registre el primer resultado. Confirmalo con el club antes de crear
          el ranking.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="divisiones">Divisiones</Label>
          <select id="divisiones" name="divisiones" className={claseSelect} defaultValue="3">
            <option value="3">3: Primera, Segunda y Tercera</option>
            <option value="2">2: Primera y Segunda</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="partidos_por_semana">Partidos por semana</Label>
          <Input
            id="partidos_por_semana"
            name="partidos_por_semana"
            type="number"
            inputMode="numeric"
            defaultValue={5}
            min={1}
            max={30}
          />
        </div>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Contando todas las divisiones. Al abrir el ranking, la app reparte los partidos en semanas de hasta esa
          cantidad, sin que nadie juegue dos veces en la misma semana.
        </p>
      </div>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Parámetros del reglamento</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["pts_victoria", "Pts por victoria", 1],
            ["pts_derrota", "Pts por derrota", 0],
            ["n_premiados", "Premiados por división", 2],
            ["n_ascienden", "Suben a la división de arriba", 2],
            ["n_descienden", "Bajan a la división de abajo", 2],
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
  division: DivisionTipo | null;
};

/**
 * `hereda`: el ranking sacó sus divisiones del anterior, así que no se sortea.
 *
 * El sorteo es una sola vez, en el primer ranking del club. De ahí en adelante
 * los lugares salen de la tabla anterior, y volver a sortear borraría todos los
 * ascensos y descensos. La base lo rechaza; acá además no se ofrece, para que
 * nadie llegue a intentarlo. La asignación manual sí queda, que es como se sube
 * a un jugador nuevo o se corrige un caso raro.
 */
export function FormularioDivisiones({
  rankingId,
  jugadores,
  divisiones,
  hereda = false,
}: {
  rankingId: string;
  jugadores: JugadorAsignable[];
  /** Las del ranking, de Primera para abajo. */
  divisiones: readonly DivisionTipo[];
  hereda?: boolean;
}) {
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
              className="min-h-9 rounded-[10px] border-0 bg-relleno px-2 text-sm"
            >
              <option value="">{hereda ? "Sin asignar" : "Sortear"}</option>
              {divisiones.map((d) => (
                <option key={d} value={d}>
                  {nombreDivision(d)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <Mensaje estado={estadoSorteo.error || estadoSorteo.ok ? estadoSorteo : estadoManual} />

      <div className="flex flex-wrap gap-2">
        {hereda ? null : (
          <Button type="submit" formAction={accionSorteo} disabled={pendiente}>
            {pendienteSorteo ? "Sorteando..." : "Sortear divisiones"}
          </Button>
        )}
        <Button type="submit" formAction={accionManual} variant={hereda ? "default" : "outline"} disabled={pendiente}>
          {pendienteManual ? "Guardando..." : "Guardar asignación"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {hereda
          ? "Este ranking hereda sus divisiones del anterior, así que no se sortea: los lugares ya salieron de la tabla. Acá solo se corrige a mano, por ejemplo para subir a alguien que entró nuevo. Guardar reemplaza la asignación completa."
          : `Si las divisiones ya están definidas, elegí la de cada uno y tocá Guardar asignación. Sortear reparte a los marcados al azar en ${divisiones.length} partes iguales e ignora la columna de división. Los dos reemplazan la asignación anterior.`}
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
  accion: typeof generarCalendario;
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

/**
 * Abrir el ranking eligiendo cuándo empieza la semana 1. La fecha que se elija
 * se lleva al lunes de su semana: las semanas van de lunes a domingo y se
 * juega martes, miércoles y jueves.
 */
export function FormularioAbrir({ rankingId, lunes }: { rankingId: string; lunes: string }) {
  const [estado, ejecutar, pendiente] = useActionState(abrirRanking, vacio);
  return (
    <form action={ejecutar} className="flex flex-col gap-3">
      <input type="hidden" name="ranking_id" value={rankingId} />
      <div className="flex flex-col gap-2 sm:max-w-xs">
        <Label htmlFor="inicio_semanas">La semana 1 empieza el lunes</Label>
        <Input id="inicio_semanas" name="inicio_semanas" type="date" defaultValue={lunes} required />
      </div>
      <Button type="submit" variant="accent" disabled={pendiente} className="sm:self-start">
        {pendiente ? "Abriendo..." : "Abrir ranking"}
      </Button>
      <Mensaje estado={estado} />
    </form>
  );
}

/** Cambiar cuántos partidos van por semana. Las semanas que ya empezaron no cambian. */
export function FormularioPartidosPorSemana({ rankingId, actual }: { rankingId: string; actual: number }) {
  const [estado, ejecutar, pendiente] = useActionState(ajustarPartidosPorSemana, vacio);
  return (
    <form action={ejecutar} className="flex flex-col gap-3">
      <input type="hidden" name="ranking_id" value={rankingId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="partidos_por_semana">Partidos por semana</Label>
          <Input
            id="partidos_por_semana"
            name="partidos_por_semana"
            type="number"
            inputMode="numeric"
            defaultValue={actual}
            min={1}
            max={30}
            className="w-28"
          />
        </div>
        <Button type="submit" variant="outline" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Cambiar"}
        </Button>
      </div>
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

/**
 * Último recurso de un desempate.
 *
 * Aparece solo cuando ya se jugaron los partidos de desempate y los empatados
 * siguen exactamente iguales: mismos puntos, mismos desempates ganados, misma
 * diferencia de sets. El coordinador los pone en orden y explica por qué. Sin
 * esto el ranking no se puede cerrar, así que no es un atajo: es la salida.
 */
export function FormularioDecidirEmpate({
  divisionId,
  jugadores,
}: {
  divisionId: string;
  jugadores: { id: string; nombre: string }[];
}) {
  const [estado, ejecutar, pendiente] = useActionState(decidirEmpate, vacio);
  return (
    <form action={ejecutar} className="flex flex-col gap-3 rounded-lg border border-input p-4">
      <input type="hidden" name="division_id" value={divisionId} />
      <p className="text-sm">
        Ni los partidos de desempate ni la diferencia de sets los separaron. Ponelos en el orden que quedan.
      </p>
      {jugadores.map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <Label htmlFor={`orden-${divisionId}-${i}`}>Puesto {i + 1}</Label>
          <select id={`orden-${divisionId}-${i}`} name="orden" required defaultValue="" className={claseSelect}>
            <option value="" disabled>
              Elegí un jugador
            </option>
            {jugadores.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`motivo-${divisionId}`}>Por qué se decidió así</Label>
        <Input
          id={`motivo-${divisionId}`}
          name="motivo"
          required
          minLength={10}
          maxLength={300}
          placeholder="Queda anotado y cualquiera lo va a poder consultar"
        />
      </div>
      <Button type="submit" disabled={pendiente} className="sm:self-start">
        {pendiente ? "Guardando..." : "Registrar la decisión"}
      </Button>
      <Mensaje estado={estado} />
    </form>
  );
}
