"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearJugador, reiniciarPin, type EstadoAlta, type EstadoReset } from "./acciones";

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
