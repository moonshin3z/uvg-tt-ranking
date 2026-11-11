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

/**
 * La premiación de un ranking cerrado, como una ceremonia en el teléfono:
 *
 * 1. La intro: reflectores, rayos que giran detrás de la copa y fuegos
 *    artificiales.
 * 2. Una pantalla por división: sube el bloque de la plata, aparece quién la
 *    ganó, y después sube el del oro con un destello y una ráfaga de confeti.
 * 3. El resumen con el oro y la plata de todas, para quedarse mirando.
 *
 * Avanza sola como las historias de Instagram (las barritas de arriba marcan
 * el tiempo): tocar a la derecha adelanta, a la izquierda vuelve, mantener
 * apretado pausa, y «Saltar» va directo al resumen. Con movimiento reducido
 * abre directo en el resumen y sin partículas.
 *
 * Con `auto`, se abre sola la primera vez que alguien entra después del
 * cierre. Que ya la vio se guarda en ese navegador; si el navegador no deja
 * guardar nada, no se abre sola (mejor eso que salir en cada visita).
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
  const [escena, setEscena] = useState(0);
  const [vuelta, setVuelta] = useState(0);
  const enNavegador = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
  const divisiones = podios.filter((p) => p.oro || p.plata);
  const resumen = divisiones.length + 1;
  const clave = `ranking-uvg:premiacion:${rankingId}`;

  const marcarVista = useCallback(() => {
    try {
      localStorage.setItem(clave, "1");
    } catch {
      // Sin almacenamiento no pasa nada: solo no se recuerda.
    }
  }, [clave]);

  const empezar = useCallback(() => {
    setEscena(movimientoReducido() ? resumen : 0);
    setVuelta((v) => v + 1);
    setAbierta(true);
    marcarVista();
  }, [marcarVista, resumen]);

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
    const t = window.setTimeout(empezar, 600);
    return () => window.clearTimeout(t);
  }, [auto, clave, empezar]);

  const oros = nombresDeOro(podios);

  return (
    <>
      <ul className="grupo">
        <li className="con-icono">
          <button type="button" className="celda" onClick={empezar}>
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
            <Ceremonia
              abierta={abierta}
              cerrar={cerrar}
              escena={escena}
              setEscena={setEscena}
              vuelta={vuelta}
              repetir={empezar}
              rankingId={rankingId}
              rankingNombre={rankingNombre}
              podios={podios}
              divisiones={divisiones}
            />,
            document.body,
          )
        : null}
    </>
  );
}

const sinSuscripcion = () => () => {};
const movimientoReducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Cuánto dura cada pantalla antes de pasar sola a la siguiente. */
const DURACION_INTRO = 3800;
const DURACION_DIVISION = 6200;

/**
 * La pantalla completa. Vive fuera de `#app` (directo en el body) para quedar
 * encima de todo, incluida la barra de pestañas, y deja `#app` inerte mientras
 * está abierta.
 */
