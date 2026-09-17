"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cambiarActivo } from "./acciones";
import { BotonReiniciarPin, BotonRetirar } from "./formularios";

export type JugadorFila = {
  id: string;
  carnet: string;
  nombre: string;
  rol: string;
  activo: boolean;
  debe_cambiar_pin: boolean;
};

/** Quita tildes para que buscar "lopez" encuentre a "López". */
function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Desactivar es reversible pero confunde al jugador, así que se confirma. */
function BotonActivo({ id, activo, nombre }: { id: string; activo: boolean; nombre: string }) {
  const [confirmando, setConfirmando] = useState(false);

  if (activo && confirmando)
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">¿Desactivar a {nombre.split(" ")[0]}?</span>
        <form action={cambiarActivo}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="activo" value="false" />
          <Button type="submit" variant="destructive" size="sm">
            Sí
          </Button>
        </form>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
          No
        </Button>
      </div>
    );

  if (activo)
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(true)}>
        Desactivar
      </Button>
    );

  return (
    <form action={cambiarActivo}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value="true" />
      <Button type="submit" variant="ghost" size="sm">
        Activar
      </Button>
    </form>
  );
}

export function ListaJugadores({
  jugadores,
  sesionId,
  rankingId,
  inscritos,
}: {
  jugadores: JugadorFila[];
  sesionId: string;
  rankingId: string | null;
  inscritos: string[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const enRanking = useMemo(() => new Set(inscritos), [inscritos]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return jugadores.filter((j) => {
      if (soloActivos && !j.activo) return false;
      if (!q) return true;
      return normalizar(j.nombre).includes(q) || j.carnet.toLowerCase().includes(q);
    });
  }, [jugadores, busqueda, soloActivos]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 px-4 pb-3 sm:flex-row sm:items-center sm:px-6">
        <Input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o carnet"
          aria-label="Buscar jugador"
          className="sm:max-w-xs"
        />
        <label className="min-h-10 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="size-4 accent-primary"
          />
          Solo activos
        </label>
        <span className="text-sm text-muted-foreground sm:ml-auto">
          {visibles.length} de {jugadores.length}
        </span>
      </div>

      {visibles.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-6">Ningún jugador coincide con la búsqueda.</p>
      ) : (
        <ul className="divide-y border-t">
          {visibles.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className={u.activo ? "truncate font-medium" : "truncate text-muted-foreground line-through"}>
                  {u.nombre}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-mono">{u.carnet}</span>
                  {u.rol === "coordinador" ? <Badge variant="secondary">coordinador</Badge> : null}
                  {u.debe_cambiar_pin ? <Badge variant="outline">PIN sin cambiar</Badge> : null}
                  {enRanking.has(u.id) ? <Badge variant="outline">en el ranking</Badge> : null}
                </p>
              </div>
              <BotonReiniciarPin id={u.id} carnet={u.carnet} />
              {rankingId && enRanking.has(u.id) ? (
                <BotonRetirar id={u.id} nombre={u.nombre} rankingId={rankingId} />
              ) : null}
              {u.id !== sesionId ? <BotonActivo id={u.id} activo={u.activo} nombre={u.nombre} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
