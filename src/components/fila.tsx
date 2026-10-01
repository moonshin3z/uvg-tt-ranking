import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Las piezas de las pantallas, copiadas del prototipo de iOS
 * (`docs/diseno/prototipo-ios.html`). Las clases viven en `globals.css` con
 * los mismos nombres que en el prototipo, para poder compararlos línea por
 * línea.
 *
 * La fila es la de una lista agrupada de Ajustes: a la izquierda las
 * iniciales en un círculo gris (una persona) o un cuadrito de color con un
 * glifo (una acción), el título con una línea debajo, y a la derecha el
 * resultado, una pastilla o la flecha. Las rayas entre filas no llegan al
 * borde izquierdo: arrancan donde empieza el texto.
 */

/** "Diego Menchú" → "DM". Una sola palabra da sus dos primeras letras. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** "Diego Menchú" → "Diego". */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

export type IconoFila = {
  /** El glifo blanco, o una cifra. */
  glifo: React.ReactNode;
  /** El color del cuadrito: `var(--rojo)`, `var(--uvg)`, etc. */
  color: string;
};

type Props = {
  nombre: string;
  /** La línea de abajo: la división, cuándo se jugó, de qué torneo es. */
  sub?: string;
  /** Lo de la derecha: el marcador, una pastilla, la flecha. */
  derecha?: React.ReactNode;
  /** Si la fila entera lleva a algún lado. Sin esto, la fila queda quieta. */
  href?: Route;
  /** Un cuadrito de color en vez de las iniciales: la fila es una acción. */
  icono?: IconoFila;
  /** Ni iniciales ni cuadrito: solo el texto. */
  sinInicial?: boolean;
  /** El título en negrita. */
  fuerte?: boolean;
  /** El título puede ocupar más de una línea en vez de cortarse con «…». */
  envolver?: boolean;
  /** Debajo de la fila, dentro del mismo bloque. */
  children?: React.ReactNode;
};

function Contenido({ nombre, sub, derecha, icono, sinInicial, fuerte, envolver }: Omit<Props, "href" | "children">) {
  return (
    <>
      {icono ? (
        <span aria-hidden className="icono" style={{ background: icono.color }}>
          {icono.glifo}
        </span>
      ) : sinInicial ? null : (
        <span aria-hidden className="av">
          {iniciales(nombre)}
        </span>
      )}
      <span className="medio">
        <span className={cn("t-celda", fuerte && "fuerte", envolver && "envuelve")}>{nombre}</span>
        {sub ? <span className="s-celda">{sub}</span> : null}
      </span>
      {derecha ? <span className="derecha">{derecha}</span> : null}
    </>
  );
}

function claseFila({ icono, sinInicial }: Pick<Props, "icono" | "sinInicial">) {
  return icono ? "con-icono" : sinInicial ? undefined : "con-av";
}

export function Fila({ nombre, sub, derecha, href, icono, sinInicial, fuerte, envolver, children }: Props) {
  const contenido = (
    <Contenido
      nombre={nombre}
      sub={sub}
      derecha={derecha}
      icono={icono}
      sinInicial={sinInicial}
      fuerte={fuerte}
      envolver={envolver}
    />
  );

  return (
    <li className={claseFila({ icono, sinInicial })}>
      {href ? (
        <Link href={href} className="celda">
          {contenido}
        </Link>
      ) : (
        <div className="celda">{contenido}</div>
      )}
      {children ? <div className="celda-extra">{children}</div> : null}
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
  icono,
  sinInicial,
  accion,
  peligro = false,
}: Omit<Props, "href" | "children" | "fuerte"> & { accion: () => Promise<void>; peligro?: boolean }) {
  return (
    <li className={peligro ? undefined : claseFila({ icono, sinInicial })}>
      <form action={accion}>
        <button type="submit" className={cn("celda", peligro && "peligro")}>
          {peligro ? (
            nombre
          ) : (
            <Contenido nombre={nombre} sub={sub} derecha={derecha} icono={icono} sinInicial={sinInicial} />
          )}
        </button>
      </form>
    </li>
  );
}

/** El resultado de un partido jugado: `3-1`, en verde si lo ganó quien mira. */
export function Marcador({ texto, gano }: { texto: string; gano: boolean }) {
  return <span className={cn("res", gano && "gano")}>{texto}</span>;
}

/** La flecha de una fila que lleva a otra pantalla. */
export function Flecha() {
  return (
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
  );
}

/** La pastilla de acción a la derecha de una fila: «Revisar», «Resolver». */
export function Pastilla({ children }: { children: React.ReactNode }) {
  return <span className="btn chico">{children}</span>;
}

/** El título de una sección, con la cuenta roja de lo que espera por vos. */
export function Rotulo({ children, cuenta }: { children: React.ReactNode; cuenta?: number }) {
  return (
    <h2 className="seccion">
      {children}
      {cuenta ? <span className="cuenta">{cuenta}</span> : null}
    </h2>
  );
}

/** La nota chica debajo de un bloque. */
export function Pie({ children, centro = false }: { children: React.ReactNode; centro?: boolean }) {
  return <p className={cn("pie", centro && "centro")}>{children}</p>;
}

/** El bloque blanco de esquinas redondas que agrupa filas. */
export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="grupo">{children}</ul>;
}

/**
 * El marcador grande del detalle de un partido, con los sets en pastillas
 * debajo: verdes los que ganaste, rojas los que perdiste.
 */
