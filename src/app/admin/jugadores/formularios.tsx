"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  consultarImpacto,
  crearJugador,
  hacerCoordinador,
  reiniciarPin,
  deshacerRetiro,
  retirarDelRanking,
  type EstadoAlta,
  type EstadoRol,
  type EstadoReset,
  type EstadoRetiro,
} from "./acciones";

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copiá este texto:", texto);
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copiar}>
      {copiado ? "Copiado" : "Copiar datos"}
    </Button>
  );
}

function PinRevelado({
  carnet,
  pin,
  titulo,
  nombre,
}: {
  carnet: string;
  pin: string;
  titulo: string;
  nombre?: string;
}) {
  const url = typeof window !== "undefined" ? window.location.origin : "";
  const texto = [
    nombre ? `Hola ${nombre.split(" ")[0]}, tu acceso al ranking del club:` : "Tu acceso al ranking del club:",
    `Carnet: ${carnet}`,
    `PIN: ${pin}`,
    url ? `Entrá en ${url}/ingresar y cambiá el PIN la primera vez.` : "Cambiá el PIN la primera vez que entrés.",
  ].join("\n");
  return (
    <div role="status" className="rounded-lg border border-accent/40 bg-accent/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{titulo}</p>
        <BotonCopiar texto={texto} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Carnet <span className="font-mono font-semibold text-foreground">{carnet}</span>, PIN{" "}
        <span className="font-mono text-2xl font-bold tracking-widest text-foreground">{pin}</span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Pasáselo al jugador ahora: no se vuelve a mostrar. Al entrar tendrá que cambiarlo.
      </p>
    </div>
  );
}

export function FormularioAlta() {
  const [estado, accion, pendiente] = useActionState(crearJugador, {} as EstadoAlta);

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {estado.creado ? (
        <PinRevelado
          carnet={estado.creado.carnet}
          pin={estado.creado.pin}
          nombre={estado.creado.nombre}
          titulo={`Cuenta creada para ${estado.creado.nombre}`}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="carnet">Carnet</Label>
          <Input id="carnet" name="carnet" autoCapitalize="characters" required placeholder="20001 o EXT-01" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nombre">Nombre completo</Label>
          <Input id="nombre" name="nombre" autoComplete="off" required placeholder="Ana López" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rol">Rol</Label>
        <select
          id="rol"
          name="rol"
          defaultValue="jugador"
          className="min-h-11 rounded-md border border-input bg-background px-3 text-base"
        >
          <option value="jugador">Jugador</option>
          <option value="coordinador">Coordinador</option>
        </select>
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pendiente} className="sm:self-start">
        {pendiente ? "Creando..." : "Crear cuenta y generar PIN"}
      </Button>
    </form>
  );
}

export function BotonReiniciarPin({ id, carnet }: { id: string; carnet: string }) {
  const [estado, accion, pendiente] = useActionState(reiniciarPin, {} as EstadoReset);

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={accion}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="carnet" value={carnet} />
        <Button type="submit" variant="outline" size="sm" disabled={pendiente}>
          {pendiente ? "..." : "Nuevo PIN"}
        </Button>
      </form>
      {estado.pin ? (
        <div role="status" className="flex items-center gap-2 text-xs">
          <span>
            PIN nuevo: <span className="font-mono text-base font-bold tracking-widest">{estado.pin}</span>
          </span>
          <BotonCopiar texto={`Carnet: ${estado.carnet}\nPIN nuevo: ${estado.pin}\nCambialo al entrar.`} />
        </div>
      ) : null}
      {estado.error ? (
        <p role="alert" className="text-xs text-destructive">
          {estado.error}
        </p>
      ) : null}
    </div>
  );
}