function Ceremonia({
  abierta,
  cerrar,
  escena,
  setEscena,
  vuelta,
  repetir,
  rankingId,
  rankingNombre,
  podios,
  divisiones,
}: {
  abierta: boolean;
  cerrar: () => void;
  escena: number;
  setEscena: React.Dispatch<React.SetStateAction<number>>;
  vuelta: number;
  repetir: () => void;
  rankingId: string;
  rankingNombre: string;
  podios: Podio[];
  divisiones: Podio[];
}) {
  const tituloId = useId();
  const botonRef = useRef<HTMLButtonElement>(null);
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const fiestaRef = useRef<Fiesta | null>(null);
  const oroRef = useRef<HTMLDivElement>(null);
  const plataRef = useRef<HTMLDivElement>(null);
  const presion = useRef(0);
  const [pausa, setPausa] = useState(false);

  const resumen = divisiones.length + 1;
  const enHistoria = escena < resumen;
  const siguiente = useCallback(() => setEscena((e) => Math.min(e + 1, resumen)), [setEscena, resumen]);
  const anterior = useCallback(() => setEscena((e) => Math.max(e - 1, 0)), [setEscena]);

  // Lo que dura mientras está abierta: el foco, `#app` inerte, el teclado y
  // el lienzo de las partículas.
  const teclas = useRef({ cerrar, siguiente, anterior, enHistoria });
  useEffect(() => {
    teclas.current = { cerrar, siguiente, anterior, enHistoria };
  });
  useEffect(() => {
    if (!abierta) return;
    const html = document.documentElement;
    const app = document.getElementById("app");
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    html.classList.add("con-premiacion");
    app?.setAttribute("inert", "");
    const foco = window.setTimeout(() => botonRef.current?.focus({ preventScroll: true }), 60);
    const tecla = (e: KeyboardEvent) => {
      const t = teclas.current;
      if (e.key === "Escape") t.cerrar();
      else if (t.enHistoria && e.key === "ArrowRight") t.siguiente();
      else if (t.enHistoria && e.key === "ArrowLeft") t.anterior();
    };
    document.addEventListener("keydown", tecla);
    fiestaRef.current = lienzoRef.current && !movimientoReducido() ? new Fiesta(lienzoRef.current) : null;
    return () => {
      window.clearTimeout(foco);
      html.classList.remove("con-premiacion");
      app?.removeAttribute("inert");
      document.removeEventListener("keydown", tecla);
      fiestaRef.current?.destruir();
      fiestaRef.current = null;
      antes?.focus({ preventScroll: true });
    };
  }, [abierta]);

  // Las partículas de cada pantalla, sincronizadas con sus animaciones de CSS.
  useEffect(() => {
    const f = fiestaRef.current;
    if (!abierta || !f) return;
    const timers: number[] = [];
    const en = (ms: number, hacer: () => void) => timers.push(window.setTimeout(hacer, ms));
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    const centro = (el: HTMLElement | null, x: number, y: number) => {
      const r = el?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 60) } : { x, y };
    };
    if (escena === 0) {
      en(1000, () => f.fuego(ancho * 0.24, alto * 0.22));
      en(1450, () => f.fuego(ancho * 0.78, alto * 0.16));
      en(1900, () => f.fuego(ancho * 0.52, alto * 0.1));
      en(2500, () => f.fuego(ancho * 0.3, alto * 0.12));
    } else if (escena < resumen) {
      en(1000, () => {
        const c = centro(plataRef.current, ancho * 0.28, alto * 0.45);
        f.chispas(c.x, c.y);
      });
      en(2300, () => {
        const c = centro(oroRef.current, ancho * 0.72, alto * 0.38);
        f.rafaga(c.x, c.y);
        f.fuego(c.x, c.y - 40);
      });
      en(2900, () => f.fuego(ancho * 0.22, alto * 0.14));
      en(3400, () => f.fuego(ancho * 0.8, alto * 0.1));
    } else {
      en(150, () => f.canones());
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [abierta, escena, vuelta, resumen]);

  const soltar = (e: React.PointerEvent) => {
    const larga = Date.now() - presion.current > 350;
    setPausa(false);
    if (larga) return;
    if (e.clientX < window.innerWidth * 0.3) anterior();
    else siguiente();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      aria-hidden={!abierta}
      inert={!abierta}
      className={cn("premiacion", abierta && "ver", pausa && "pausada")}
    >
      <canvas ref={lienzoRef} className="premiacion-confeti" aria-hidden />

      {abierta && enHistoria ? (
        <div className="prem-progreso" aria-hidden>
          {Array.from({ length: resumen }, (_, i) => (
            <span key={i} className="prem-segmento">
              {i < escena ? <span className="prem-relleno lleno" /> : null}
              {i === escena ? (
                <span
                  key={`${i}-${vuelta}`}
                  className="prem-relleno activo"
                  style={{ animationDuration: `${i === 0 ? DURACION_INTRO : DURACION_DIVISION}ms` }}
                  onAnimationEnd={siguiente}
                />
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

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

      {abierta && enHistoria ? (
        <div
          className="prem-area"
          onPointerDown={() => {
            presion.current = Date.now();
            setPausa(true);
          }}
          onPointerUp={soltar}
          onPointerCancel={() => setPausa(false)}
          onPointerLeave={() => setPausa(false)}
        >
          {escena === 0 ? (
            <Intro key={`intro-${vuelta}`} tituloId={tituloId} rankingNombre={rankingNombre} />
          ) : (
            <PantallaDivision
              key={`div-${escena}-${vuelta}`}
              tituloId={tituloId}
              podio={divisiones[escena - 1]}
              numero={escena}
              total={divisiones.length}
              oroRef={oroRef}
              plataRef={plataRef}
            />
          )}
        </div>
      ) : null}

      {abierta && enHistoria ? (
        <button type="button" className="prem-saltar" onClick={() => setEscena(resumen)}>
          Saltar
        </button>
      ) : null}

      {abierta && !enHistoria ? (
        <Resumen
          key={`resumen-${vuelta}`}
          tituloId={tituloId}
          rankingId={rankingId}
          rankingNombre={rankingNombre}
          podios={podios}
          cerrar={cerrar}
          repetir={repetir}
        />
      ) : null}
    </div>
  );
}

function Intro({ tituloId, rankingNombre }: { tituloId: string; rankingNombre: string }) {
  return (
    <div className="prem-escena prem-intro">
      <span className="prem-foco izq" aria-hidden />
      <span className="prem-foco der" aria-hidden />
      <span className="prem-rayos" aria-hidden />
      <p className="prem-antetitulo">{rankingNombre}</p>
      <h2 id={tituloId} className="prem-titulo-grande">
        ¡Terminó el ranking!
      </h2>
      <p className="prem-bajada">Llegó la hora de los campeones</p>
    </div>
  );
}

function PantallaDivision({
  tituloId,
  podio,
  numero,
  total,
  oroRef,
  plataRef,
}: {
  tituloId: string;
  podio: Podio;
  numero: number;
  total: number;
  oroRef: React.RefObject<HTMLDivElement | null>;
  plataRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="prem-escena prem-division">
      <span className="prem-destello" aria-hidden />
      <div className="prem-cabeza">
        <p className="prem-antetitulo">
          {numero} de {total}
        </p>
        <h2 id={tituloId} className="prem-titulo-division">
          {divisionLarga(podio.division)}
        </h2>
      </div>
      <div className="prem-podio">
        <Columna puesto={2} p={podio.plata} refPersona={plataRef} />
        <Columna puesto={1} p={podio.oro} refPersona={oroRef} />
      </div>
    </div>
  );
}

function Columna({
  puesto,
  p,
  refPersona,
}: {
  puesto: Puesto;
  p: Premiado | null;
  refPersona: React.RefObject<HTMLDivElement | null>;
}) {
  const oro = puesto === 1;
  return (
    <div className={cn("prem-columna", oro ? "oro" : "plata")}>
      {/* El suspenso antes del nombre: se ve mientras sube el bloque del oro. */}
      {oro && p ? (
        <span className="prem-suspenso" aria-hidden>
          Y el oro es para…
        </span>
      ) : null}
      {p ? (
        <div ref={refPersona} className="prem-persona">
          {oro ? (
            <>
              <span className="prem-rayos oro" aria-hidden />
            </>
          ) : null}
          <span className="prem-nombre">{p.nombre}</span>
          <span className="prem-dato">
            {nombreMedalla(puesto)} · {p.pg} de {p.pj} ganados
          </span>
        </div>
      ) : null}
      <div className="prem-bloque">
        <span className="prem-num">{puesto}</span>
      </div>
    </div>
  );
}

function Resumen({
  tituloId,
  rankingId,
  rankingNombre,
  podios,
  cerrar,
  repetir,
}: {
  tituloId: string;
  rankingId: string;
  rankingNombre: string;
  podios: Podio[];
  cerrar: () => void;
  repetir: () => void;
}) {
  const retraso = (i: number) => ({ "--retraso": `${0.25 + i * 0.18}s` }) as React.CSSProperties;
  return (
    <div className="premiacion-cuerpo">
      <p className="prem-antetitulo">{rankingNombre}</p>
      <h2 id={tituloId} className="premiacion-titulo">
        Los campeones
      </h2>
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
        <button type="button" className="btn texto bloque premiacion-texto" onClick={repetir}>
          Volver a verla
        </button>
        <button type="button" className="btn texto bloque premiacion-texto" onClick={cerrar}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function Persona({ puesto, p, cerrar }: { puesto: Puesto; p: Premiado; cerrar: () => void }) {
  return (
    <Link href={`/jugador/${encodeURIComponent(p.carnet)}` as Route} className="podio-fila" onClick={cerrar}>
      <span className={cn("podio-placa", puesto === 1 ? "oro" : "plata")} aria-hidden>
        {puesto}
      </span>
      <span className="podio-medio">
        <span className="podio-nombre">{p.nombre}</span>
        <span className="podio-sub">
          {nombreMedalla(puesto)} · {p.pg} de {p.pj} ganados
        </span>
      </span>
    </Link>
  );
}

type Particula = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  vida: number;
  max: number;
  tam: number;
  color: string;
  papel: boolean;
  giro: number;
  vgiro: number;
  fase: number;
  gravedad: number;
  arrastre: number;
};

const PAPELES = ["#f6c744", "#ffe08a", "#e2e6eb", "#ffffff", "#1dbb68", "#7ee2a8"];
const LUCES = ["#ffd75e", "#fff2c2", "#ffffff", "#8ff0b8"];
const MAX_PARTICULAS = 1100;

/**
 * Confeti y fuegos artificiales en un canvas, sin librerías. Las partículas
 * se agregan con ráfagas y el ciclo de dibujo se apaga solo cuando no queda
 * ninguna.
 */
class Fiesta {
  private ctx: CanvasRenderingContext2D | null;
  private ancho = 0;
  private alto = 0;
  private ps: Particula[] = [];
  private marco = 0;

  constructor(private lienzo: HTMLCanvasElement) {
    this.ctx = lienzo.getContext("2d");
    this.medir();
    window.addEventListener("resize", this.medir);
  }

  private medir = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.ancho = window.innerWidth;
    this.alto = window.innerHeight;
    this.lienzo.width = Math.round(this.ancho * dpr);
    this.lienzo.height = Math.round(this.alto * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private agregar(p: Omit<Particula, "px" | "py" | "vida">) {
    if (this.ps.length >= MAX_PARTICULAS) return;
    this.ps.push({ ...p, px: p.x, py: p.y, vida: 0 });
    if (!this.marco) this.marco = requestAnimationFrame(this.paso);
  }

  /** Confeti de papel que sale hacia arriba desde un punto. */
  rafaga(x: number, y: number, n = 110) {
    for (let i = 0; i < n; i++) {
      const angulo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      const v = azar(7, 16);
      this.agregar({
        x,
        y,
        vx: Math.cos(angulo) * v,
        vy: Math.sin(angulo) * v,
        max: azar(160, 240),
        tam: azar(6, 11),
        color: PAPELES[i % PAPELES.length],
        papel: true,
        giro: azar(0, Math.PI * 2),
        vgiro: azar(-0.28, 0.28),
        fase: azar(0, Math.PI * 2),
        gravedad: 0.2,
        arrastre: 0.955,
      });
    }
  }

  /** Dos cañones de confeti desde las esquinas de abajo. */
  canones(n = 150) {
    for (let i = 0; i < n; i++) {
      const izquierda = i % 2 === 0;
      this.agregar({
        x: izquierda ? azar(-12, 8) : azar(this.ancho - 8, this.ancho + 12),
        y: this.alto * azar(0.62, 0.82),
        vx: (izquierda ? 1 : -1) * azar(3, 10.5),
        vy: -azar(11, 19),
        max: 420,
        tam: azar(6, 11),
        color: PAPELES[i % PAPELES.length],
        papel: true,
        giro: azar(0, Math.PI * 2),
        vgiro: azar(-0.25, 0.25),
        fase: azar(0, Math.PI * 2),
        gravedad: 0.18,
        arrastre: 0.96,
      });
    }
  }

  /** Un fuego artificial: una esfera de chispas que brillan y se apagan. */
  fuego(x: number, y: number) {
    const color = LUCES[Math.floor(Math.random() * LUCES.length)];
    const n = 64;
    for (let i = 0; i < n; i++) {
      const angulo = (i / n) * Math.PI * 2 + azar(-0.05, 0.05);
      const v = azar(2.6, 5.6);
      this.agregar({
        x,
        y,
        vx: Math.cos(angulo) * v,
        vy: Math.sin(angulo) * v,
        max: azar(60, 95),
        tam: azar(1.6, 2.8),
        color: i % 5 === 0 ? "#ffffff" : color,
        papel: false,
        giro: 0,
        vgiro: 0,
        fase: 0,
        gravedad: 0.05,
        arrastre: 0.972,
      });
    }
  }

  /** Un puñado de chispas plateadas, más chico. */
  chispas(x: number, y: number) {
    for (let i = 0; i < 30; i++) {
      const angulo = azar(0, Math.PI * 2);
      const v = azar(1.4, 3.8);
      this.agregar({
        x,
        y,
        vx: Math.cos(angulo) * v,
        vy: Math.sin(angulo) * v,
        max: azar(40, 60),
        tam: azar(1.4, 2.2),
        color: i % 3 === 0 ? "#ffffff" : "#dfe5ec",
        papel: false,
        giro: 0,
        vgiro: 0,
        fase: 0,
        gravedad: 0.03,
        arrastre: 0.95,
      });
    }
  }

  private paso = (t: number) => {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.ancho, this.alto);
    const vivas: Particula[] = [];
    for (const p of this.ps) {
      p.px = p.x;
      p.py = p.y;
      p.vx *= p.arrastre;
      p.vy = p.vy * p.arrastre + p.gravedad;
      p.x += p.vx + (p.papel ? Math.sin(t / 280 + p.fase) * 0.7 : 0);
      p.y += p.vy;
      p.giro += p.vgiro;
      p.vida++;
      if (p.vida > p.max || p.y > this.alto + 30) continue;
      vivas.push(p);
      if (p.papel) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (p.max - p.vida) / 30);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.scale(1, Math.cos(p.giro * 1.6));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
        ctx.restore();
      } else {
        // Las chispas suman luz: sobre el verde oscuro brillan.
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.max(0, 1 - p.vida / p.max);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.tam;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.px - p.vx * 2, p.py - p.vy * 2);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
    }
    this.ps = vivas;
    this.marco = vivas.length > 0 ? requestAnimationFrame(this.paso) : 0;
    if (!this.marco) ctx.clearRect(0, 0, this.ancho, this.alto);
  };

  destruir() {
    cancelAnimationFrame(this.marco);
    this.marco = 0;
    this.ps = [];
    window.removeEventListener("resize", this.medir);
    this.ctx?.clearRect(0, 0, this.ancho, this.alto);
  }
}

function azar(min: number, max: number) {
  return min + Math.random() * (max - min);
}