export function TarjetaMarcador({ marcador, sets }: { marcador: string; sets?: { mios: number; suyos: number }[] }) {
  return (
    <div className="marcador-grande">
      <div className="n">{marcador}</div>
      {sets && sets.length > 0 ? (
        <div className="chips">
          {sets.map((s, i) => (
            <span key={i} className={s.mios > s.suyos ? "mio" : "suyo"}>
              {s.mios}-{s.suyos}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** La pila de botones del detalle: uno debajo del otro, a todo el ancho. */
export function Pila({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("pila-botones", className)}>{children}</div>;
}

/** La línea de contexto centrada debajo de la pila de botones. */
export function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="pie centro">{children}</p>;
}

/** La cabecera del detalle de un partido: el rival grande y el contexto. */
export function Heroe({ nombre, titulo, sub }: { nombre: string; titulo: string; sub?: string }) {
  return (
    <div className="heroe">
      <span aria-hidden className="av">
        {iniciales(nombre)}
      </span>
      <h2>{titulo}</h2>
      {sub ? <p>{sub}</p> : null}
    </div>
  );
}

/** Una pantalla o una sección vacía: el dibujo, qué pasa y qué hacer. */
export function Vacio({
  dibujo,
  titulo,
  detalle,
  children,
}: {
  dibujo: React.ReactNode;
  titulo: string;
  detalle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="vacio">
      {dibujo}
      <p className="t">{titulo}</p>
      {detalle ? <p className="d">{detalle}</p> : null}
      {children ? <div className="acciones-vacio">{children}</div> : null}
    </div>
  );
}

/**
 * La cabecera del perfil: el degradé verde, el nombre y el puesto en cifra
 * grande. Sube detrás de la barra de arriba, que empieza transparente.
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
    <div className="perfil-cab">
      <p className="nom">{nombre}</p>
      <p className="car">{bajo}</p>
      {puesto ? (
        <div className="puesto">
          <span className="n">{puesto}</span>
          {detalle ? <span className="de">{detalle}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Las cuatro cifras que flotan sobre el borde de la cabecera del perfil. */
export function Cifras({ datos }: { datos: [string, React.ReactNode][] }) {
  return (
    <div className="cifras">
      {datos.map(([etiqueta, valor]) => (
        <div key={etiqueta}>
          <b>{valor}</b>
          <span>{etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * El torneo en curso, arriba de la tabla: la tarjeta oscura con el punto
 * verde que late.
 *
 * Solo existe mientras hay un torneo. El resto del año no ocupa un pixel: sin
 * torneo no deja hueco ni un mensaje que diga que no hay.
 */
export function Franja({
  nombre,
  sub,
  href,
  etiqueta = "En vivo",
}: {
  nombre: string;
  sub: string;
  href: Route;
  etiqueta?: string;
}) {
  return (
    <Link href={href} className="vivo">
      <span aria-hidden className="punto" />
      <span className="txt">
        <span className="t1">{nombre}</span>
        <span className="t2">{sub}</span>
      </span>
      <span className="etiqueta">{etiqueta}</span>
    </Link>
  );
}

/**
 * Tus partidos, arriba de la tabla y de la franja del torneo.
 *
 * Es lo que la portada le reclama a quien tiene sesión: un resultado por
 * confirmar, un desempate o los partidos que le quedan. La cifra va en un
 * cuadrito rojo si vence sola, verde si no. Sin nada pendiente no se dibuja.
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
  urgente?: boolean;
}) {
  return (
    <div className="grupo franja">
      <Link href={href} className="celda">
        <Contenido
          nombre={titulo}
          sub={sub}
          fuerte
          icono={{ glifo: cifra, color: urgente ? "var(--rojo)" : "var(--uvg)" }}
          derecha={<Flecha />}
        />
      </Link>
    </div>
  );
}

/**
 * El selector de dos opciones de iOS: División Mayor/Menor, Grupos/Cuadro.
 * La opción elegida la marca un pulgar blanco que se desliza de una opción a
 * la otra: la navegación conserva el mismo elemento, así que la transición
 * corre sola.
 */
export function pulgar(i: number, n: number): React.CSSProperties {
  return { width: `calc((100% - 4px) / ${n})`, transform: `translateX(${Math.max(0, i) * 100}%)` };
}

export function Segmentado({
  opciones,
  actual,
  etiqueta,
}: {
  opciones: { href: Route; etiqueta: string; valor: string }[];
  actual: string;
  etiqueta?: string;
}) {
  const i = opciones.findIndex((o) => o.valor === actual);
  return (
    <nav aria-label={etiqueta} className="seg">
      <span aria-hidden className="pulgar" style={pulgar(i, opciones.length)} />
      {opciones.map((o) => (
        <Link key={o.valor} href={o.href} scroll={false} aria-current={o.valor === actual ? "page" : undefined}>
          {o.etiqueta}
        </Link>
      ))}
    </nav>
  );
}

/** Un dato suelto dentro de un bloque: el nombre a la izquierda, la cifra a la derecha. */
export function Dato({ children, valor }: { children: React.ReactNode; valor: React.ReactNode }) {
  return (
    <li className="celda">
      <span className="medio">
        <span className="t-celda">{children}</span>
      </span>
      <span className="derecha">
        <span className="tabular">{valor}</span>
      </span>
    </li>
  );
}

/** Un bloque de texto suelto, del ancho de una lista. */
export function Nota({ children, tono }: { children: React.ReactNode; tono?: "bueno" | "malo" }) {
  return (
    <p role={tono ? "status" : undefined} className={cn("alerta", tono === "bueno" && "buena", !tono && "neutra")}>
      {children}
    </p>
  );
}
