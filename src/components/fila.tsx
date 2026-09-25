import type { Route } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * La fila, copiada de `docs/diseno/v4-prototipo.html`.
 *
 * Es la única forma que tiene un partido en toda la aplicación, venga del
 * ranking o de un torneo. Tres zonas: las iniciales del rival, el nombre con
 * una línea de contexto debajo, y a la derecha el resultado o la acción.
 *
 * Las medidas son las del prototipo: 60px de alto, 11px arriba y abajo,
 * 16px a los lados, 12px entre zonas, círculo de 38px.
 *
 * Dos cosas se apartan del prototipo a propósito, y las dos por decisiones ya
 * cerradas:
 *   · el prototipo usa monoespaciada para el marcador y las iniciales; acá va
 *     Figtree con cifras tabulares, porque el diseño quedó con una sola
 *     familia;
 *   · el verde de un partido ganado es `#0a7d40` y no el institucional
 *     `#0b9e51`, que como texto da 3.11:1 y no llega a AA.
 */

/** "Diego Menchú" → "DM". Una sola palabra da sus dos primeras letras. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

type Props = {
  nombre: string;
  /** La línea chica de abajo: la división, cuándo se jugó, de qué torneo es. */
  sub?: string;
  /** Lo de la derecha: el marcador, una pastilla, la flecha. */
  derecha?: React.ReactNode;
  /** Si la fila entera lleva a algún lado. Sin esto, la fila queda quieta. */
  href?: Route;
  /**
   * Qué va dentro del círculo, si no son las iniciales del nombre. El prototipo
   * lo usa para símbolos y cifras: «!» en lo urgente, «+» en crear, «↓» en
   * exportar, el número de jugadores en la fila del club.
   */
  ini?: string;
  /**
   * Sin el círculo de iniciales. En el prototipo el círculo sale solo cuando
   * la fila es una persona: las de «Cuenta», que son acciones, no lo llevan.
   */
  sinInicial?: boolean;
  /** Debajo de la fila, dentro del mismo bloque. */
  children?: React.ReactNode;
};

const FILA =
  "flex w-full items-center gap-3 px-4 py-[11px] min-h-[62px] text-left bg-card transition-[background-color,transform] duration-150 ease-out active:scale-[0.985] active:bg-uvg-suave";

function Contenido({ nombre, sub, derecha, ini, sinInicial }: Omit<Props, "href" | "children">) {
  return (
    <>
      {sinInicial ? null : (
        <span
          aria-hidden
          className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-uvg-suave text-[13px] font-semibold text-uvg-profundo"
        >
          {ini ?? iniciales(nombre)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15.5px] font-medium tracking-[-0.01em]">{nombre}</span>
        {sub ? <span className="mt-px block truncate text-[13px] text-muted-foreground">{sub}</span> : null}
      </span>
      {derecha ? <span className="flex shrink-0 items-center gap-2">{derecha}</span> : null}
    </>
  );
}

export function Fila({ nombre, sub, derecha, href, ini, sinInicial, children }: Props) {
  const contenido = <Contenido nombre={nombre} sub={sub} derecha={derecha} ini={ini} sinInicial={sinInicial} />;

  return (
    <li className={sinInicial ? undefined : "con-ini"}>
      {href ? (
        <Link href={href} className={FILA}>
          {contenido}
        </Link>
      ) : (
        <div className={FILA}>{contenido}</div>
      )}
      {children ? <div className="flex flex-col gap-2 bg-card px-4 pb-3">{children}</div> : null}
    </li>
  );
}

/**
 * La misma fila, pero que hace algo en vez de llevar a algún lado.
 *
 * Va con un formulario y no con un enlace a propósito. Salir por un enlace
 * sería un GET, y Next precarga los enlaces que ve en pantalla: bastaría con
 * que la fila entrara al viewport para cerrarle la sesión a alguien que solo
 * estaba mirando su perfil.
 */
export function FilaAccion({
  nombre,
  sub,
  derecha,
  ini,
  sinInicial,
  accion,
}: Omit<Props, "href" | "children"> & { accion: () => Promise<void> }) {
  return (
    <li className={sinInicial ? undefined : "con-ini"}>
      <form action={accion}>
        <button type="submit" className={FILA}>
          <Contenido nombre={nombre} sub={sub} derecha={derecha} ini={ini} sinInicial={sinInicial} />
        </button>
      </form>
    </li>
  );
}

/** El marcador de un partido jugado: `3-1`, en verde si lo ganó quien mira. */
export function Marcador({ texto, gano }: { texto: string; gano: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[15px] font-semibold",
        gano ? "bg-uvg-suave text-primary" : "bg-linea-suave text-muted-foreground",
      )}
    >
      {texto}
    </span>
  );
}