export function BotonHacerCoordinador({ id }: { id: string }) {
  const [estado, accion, pendiente] = useActionState(hacerCoordinador, {} as EstadoRol);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={accion}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="outline" size="sm" disabled={pendiente}>
          {pendiente ? "..." : "Hacer coordinador"}
        </Button>
      </form>
      {estado.ok ? <p className="text-xs text-primary">{estado.ok}</p> : null}
      {estado.error ? (
        <p role="alert" className="text-xs text-destructive">
          {estado.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Retiro del ranking en dos pasos: primero se consulta el impacto y se le
 * muestra al coordinador a quién le cambia los puntos, y solo si confirma se
 * ejecuta. Anular partidos ya jugados no debería poder hacerse de un clic.
 */
export function BotonRetirar({ id, nombre, rankingId }: { id: string; nombre: string; rankingId: string }) {
  const [consulta, pedirImpacto, consultando] = useActionState(consultarImpacto, {} as EstadoRetiro);
  const [resultado, ejecutar, ejecutando] = useActionState(retirarDelRanking, {} as EstadoRetiro);
  const [cancelado, setCancelado] = useState(false);

  if (resultado.ok)
    return (
      <p role="status" className="text-xs text-primary">
        {resultado.ok}
      </p>
    );

  const impacto = cancelado ? undefined : consulta.impacto;

  if (!impacto)
    return (
      <div className="flex flex-col items-end gap-1">
        <form action={pedirImpacto}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="nombre" value={nombre} />
          <input type="hidden" name="ranking_id" value={rankingId} />
          <Button type="submit" variant="ghost" size="sm" disabled={consultando}>
            {consultando ? "..." : "Retirar del ranking"}
          </Button>
        </form>
        {consulta.error ? (
          <p role="alert" className="text-xs text-destructive">
            {consulta.error}
          </p>
        ) : null}
      </div>
    );

  const total = impacto.filas.length;
  const jugados = impacto.filas.filter((f) => f.estado === "confirmado" || f.estado === "resuelto").length;
  const pierdenPuntos = impacto.filas.filter((f) => f.puntos_que_pierde > 0);

  return (
    <form action={ejecutar} className="w-full rounded-lg border border-destructive/40 bg-destructive/5 p-3">
      <input type="hidden" name="id" value={impacto.usuarioId} />
      <input type="hidden" name="ranking_id" value={impacto.rankingId} />

      <p className="text-sm font-medium">Retirar a {impacto.nombre} del ranking</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Se anulan sus {total} partido{total === 1 ? "" : "s"}
        {jugados > 0 ? `, de los cuales ${jugados} ya se jugaron` : ""}, y sale de la tabla.
      </p>

      {pierdenPuntos.length > 0 ? (
        <div className="mt-2 text-sm">
          <p className="font-medium">Pierden puntos:</p>
          <ul className="text-muted-foreground">
            {pierdenPuntos.map((f) => (
              <li key={f.rival}>
                {f.rival}: −{f.puntos_que_pierde}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nadie pierde puntos: no le ganó ninguno.</p>
      )}

      <input
        name="motivo"
        placeholder="Motivo (queda registrado)"
        className="mt-3 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      />

      {resultado.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {resultado.error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={ejecutando}>
          {ejecutando ? "Retirando..." : "Confirmar retiro"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setCancelado(true)}>
          Cancelar
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Esto no se puede deshacer desde la app.</p>
    </form>
  );
}

/**
 * Deshacer un retiro. Un paso, sin confirmación: repone lo que el retiro anuló.
 */
export function BotonDeshacerRetiro({ id, rankingId }: { id: string; rankingId: string }) {
  const [estado, ejecutar, ejecutando] = useActionState(deshacerRetiro, {} as EstadoRetiro);

  if (estado.ok)
    return (
      <p role="status" className="text-xs text-primary">
        {estado.ok}
      </p>
    );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={ejecutar}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="ranking_id" value={rankingId} />
        <Button type="submit" variant="outline" size="sm" disabled={ejecutando}>
          {ejecutando ? "Reponiendo..." : "Deshacer retiro"}
        </Button>
      </form>
      {estado.error ? (
        <p role="alert" className="text-xs text-destructive">
          {estado.error}
        </p>
      ) : null}
    </div>
  );
}
