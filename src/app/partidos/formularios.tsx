"use client";

import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { confirmarResultado, disputarResultado, registrarResultado, type EstadoResultado } from "./acciones";

const vacio: EstadoResultado = {};

/**
 * Lo que tienen en común la hoja para anotar y la hoja de acciones: mientras
 * están abiertas, la pantalla de atrás se achica (`html.con-hoja`), Escape
 * las cierra y la barra de pestañas se esconde.
 */
function useHoja(abierta: boolean, cerrar: () => void) {
  const cerrarRef = useRef(cerrar);
  useEffect(() => {
    cerrarRef.current = cerrar;
  });

  useEffect(() => {
    if (!abierta) return;
    const html = document.documentElement;
    html.style.setProperty("--origen-hoja", `${window.scrollY}px`);
    html.classList.add("con-hoja");
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarRef.current();
    };
    document.addEventListener("keydown", escape);
    return () => {
      html.classList.remove("con-hoja");
      document.removeEventListener("keydown", escape);
    };
  }, [abierta]);
}

/**
 * Las hojas van fuera de `#app`, directo en el body: `#app` se achica con un
 * transform cuando hay una hoja abierta, y un `position: fixed` adentro de
 * algo con transform deja de medirse contra la pantalla.
 */
const sinSuscripcion = () => () => {};
function FueraDeApp({ children }: { children: React.ReactNode }) {
  const enNavegador = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
  return enNavegador ? createPortal(children, document.body) : null;
}

function MensajeError({ estado }: { estado: EstadoResultado }) {
  if (!estado.error) return null;
  return (
    <p role="alert" className="alerta">
      {estado.error}
    </p>
  );
}

const MENOS = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M5 12h14" />
  </svg>
);
const MAS = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M5 12h14M12 5v14" />
  </svg>
);

/**
 * Anotar el resultado: el botón y la hoja que sube desde abajo, copiados del
 * prototipo de iOS.
 *
 * Dos contadores de más y menos, un resumen que dice en palabras qué pasó, y
 * «Registrar» arriba a la derecha. Nada de escribir números en un campo: en
 * un teléfono, al lado de una mesa, dos toques son más rápidos y no se
 * equivocan.
 *
 * El resultado se registra por sets ganados; el ganador sale de ahí. Los
 * puntos de cada set son opcionales y van detrás de una fila, escondidos:
 * se llenan solos con el marcador en vivo.
 *
 * En la base los sets se guardan en orden canónico (jugador_a, jugador_b),
 * pero en pantalla la primera fila siempre es "yo": por eso los `name` de los
 * campos se eligen según `soyA`.
 */