/** La flecha de una fila que lleva a otra pantalla. */
export function Flecha() {
  return <ChevronRight aria-hidden className="size-[18px] text-faint" strokeWidth={2} />;
}

/** La pastilla de acción a la derecha de una fila. */
export function Pastilla({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-3.5 text-[14px] font-semibold text-primary-foreground">
      {children}
    </span>
  );
}

/** El rótulo de una sección: 11px, mayúsculas, espaciado, gris claro. */
export function Rotulo({ children, urgente = false }: { children: React.ReactNode; urgente?: boolean }) {
  return (
    <h2
      /* "Rótulos en caja y tono, no en mayúsculas espaciadas", dice el
         prototipo. 13px, peso 600, gris; en rojo lo que te toca a vos. */
      className={cn(
        "px-5 pt-[22px] pb-2 text-[13px] font-semibold",
        urgente ? "flex items-center gap-2 text-destructive" : "text-muted-foreground",
      )}
    >
      {urgente ? (
        <span
          aria-hidden
          className="size-[7px] animate-[latido_1.8s_ease-in-out_infinite] rounded-full bg-destructive"
        />
      ) : null}
      {children}
    </h2>
  );
}

/** Las notas al pie de una pantalla. */
export function Pie({ children }: { children: React.ReactNode }) {
  return <p className="px-5 pt-3.5 pb-5 text-[13px] leading-[1.65] text-pretty text-muted-foreground">{children}</p>;
}

/** El bloque de filas que va debajo de un rótulo. */
export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="lista tarjeta">{children}</ul>;
}

/**
 * El bloque grande con el marcador de un partido, en el detalle.
 * `.tarjeta-num` del prototipo.
 */
export function TarjetaMarcador({ marcador, sets }: { marcador: string; sets?: string }) {
  return (
    <div className="my-5 rounded-[20px] bg-card px-4 py-6 text-center shadow-tarjeta">
      <div className="text-[52px] leading-none font-bold tracking-[-0.05em]">{marcador}</div>
      {sets ? <div className="mt-[9px] text-[14px] text-muted-foreground">{sets}</div> : null}
    </div>
  );
}

/** La pila de acciones del detalle: una debajo de otra, a todo el ancho. */
export function Pila({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-[9px]">{children}</div>;
}

/** La línea de contexto centrada debajo de la pila de acciones. */
export function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-center text-[13.5px] text-pretty text-muted-foreground">{children}</p>;
}

/**
 * La cabecera del perfil: verde profundo, el nombre grande y el puesto en
 * cifra enorme. `.perfil-cab` del prototipo.
 */
