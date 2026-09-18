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
    <li className="border-b border-linea-suave last:border-b-0">
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
    <li className="border-b border-linea-suave last:border-b-0">
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
    <span className={cn("text-[15px] font-semibold", gano ? "text-primary" : "text-muted-foreground")}>{texto}</span>
  );
}

/** La flecha de una fila que lleva a otra pantalla. */
export function Flecha() {
  return <ChevronRight aria-hidden className="size-[18px] text-faint" strokeWidth={2} />;
}

/** La pastilla de acción a la derecha de una fila. */
export function Pastilla({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-3.5 text-[14px] font-semibold text-primary-foreground">
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
        "px-4 pt-5 pb-2 text-[13px] font-semibold",
        urgente ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </h2>
  );
}

/** Las notas al pie de una pantalla. */
export function Pie({ children }: { children: React.ReactNode }) {
  return <p className="px-4 pt-3.5 pb-5 text-[13px] leading-[1.65] text-pretty text-muted-foreground">{children}</p>;
}

/** El bloque de filas que va debajo de un rótulo. */
export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="border-y border-linea-suave bg-card">{children}</ul>;
}

/**
 * El bloque grande con el marcador de un partido, en el detalle.
 * `.tarjeta-num` del prototipo.
 */
export function TarjetaMarcador({ marcador, sets }: { marcador: string; sets?: string }) {
  return (
    <div className="my-5 rounded-xl border border-border px-4 py-5 text-center">
      <div className="text-[44px] leading-none font-semibold tracking-[-0.04em]">{marcador}</div>
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
    <div className="bg-uvg-profundo px-4 pt-6 pb-5 text-white">
      <p className="text-[24px] font-semibold tracking-[-0.03em]">{nombre}</p>
      <p className="mt-0.5 text-[13.5px] text-white/[0.66]">{bajo}</p>
      {puesto ? (
        <div className="mt-[18px] flex items-baseline gap-2.5">
          <span className="text-[52px] leading-[0.9] font-bold tracking-[-0.05em]">{puesto}</span>
          {detalle ? <span className="text-[14.5px] text-pretty text-white/[0.78]">{detalle}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** La tira de cuatro cifras debajo de la cabecera del perfil. */
export function Cifras({ datos }: { datos: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-4 border-b border-border bg-card">
      {datos.map(([etiqueta, valor], i) => (
        <div
          key={etiqueta}
          className={cn("px-1 py-[15px] text-center", i < datos.length - 1 && "border-r border-linea-suave")}
        >
          <b className="block text-[21px] font-bold tracking-[-0.02em]">{valor}</b>
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
      className="flex min-h-14 w-full items-center gap-3 border-b border-border bg-card px-4 py-[11px] transition-[background-color,transform] duration-150 ease-out active:scale-[0.985] active:bg-uvg-suave"
    >
      <span aria-hidden className="ml-3.5 size-[9px] shrink-0 rounded-full bg-uvg" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold tracking-[-0.01em]">{nombre}</span>
        <span className="mt-px block text-[12.5px] text-muted-foreground">{sub}</span>
      </span>
      <Flecha />
    </Link>
  );
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
  return (
    <nav className="mx-4 mt-3 mb-3.5 flex gap-0.5 rounded-md bg-linea-suave p-0.5">
      {opciones.map((o) => (
        <Link
          key={o.valor}
          href={o.href}
          scroll={false}
          aria-current={o.valor === actual ? "page" : undefined}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center rounded-[6px] text-[14.5px] transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]",
            o.valor === actual
              ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(6,56,31,0.08)]"
              : "font-medium text-muted-foreground",
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
    <div className="flex items-center justify-between gap-3 border-b border-linea-suave px-4 py-[13px] text-[15px]">
      <span className="text-muted-foreground">{children}</span>
      <b className="font-semibold tabular-nums">{valor}</b>
    </div>
  );
}

/** La franja verde clara de arriba del panel, con el estado en una línea. */
export function Nota({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-border bg-uvg-suave px-4 py-[15px] text-[14px] text-pretty text-uvg-profundo">
      {children}
    </p>
  );
}

/** La pastilla chica de acción a la derecha de una fila. `.btn.chico`. */
export function PastillaChica({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-3.5 text-[14px] font-semibold text-primary-foreground">
      {children}
    </span>
  );
}