export function AnotarResultado({
  partidoId,
  yo,
  rival,
  soyA,
  setsA,
  setsB,
  puntos,
  setsParaGanar,
  contexto,
  marcador,
  corregir = false,
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
  contexto: string;
  /** El formulario que abre el marcador en vivo, para la fila de la hoja. */
  marcador: (formData: FormData) => Promise<void>;
  corregir?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const [estado, accion, pendiente] = useActionState(registrarResultado, vacio);
  const [mios, setMios] = useState(soyA ? (setsA ?? 0) : (setsB ?? 0));
  const [suyos, setSuyos] = useState(soyA ? (setsB ?? 0) : (setsA ?? 0));
  const [conPuntos, setConPuntos] = useState(puntos.length > 0);
  const [cambio, setCambio] = useState<{ lado: "yo" | "rival"; n: number } | null>(null);
  const [arrastre, setArrastre] = useState<number | null>(null);
  const tirando = useRef<{ y0: number; t0: number; id: number } | null>(null);
  const formId = useId();
  const tituloId = useId();

  useHoja(abierta, () => setAbierta(false));

  const total = mios + suyos;
  const nombreRival = rival.nombre.split(" ")[0];
  const maximo = Math.max(mios, suyos);

  // El ganador tiene que llegar exactamente a los sets que se juegan: es la
  // misma regla que valida la base, dicha acá antes de mandar nada.
  let resumen = "Poné cuántos sets ganó cada uno.";
  let tono: "neutro" | "malo" | "" = "neutro";
  if (total > 0 && mios === suyos) {
    resumen = "Un partido no puede terminar empatado.";
    tono = "malo";
  } else if (maximo > setsParaGanar) {
    resumen = `Acá se juega a ${setsParaGanar} sets, no a ${maximo}.`;
    tono = "malo";
  } else if (total > 0 && maximo < setsParaGanar) {
    resumen = `Al mejor de ${setsParaGanar * 2 - 1}, alguien tiene que llegar a ${setsParaGanar}.`;
  } else if (total > 0) {
    resumen = mios > suyos ? `Ganaste ${mios}-${suyos}.` : `Ganó ${nombreRival} ${suyos}-${mios}.`;
    tono = "";
  }
  const listo = total > 0 && mios !== suyos && maximo === setsParaGanar;

  const nombreMisSets = soyA ? "sets_a" : "sets_b";
  const nombreSusSets = soyA ? "sets_b" : "sets_a";
  const misPuntos = (p: { puntos_a: number; puntos_b: number }) => (soyA ? p.puntos_a : p.puntos_b);
  const susPuntos = (p: { puntos_a: number; puntos_b: number }) => (soyA ? p.puntos_b : p.puntos_a);

  function poner(lado: "yo" | "rival", valor: number) {
    const n = Math.max(0, Math.min(setsParaGanar, valor));
    if (lado === "yo") setMios(n);
    else setSuyos(n);
    setCambio((c) => ({ lado, n: (c?.n ?? 0) + 1 }));
  }

  const contador = (lado: "yo" | "rival", etiqueta: string, valor: number) => (
    <div className="contador">
      <span className="quien">{etiqueta}</span>
      <span
        key={cambio?.lado === lado ? cambio.n : 0}
        aria-live="polite"
        className={cn("val", cambio?.lado === lado && "pop")}
      >
        {valor}
      </span>
      <span className="stepper">
        <button
          type="button"
          onClick={() => poner(lado, valor - 1)}
          disabled={valor === 0}
          aria-label={`Quitar un set a ${etiqueta}`}
        >
          {MENOS}
        </button>
        <i aria-hidden />
        <button
          type="button"
          onClick={() => poner(lado, valor + 1)}
          disabled={valor >= setsParaGanar}
          aria-label={`Sumar un set a ${etiqueta}`}
        >
          {MAS}
        </button>
      </span>
    </div>
  );

  // La hoja se cierra arrastrándola hacia abajo desde la barra de arriba.
  const alBajar = {
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      tirando.current = { y0: e.clientY, t0: performance.now(), id: e.pointerId };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setArrastre(0);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const t = tirando.current;
      if (!t || t.id !== e.pointerId) return;
      setArrastre(Math.max(0, e.clientY - t.y0));
    },
    onPointerUp: (e: React.PointerEvent) => {
      const t = tirando.current;
      if (!t || t.id !== e.pointerId) return;
      const dy = Math.max(0, e.clientY - t.y0);
      const v = dy / Math.max(1, performance.now() - t.t0);
      tirando.current = null;
      setArrastre(null);
      if (dy > 130 || v > 0.6) setAbierta(false);
    },
    onPointerCancel: () => {
      tirando.current = null;
      setArrastre(null);
    },
  };

  return (
    <>
      <button type="button" className="btn bloque" onClick={() => setAbierta(true)}>
        {corregir ? "Corregir el resultado" : "Anotar el resultado"}
      </button>

      <FueraDeApp>
        <div className={cn("velo", abierta && "ver")} onClick={() => setAbierta(false)} aria-hidden />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          aria-hidden={!abierta}
          inert={!abierta}
          className={cn("hoja", abierta && "ver", arrastre !== null && "arrastrando")}
          style={arrastre ? { transform: `translateY(${arrastre}px)` } : undefined}
        >
          <div className="asa" aria-hidden {...alBajar} />
          <div className="hoja-nav" {...alBajar}>
            <div>
              <button type="button" className="boton-nav cristal" onClick={() => setAbierta(false)}>
                Cancelar
              </button>
            </div>
            <div className="t" id={tituloId}>
              {corregir ? "Corregir resultado" : "Anotar resultado"}
            </div>
            <div>
              <button type="submit" form={formId} className="boton-nav cristal fuerte" disabled={pendiente || !listo}>
                {pendiente ? "Guardando…" : "Registrar"}
              </button>
            </div>
          </div>

          <div className="hoja-cuerpo">
            <p className="hoja-ctx">
              {contexto} · al mejor de {setsParaGanar * 2 - 1}
            </p>
            <form id={formId} action={accion} noValidate>
              <input type="hidden" name="partido_id" value={partidoId} />
              <input type="hidden" name={nombreMisSets} value={mios} />
              <input type="hidden" name={nombreSusSets} value={suyos} />

              <div className="grupo">
                {contador("yo", yo.nombre, mios)}
                {contador("rival", rival.nombre, suyos)}
              </div>
              <p aria-live="polite" className={cn("resumen", tono)}>
                {resumen}
              </p>

              {listo ? (
                <>
                  <div className="grupo mt-[18px]">
                    <label className="celda cursor-pointer">
                      <span className="medio">
                        <span className="t-celda">Anotar los puntos de cada set</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={conPuntos}
                        onChange={(e) => setConPuntos(e.target.checked)}
                        className="size-5 accent-primary"
                      />
                    </label>
                  </div>
                  {conPuntos ? (
                    <div className="grupo mt-2">
                      <div className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-2 px-4 pt-3 pb-1 text-[13px] text-muted-foreground">
                        <span />
                        <span className="text-center">Yo</span>
                        <span className="truncate text-center">{nombreRival}</span>
                      </div>
                      {Array.from({ length: total }, (_, i) => {
                        const p = puntos[i];
                        const campo =
                          "h-11 w-full min-w-0 rounded-[10px] bg-relleno text-center text-[17px] outline-none focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary";
                        return (
                          <div key={i} className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-2 px-4 py-1.5">
                            <span className="text-[15px] text-muted-foreground">Set {i + 1}</span>
                            <input
                              name={soyA ? `set${i + 1}a` : `set${i + 1}b`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={99}
                              defaultValue={p ? misPuntos(p) : ""}
                              className={campo}
                              aria-label={`Mis puntos en el set ${i + 1}`}
                            />
                            <input
                              name={soyA ? `set${i + 1}b` : `set${i + 1}a`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={99}
                              defaultValue={p ? susPuntos(p) : ""}
                              className={campo}
                              aria-label={`Puntos de ${rival.nombre} en el set ${i + 1}`}
                            />
                          </div>
                        );
                      })}
                      <div className="h-2" />
                    </div>
                  ) : null}
                </>
              ) : null}
              <MensajeError estado={estado} />
            </form>

            <div className="h-[18px]" />
            <form action={marcador} className="grupo">
              <input type="hidden" name="partido_id" value={partidoId} />
              <button type="submit" className="celda">
                <span className="medio">
                  <span className="t-celda">Llevar el marcador en vivo</span>
                  <span className="s-celda">Los puntos de cada set se anotan solos</span>
                </span>
                <span className="derecha">
                  <svg
                    className="chev"
                    width="9"
                    height="15"
                    viewBox="0 0 9 15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M1.5 1.5l6 6-6 6" />
                  </svg>
                </span>
              </button>
            </form>
            <p className="pie">
              Los puntos de cada set son opcionales. {nombreRival} recibe un aviso para confirmar.
            </p>
          </div>
        </section>
      </FueraDeApp>
    </>
  );
}

/**
 * La hoja de acciones de iOS para disputar: el porqué arriba, el campo para
 * contarlo, el botón rojo y Cancelar aparte.
 */
function HojaDisputa({
  partidoId,
  abierta,
  cerrar,
  accion,
  pendiente,
  estado,
}: {
  partidoId: string;
  abierta: boolean;
  cerrar: () => void;
  accion: (formData: FormData) => void;
  pendiente: boolean;
  estado: EstadoResultado;
}) {
  const [motivo, setMotivo] = useState("");
  const tituloId = useId();
  useHoja(abierta, cerrar);

  return (
    <FueraDeApp>
      <div className={cn("velo", abierta && "ver")} onClick={cerrar} aria-hidden />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-hidden={!abierta}
        inert={!abierta}
        className={cn("acciones", abierta && "ver")}
      >
        <form action={accion} className="acc-grupo">
          <input type="hidden" name="partido_id" value={partidoId} />
          <p className="acc-titulo">
            <b id={tituloId}>¿El resultado no fue así?</b>
            Le avisamos al coordinador y el partido no suma hasta que lo resuelva.
          </p>
          <label className="sr-only" htmlFor={`motivo-${partidoId}`}>
            ¿Qué pasó?
          </label>
          <textarea
            id={`motivo-${partidoId}`}
            name="motivo"
            required
            minLength={5}
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="¿Qué pasó? Ej: el marcador fue 3-2 para mí"
            className="acc-campo"
          />
          {estado.error ? (
            <p role="alert" className="px-4 pb-3 text-center text-[13px] text-destructive">
              {estado.error}
            </p>
          ) : null}
          <button type="submit" className="acc-boton destructivo" disabled={pendiente || motivo.trim().length < 5}>
            {pendiente ? "Enviando…" : "Disputar el resultado"}
          </button>
        </form>
        <div className="acc-grupo">
          <button type="button" className="acc-boton cancelar" onClick={cerrar}>
            Cancelar
          </button>
        </div>
      </section>
    </FueraDeApp>
  );
}

/** Confirmar o disputar un resultado que registró el rival. */
export function BotonesConfirmar({ partidoId }: { partidoId: string }) {
  const router = useRouter();
  const [estadoC, confirmar, pendienteC] = useActionState(confirmarResultado, vacio);
  const [estadoD, disputar, pendienteD] = useActionState(disputarResultado, vacio);
  const [disputando, setDisputando] = useState(false);
  const pendiente = pendienteC || pendienteD;

  // Como en el prototipo: al responder, de vuelta a tus partidos con el
  // aviso arriba.
  useEffect(() => {
    if (estadoC.ok) router.replace("/partidos?listo=confirmado");
  }, [estadoC.ok, router]);
  useEffect(() => {
    if (estadoD.ok) router.replace("/partidos?listo=disputa");
  }, [estadoD.ok, router]);

  return (
    <>
      <form action={confirmar}>
        <input type="hidden" name="partido_id" value={partidoId} />
        <button type="submit" className="btn bloque" disabled={pendiente}>
          {pendienteC ? "Confirmando…" : "Confirmar"}
        </button>
      </form>
      <button type="button" className="btn rojo bloque" onClick={() => setDisputando(true)} disabled={pendiente}>
        No fue así
      </button>
      <MensajeError estado={estadoC} />
      <HojaDisputa
        partidoId={partidoId}
        abierta={disputando}
        cerrar={() => setDisputando(false)}
        accion={disputar}
        pendiente={pendienteD}
        estado={estadoD}
      />
    </>
  );
}

/** Disputar un resultado ya confirmado, desde el detalle del partido. */
export function BotonDisputar({ partidoId }: { partidoId: string }) {
  const router = useRouter();
  const [estado, disputar, pendiente] = useActionState(disputarResultado, vacio);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    if (estado.ok) router.replace("/partidos?listo=disputa");
  }, [estado.ok, router]);

  return (
    <>
      <button type="button" className="btn rojo bloque" onClick={() => setAbierta(true)}>
        No fue así
      </button>
      <HojaDisputa
        partidoId={partidoId}
        abierta={abierta}
        cerrar={() => setAbierta(false)}
        accion={disputar}
        pendiente={pendiente}
        estado={estado}
      />
    </>
  );
}