export function CabeceraPerfil({
  nombre,
  bajo,
  puesto,
  detalle,
}: {
  nombre: string;
  /** Carnet y división, la línea chica de abajo. */
  bajo: string;
  /** El puesto, ya formateado: "4.º". Sin puesto, no se dibuja el bloque. */
  puesto?: string;
  detalle?: React.ReactNode;
}) {
  return (
    <div className="rounded-b-[30px] bg-[radial-gradient(120%_90%_at_100%_0%,#0d7a42_0%,#06381f_62%)] px-5 pt-6 pb-12 text-white">
      <p className="text-[26px] font-bold tracking-[-0.035em]">{nombre}</p>
      <p className="mt-0.5 text-[13.5px] text-white/[0.66]">{bajo}</p>
      {puesto ? (
        <div className="mt-[18px] flex items-baseline gap-2.5">
          <span className="text-[56px] leading-[0.9] font-bold tracking-[-0.05em]">{puesto}</span>
          {detalle ? <span className="text-[14.5px] text-pretty text-white/[0.78]">{detalle}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** La tira de cuatro cifras debajo de la cabecera del perfil. */
export function Cifras({ datos }: { datos: [string, React.ReactNode][] }) {
  return (
    <div className="relative mx-3.5 -mt-8 grid grid-cols-4 overflow-hidden rounded-[20px] bg-card shadow-tarjeta">
      {datos.map(([etiqueta, valor], i) => (
        <div
          key={etiqueta}
          className={cn("px-1 py-[15px] text-center", i < datos.length - 1 && "border-r border-linea-suave")}
        >
          <b className="block text-[22px] font-bold tracking-[-0.02em]">{valor}</b>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * La franja del torneo en curso, arriba de la tabla. `.franja` del prototipo.
 *
 * Solo existe mientras hay un torneo. El resto del año no ocupa un pixel: sin
 * torneo no deja hueco ni un mensaje que diga que no hay.
 */
export function Franja({ nombre, sub, href }: { nombre: string; sub: string; href: Route }) {
  return (
    <Link
      href={href}
      className="mx-3.5 mt-3 flex min-h-[60px] items-center gap-3 rounded-[20px] bg-[linear-gradient(135deg,#0a6b38,#06381f)] px-3.5 py-3 text-white shadow-[0_12px_26px_-16px_rgba(6,56,31,0.7)] transition-transform duration-200 ease-out active:scale-[0.985]"
    >
      <span
        aria-hidden
        className="ml-1 size-2.5 shrink-0 animate-[vivo_2s_ease-out_infinite] rounded-full bg-[#7ad14f]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold tracking-[-0.01em]">{nombre}</span>
        <span className="mt-px block text-[12.5px] text-white/70">{sub}</span>
      </span>
      <ChevronRight aria-hidden className="size-[18px] text-white/60" strokeWidth={2} />
    </Link>
  );
}

/**
 * La franja de tus partidos, arriba de la tabla y de la franja del torneo.
 *
 * Es lo que la portada le reclama a quien tiene sesión: un resultado por
 * confirmar, un desempate o los partidos que le quedan. Blanca y no verde
 * oscura para no competir con la del torneo; la cifra en el círculo es lo
 * primero que se lee. Sin nada pendiente no se dibuja.
 */
export function FranjaPartidos({
  cifra,
  titulo,
  sub,
  href,
  urgente = false,
}: {
  cifra: number;
  titulo: string;
  sub: string;
  href: Route;
  /** Rojo en vez de verde: un resultado que se confirma solo si no respondés. */
  urgente?: boolean;
}) {
  return (
    <Link
      href={href}
      className="mx-3.5 mt-3 flex min-h-[64px] items-center gap-3 rounded-[20px] bg-card px-3.5 py-3 shadow-tarjeta transition-transform duration-200 ease-out active:scale-[0.985]"
    >
      <span
        aria-hidden
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-[16px] font-bold",
          urgente ? "bg-malo-suave text-destructive" : "bg-uvg-suave text-primary",
        )}
      >
        {cifra}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">{titulo}</span>
        <span className="mt-px block text-[12.5px] text-pretty text-muted-foreground">{sub}</span>
      </span>
      <Flecha />
    </Link>
  );
}

/**
 * Las piezas del selector segmentado. La opción elegida la marca una píldora
 * blanca que se desliza de una opción a la otra en vez de saltar: la
 * navegación conserva el mismo elemento, así que la transición corre sola.
 */
export const SEG_PISTA = "relative mx-4 mt-3 mb-3 grid auto-cols-fr grid-flow-col rounded-full bg-[#e3e9e2] p-[3px]";
export const SEG_PILDORA =
  "absolute inset-y-[3px] left-[3px] rounded-full bg-card shadow-[0_1px_3px_rgba(6,56,31,0.12),0_4px_10px_-6px_rgba(6,56,31,0.2)] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
export const SEG_OPCION =
  "relative z-10 flex min-h-10 items-center justify-center rounded-full text-[14.5px] transition-[color,transform] duration-300 ease-out active:scale-[0.97]";
export function pildora(i: number, n: number): React.CSSProperties {
  return { width: `calc((100% - 6px) / ${n})`, transform: `translateX(${i * 100}%)` };
}

/**
 * El selector de dos opciones: División Mayor/Menor, Grupos/Cuadro.
 * `.seg` del prototipo.
 */
export function Segmentado({
  opciones,
  actual,
}: {
  opciones: { href: Route; etiqueta: string; valor: string }[];
  actual: string;
}) {
  const i = Math.max(
    0,
    opciones.findIndex((o) => o.valor === actual),
  );
  return (
    <nav className={SEG_PISTA}>
      <span aria-hidden className={SEG_PILDORA} style={pildora(i, opciones.length)} />
      {opciones.map((o) => (
        <Link
          key={o.valor}
          href={o.href}
          scroll={false}
          aria-current={o.valor === actual ? "page" : undefined}
          className={cn(
            SEG_OPCION,
            o.valor === actual ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
          )}
        >
          {o.etiqueta}
        </Link>
      ))}
    </nav>
  );
}

/** Un dato suelto: el rótulo a la izquierda y la cifra a la derecha. `.dato`. */
export function Dato({ children, valor }: { children: React.ReactNode; valor: React.ReactNode }) {
  return (
    <div className="dato flex items-center justify-between gap-3 px-4 py-[14px] text-[15px]">
      <span className="text-muted-foreground">{children}</span>
      <b className="font-semibold tabular-nums">{valor}</b>
    </div>
  );
}

/** La franja verde clara de arriba del panel, con el estado en una línea. */
export function Nota({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-3.5 mt-3 rounded-[20px] bg-uvg-suave px-4 py-[15px] text-[14px] text-pretty text-uvg-profundo">
      {children}
    </p>
  );
}

/** La pastilla chica de acción a la derecha de una fila. `.btn.chico`. */
export function PastillaChica({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-3.5 text-[14px] font-semibold text-primary-foreground">
      {children}
    </span>
  );
}
