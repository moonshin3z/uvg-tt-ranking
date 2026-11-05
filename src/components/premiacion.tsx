"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { divisionLarga } from "@/lib/ranking/divisiones";
import { nombreMedalla, nombresDeOro, type Podio, type Premiado, type Puesto } from "@/lib/ranking/medallas";
import { Flecha } from "@/components/fila";
import { GLIFO } from "@/components/iconos";
import { Medalla } from "@/components/medalla";

/**
 * La premiación de un ranking cerrado: una fila que la abre y la pantalla
 * completa con la copa, el confeti y el oro y la plata de cada división.
 *
 * Con `auto`, se abre sola la primera vez que alguien entra después del
 * cierre. Que ya la vio se guarda en ese navegador: no hace falta cuenta, y si
 * el navegador no deja guardar nada, no se abre sola (mejor eso que salir en
 * cada visita).
 */
export function Premiacion({
  rankingId,
  rankingNombre,
  podios,
  auto = false,
}: {
  rankingId: string;
  rankingNombre: string;
  podios: Podio[];
  auto?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const enNavegador = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
  const clave = `ranking-uvg:premiacion:${rankingId}`;

  const marcarVista = useCallback(() => {
    try {
      localStorage.setItem(clave, "1");
    } catch {
      // Sin almacenamiento no pasa nada: solo no se recuerda.
    }
  }, [clave]);

  const abrir = () => {
    setAbierta(true);
    marcarVista();
  };
  const cerrar = useCallback(() => setAbierta(false), []);

  useEffect(() => {
    if (!auto) return;
    let vista = true;
    try {
      vista = localStorage.getItem(clave) === "1";
    } catch {
      vista = true;
    }
    if (vista) return;
    // Un respiro para que primero se vea la tabla y se entienda de dónde sale.
    const t = window.setTimeout(() => {
      setAbierta(true);
      marcarVista();
    }, 600);
    return () => window.clearTimeout(t);
  }, [auto, clave, marcarVista]);

  const oros = nombresDeOro(podios);

  return (
    <>
      <ul className="grupo">
        <li className="con-icono">
          <button type="button" className="celda" onClick={abrir}>
            <span aria-hidden className="icono" style={{ background: "#e0a100" }}>
              {GLIFO.trofeo}
            </span>
            <span className="medio">
              <span className="t-celda fuerte">Premiación</span>
              <span className="s-celda">{oros ? `Oro: ${oros}` : "Oro y plata de cada división"}</span>
            </span>
            <span className="derecha">
              <Flecha />
            </span>
          </button>
        </li>
      </ul>
      {enNavegador
        ? createPortal(
            <Escena
              abierta={abierta}
              cerrar={cerrar}
              rankingId={rankingId}
              rankingNombre={rankingNombre}
              podios={podios}
            />,
            document.body,
          )
        : null}
    </>
  );
}

const sinSuscripcion = () => () => {};

/**
 * La pantalla en sí. Vive fuera de `#app` (directo en el body) para quedar
 * encima de todo, incluida la barra de pestañas, y deja `#app` inerte mientras
 * está abierta.
 */
function Escena({
  abierta,
  cerrar,
  rankingId,
  rankingNombre,
  podios,
}: {
  abierta: boolean;
  cerrar: () => void;
  rankingId: string;
  rankingNombre: string;
  podios: Podio[];
}) {
  const tituloId = useId();
  const botonRef = useRef<HTMLButtonElement>(null);
  const lienzoRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!abierta) return;
    const html = document.documentElement;
    const app = document.getElementById("app");
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    html.classList.add("con-premiacion");
    app?.setAttribute("inert", "");
    const foco = window.setTimeout(() => botonRef.current?.focus({ preventScroll: true }), 60);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", escape);
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parar = !quieto && lienzoRef.current ? lanzarConfeti(lienzoRef.current) : () => {};
    return () => {
      window.clearTimeout(foco);
      html.classList.remove("con-premiacion");
      app?.removeAttribute("inert");
      document.removeEventListener("keydown", escape);
      parar();
      antes?.focus({ preventScroll: true });
    };
  }, [abierta, cerrar]);

  const retraso = (i: number) => ({ "--retraso": `${0.6 + i * 0.35}s` }) as React.CSSProperties;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      aria-hidden={!abierta}
      inert={!abierta}
      className={cn("premiacion", abierta && "ver")}
    >
      <canvas ref={lienzoRef} className="premiacion-confeti" aria-hidden />
      <button ref={botonRef} type="button" className="premiacion-cerrar" onClick={cerrar} aria-label="Cerrar">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <div className="premiacion-cuerpo">
        <div className="premiacion-copa" aria-hidden>
          {COPA}
        </div>
        <p className="premiacion-antetitulo">{rankingNombre}</p>
        <h2 id={tituloId} className="premiacion-titulo">
          ¡Terminó el ranking!
        </h2>
        <p className="premiacion-bajada">Estos son los que se llevan medalla.</p>
        {podios.map((p, i) =>
          p.oro || p.plata ? (
            <section key={p.division} className="podio" style={retraso(i)}>
              <h3>{divisionLarga(p.division)}</h3>
              {p.oro ? <Persona puesto={1} p={p.oro} cerrar={cerrar} /> : null}
              {p.plata ? <Persona puesto={2} p={p.plata} cerrar={cerrar} /> : null}
            </section>
          ) : null,
        )}
        <div className="premiacion-acciones" style={retraso(podios.length)}>
          <Link href={`/rankings/${rankingId}` as Route} className="btn bloque premiacion-boton" onClick={cerrar}>
            Ver la tabla final
          </Link>
          <button type="button" className="btn texto bloque premiacion-texto" onClick={cerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Persona({ puesto, p, cerrar }: { puesto: Puesto; p: Premiado; cerrar: () => void }) {
  return (
    <Link href={`/jugador/${encodeURIComponent(p.carnet)}` as Route} className="podio-fila" onClick={cerrar}>
      <Medalla puesto={puesto} tamano={34} className="podio-medalla" />
      <span className="podio-medio">
        <span className="podio-nombre">{p.nombre}</span>
        <span className="podio-sub">
          {nombreMedalla(puesto)} · {p.pg} de {p.pj} ganados
        </span>
      </span>
    </Link>
  );
}

const COPA = (
  <svg width="112" height="112" viewBox="0 0 64 64" aria-hidden>
    <path d="M21 9h22v13.5a11 11 0 0 1-22 0z" fill="#f6c744" />
    <path
      d="M21 12.5h-6a2.5 2.5 0 0 0-2.5 2.5v1.5a9 9 0 0 0 9 9M43 12.5h6a2.5 2.5 0 0 1 2.5 2.5v1.5a9 9 0 0 1-9 9"
      fill="none"
      stroke="#f6c744"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <path d="M29 33h6v8.5h-6z" fill="#d39e0c" />
    <rect x="22" y="41" width="20" height="5.5" rx="2" fill="#f6c744" />
    <rect x="18" y="46.5" width="28" height="7.5" rx="2.6" fill="#d39e0c" />
    <path d="M38.5 9h4.5v13.5a11 11 0 0 1-11 11 11 11 0 0 0 6.5-10z" fill="#d39e0c" fillOpacity="0.55" />
    <path
      d="M24.8 13v8.2a7.6 7.6 0 0 0 2.6 5.6"
      fill="none"
      stroke="#fff"
      strokeOpacity="0.55"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <path d="m32 14.2 1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z" fill="#fff6d1" />
  </svg>
);

type Pieza = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  giro: number;
  vgiro: number;
  fase: number;
  ancho: number;
  alto: number;
  redonda: boolean;
  color: string;
};

