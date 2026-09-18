"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelar, eliminar, type EstadoBaja } from "./bajas-acciones";

const vacio: EstadoBaja = {};

export type Contenido = {
  inscritos: number;
  partidos: number;
  jugados: number;
  marcadores: number;
};

function Mensaje({ estado }: { estado: EstadoBaja }) {
  if (!estado.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {estado.error}
    </p>
  );
}

function resumen(tipo: "ranking" | "torneo", c: Contenido) {
  const partes = [
    `${c.inscritos} inscrito${c.inscritos === 1 ? "" : "s"}`,
    `${c.partidos} partido${c.partidos === 1 ? "" : "s"}`,
  ];
  if (c.jugados > 0) partes.push(`${c.jugados} con resultado`);
  if (c.marcadores > 0) partes.push(`${c.marcadores} marcador${c.marcadores === 1 ? "" : "es"} con puntos`);
  return `Este ${tipo} tiene ${partes.join(", ")}.`;
}

/**
 * Borrar y cancelar, la única operación del sistema que no tiene vuelta atrás.
 *
 * Va colapsada y al fondo de la pantalla a propósito: no es algo que se haga
 * todos los días, y en un teléfono un botón rojo suelto se toca sin querer.
 * Para borrar hay que escribir el nombre completo; eso no es burocracia, es lo
 * único que distingue "quiero borrar este" de "se me fue el dedo".
 */
export function ZonaDePeligro({
  tipo,
  id,
  nombre,
  estado,
  contenido,
  sePuedeBorrar,
  sePuedeCancelar,
}: {
  tipo: "ranking" | "torneo";
  id: string;
  nombre: string;
  estado: string;
  contenido: Contenido;
  sePuedeBorrar: boolean;
  sePuedeCancelar: boolean;
}) {
  const [estadoBorrar, accionBorrar, borrando] = useActionState(eliminar, vacio);
  const [estadoCancelar, accionCancelar, cancelando] = useActionState(cancelar, vacio);
  const [escrito, setEscrito] = useState("");
  const coincide = escrito.trim() === nombre;

  if (!sePuedeBorrar && !sePuedeCancelar) return null;

  const trabado =
    contenido.jugados > 0 || contenido.marcadores > 0
      ? `Ya se jugó adentro, así que borrarlo no es una opción: lo que hay son resultados de otras personas. Cancelarlo lo saca de todas las pantallas sin perder nada.`
      : null;

  return (
    <details className="rounded-lg border border-destructive/40 bg-destructive/5">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-destructive">
        Borrar o cancelar este {tipo}
      </summary>

      <div className="grid gap-6 border-t border-destructive/20 p-4">
        <p className="text-sm text-muted-foreground">{resumen(tipo, contenido)}</p>

        {sePuedeCancelar ? (
          <form action={accionCancelar} className="grid gap-3" noValidate>
            <input type="hidden" name="tipo" value={tipo} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="confirmacion" value="" />
            <div>
              <h3 className="text-sm font-medium">Cancelar</h3>
              <p className="text-sm text-muted-foreground">
                Sale de la portada y de las pantallas de los jugadores. No se pierde nada y queda anotado quién lo
                canceló y por qué.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`motivo-cancelar-${id}`}>Por qué</Label>
              <Input
                id={`motivo-cancelar-${id}`}
                name="motivo"
                required
                maxLength={300}
                placeholder="Se suspendió el torneo por exámenes"
              />
            </div>
            <Mensaje estado={estadoCancelar} />
            <Button type="submit" variant="outline" disabled={cancelando} className="justify-self-start">
              {cancelando ? "Cancelando..." : `Cancelar ${tipo}`}
            </Button>
          </form>
        ) : null}

        {sePuedeBorrar ? (
          <form action={accionBorrar} className="grid gap-3 border-t border-destructive/20 pt-6" noValidate>
            <input type="hidden" name="tipo" value={tipo} />
            <input type="hidden" name="id" value={id} />
            <div>
              <h3 className="text-sm font-medium text-destructive">Borrar</h3>
              <p className="text-sm text-muted-foreground">
                Desaparece junto con sus inscripciones, sus partidos y su cuadro. Esto no se puede deshacer.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`confirmacion-${id}`}>
                Escribí <span className="font-mono font-medium text-foreground">{nombre}</span> para confirmar
              </Label>
              <Input
                id={`confirmacion-${id}`}
                name="confirmacion"
                value={escrito}
                onChange={(e) => setEscrito(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`motivo-borrar-${id}`}>Por qué (opcional)</Label>
              <Input
                id={`motivo-borrar-${id}`}
                name="motivo"
                maxLength={300}
                placeholder="Lo creé con el semestre equivocado"
              />
            </div>
            <Mensaje estado={estadoBorrar} />
            <Button
              type="submit"
              variant="destructive"
              disabled={borrando || !coincide}
              className="justify-self-start"
            >
              {borrando ? "Borrando..." : `Borrar ${tipo} para siempre`}
            </Button>
          </form>
        ) : (
          <p className="border-t border-destructive/20 pt-6 text-sm text-muted-foreground">
            {trabado ?? `Un ${tipo} ${estado} ya no se borra.`}
          </p>
        )}
      </div>
    </details>
  );
}