const COLORES_CONFETI = ["#f6c744", "#ffe08a", "#e2e6eb", "#ffffff", "#1dbb68", "#7ee2a8"];

/**
 * Dos cañones de confeti desde las esquinas de abajo. Un canvas y
 * requestAnimationFrame, sin librerías. Devuelve con qué pararlo.
 */
function lanzarConfeti(lienzo: HTMLCanvasElement): () => void {
  const ctx = lienzo.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  lienzo.width = Math.round(ancho * dpr);
  lienzo.height = Math.round(alto * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const azar = (min: number, max: number) => min + Math.random() * (max - min);
  const piezas: Pieza[] = Array.from({ length: 160 }, (_, i) => {
    const izquierda = i % 2 === 0;
    return {
      x: izquierda ? azar(-12, 8) : azar(ancho - 8, ancho + 12),
      y: alto * azar(0.62, 0.8),
      vx: (izquierda ? 1 : -1) * azar(3, 10.5),
      vy: -azar(11, 19),
      giro: azar(0, Math.PI * 2),
      vgiro: azar(-0.25, 0.25),
      fase: azar(0, Math.PI * 2),
      ancho: azar(6, 11),
      alto: azar(3.5, 6),
      redonda: Math.random() < 0.25,
      color: COLORES_CONFETI[i % COLORES_CONFETI.length],
    };
  });

  let marco = 0;
  const inicio = performance.now();
  const paso = (t: number) => {
    ctx.clearRect(0, 0, ancho, alto);
    let vivas = 0;
    for (const p of piezas) {
      p.vx *= 0.96;
      p.vy = p.vy * 0.96 + 0.18;
      p.x += p.vx + Math.sin((t - inicio) / 280 + p.fase) * 0.7;
      p.y += p.vy;
      p.giro += p.vgiro;
      if (p.y > alto + 24) continue;
      vivas++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.scale(1, Math.cos(p.giro * 1.6));
      ctx.fillStyle = p.color;
      if (p.redonda) {
        ctx.beginPath();
        ctx.arc(0, 0, p.ancho / 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto);
      }
      ctx.restore();
    }
    if (vivas > 0 && t - inicio < 7000) marco = requestAnimationFrame(paso);
    else ctx.clearRect(0, 0, ancho, alto);
  };
  marco = requestAnimationFrame(paso);
  return () => {
    cancelAnimationFrame(marco);
    ctx.clearRect(0, 0, ancho, alto);
  };
}
