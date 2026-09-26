"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Shuffle } from "lucide-react";
import { elegirSaque, eliminarMarcador, sincronizarMarcador } from "@/app/partidos/acciones";
import { turnoDeSaque, type LadoSaque } from "@/lib/marcador/saque";

/**
 * El marcador en vivo, copiado de `.marcador` del prototipo.
 *
 * La mitad de arriba está girada 180° para que se lea desde el otro lado de
 * la mesa: el teléfono queda entre los dos jugadores y cada uno ve su número
 * derecho. Se puede desactivar con el botón del centro, porque si el teléfono
 * lo sostiene una sola persona, girado estorba.
 *
 * Cada mitad entera es el botón de sumar un punto. Tocar un número de 96px
 * mientras se juega tiene que funcionar sin mirar.
 *
 * El estado vive acá y se manda al servidor como una foto completa con número
 * de versión. Si una foto llega tarde, el servidor la descarta y no retrocede
 * el marcador; la siguiente lo pone al día. Por eso no se espera la respuesta
 * para pintar: el punto se ve al instante y la red va detrás.
 */
export function Marcador({
  id,
  partidoId,
  nombreA,
  nombreB,
  setsParaGanar,
  puntosPorSet,
  inicial,
}: {
  id: string;
  partidoId: string | null;
  nombreA: string;
  nombreB: string;
  setsParaGanar: number;
  puntosPorSet: number;
  inicial: {
    puntosA: number;
    puntosB: number;
    setsA: number;
    setsB: number;
    historial: [number, number][];
    version: number;
    estado: string;
    primerSaque: LadoSaque | null;
  };
}) {
  const router = useRouter();
  const [a, setA] = useState(inicial.puntosA);
  const [b, setB] = useState(inicial.puntosB);
  const [sa, setSa] = useState(inicial.setsA);
  const [sb, setSb] = useState(inicial.setsB);
  const [historial, setHistorial] = useState<[number, number][]>(inicial.historial);
  const [girado, setGirado] = useState(true);
  const [pasos, setPasos] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const version = useRef(inicial.version);
  // Los marcadores de la versión anterior ya empezaban con A. Se retoman
  // así incluso si una pestaña antigua anotó después de aplicar la migración.
  const [primerSaque, setPrimerSaque] = useState<LadoSaque | null>(
    inicial.primerSaque ??
      (inicial.version > 0 || inicial.puntosA + inicial.puntosB + inicial.setsA + inicial.setsB > 0 ? "a" : null),
  );
  const [eligiendo, setEligiendo] = useState(false);
  const solicitudSaque = useRef(false);

  // Tres cosas distintas que conviene no mezclar:
  //   · `terminado`: alguien llegó a los sets. La base no deja guardar un
  //     marcador como terminado antes de eso.
  //   · `abandonado`: el partido no se jugó hasta el final y se cerró así.
  //     Guarda el tanteo pero no registra ningún resultado.
  //   · salir de la pantalla no es ninguna de las dos: el marcador queda
  //     abierto y se puede retomar.
  const abandonado = inicial.estado === "abandonado";
  const terminado = sa >= setsParaGanar || sb >= setsParaGanar;
  const faltaSaque = primerSaque === null && !terminado && !abandonado;
  const sacaA = turnoDeSaque(primerSaque ?? "a", a, b, sa + sb, puntosPorSet) === "a";

  async function empezar(lado?: LadoSaque) {
    if (solicitudSaque.current || guardando) return;
    solicitudSaque.current = true;
    setEligiendo(true);
    setAviso(null);
    try {
      const r = await elegirSaque(id, lado);
      if (r.error || !r.marcador) return setAviso(r.error ?? "No se pudo guardar el saque.");
      const m = r.marcador;
      if (m.primer_saque !== "a" && m.primer_saque !== "b") return setAviso("No se pudo guardar el saque.");
      version.current = Number(m.version);
      setA(m.puntos_a);
      setB(m.puntos_b);
      setSa(m.sets_a);
      setSb(m.sets_b);
      setHistorial(m.historial as [number, number][]);
      setPrimerSaque(m.primer_saque);
    } catch {
      setAviso("No se pudo guardar el saque. Revisá la conexión y probá de nuevo.");
    } finally {
      solicitudSaque.current = false;
      setEligiendo(false);
    }
  }

  const mandar = useCallback(
    (estado: { a: number; b: number; sa: number; sb: number; hist: [number, number][] }, fin: boolean) => {
      version.current += 1;
      void sincronizarMarcador({
        marcadorId: id,
        version: version.current,
        puntosA: estado.a,
        puntosB: estado.b,
        setsA: estado.sa,
        setsB: estado.sb,
        historial: estado.hist,
        saca: turnoDeSaque(primerSaque ?? "a", estado.a, estado.b, estado.sa + estado.sb, puntosPorSet),
        estado: fin ? "terminado" : "en_juego",
      }).then((r) => {
        if (r.error) setAviso(r.error);
        else if (r.aviso) setAviso(r.aviso);
      });
    },
    [id, primerSaque, puntosPorSet],
  );

  function sumar(lado: "a" | "b") {
    if (terminado || faltaSaque || abandonado || guardando) return;
    setPasos((p) => [...p, JSON.stringify({ a, b, sa, sb, historial })]);

    let na = lado === "a" ? a + 1 : a;
    let nb = lado === "b" ? b + 1 : b;
    let nsa = sa;
    let nsb = sb;
    let nhist = historial;

    // Un set se cierra al llegar al tope con dos de ventaja. Es la misma regla
    // que valida la base, así que el marcador nunca manda algo que rebote.
    if (Math.max(na, nb) >= puntosPorSet && Math.abs(na - nb) >= 2) {
      nhist = [...historial, [na, nb]];
      if (na > nb) nsa += 1;
      else nsb += 1;
      na = 0;
      nb = 0;
    }

    setA(na);
    setB(nb);
    setSa(nsa);
    setSb(nsb);
    setHistorial(nhist);
    mandar({ a: na, b: nb, sa: nsa, sb: nsb, hist: nhist }, nsa >= setsParaGanar || nsb >= setsParaGanar);
  }

  function deshacer() {
    const ultimo = pasos[pasos.length - 1];
    if (!ultimo) return;
    const v = JSON.parse(ultimo) as { a: number; b: number; sa: number; sb: number; historial: [number, number][] };
    setA(v.a);
    setB(v.b);
    setSa(v.sa);
    setSb(v.sb);
    setHistorial(v.historial);
    setPasos((p) => p.slice(0, -1));
    mandar({ a: v.a, b: v.b, sa: v.sa, sb: v.sb, hist: v.historial }, false);
  }

  async function terminar() {
    setGuardando(true);
    version.current += 1;
    const r = await sincronizarMarcador({
      marcadorId: id,
      version: version.current,
      puntosA: a,
      puntosB: b,
      setsA: sa,
      setsB: sb,
      historial,
      saca: sacaA ? "a" : "b",
      estado: terminado ? "terminado" : "en_juego",
    });
    setGuardando(false);
    if (r.error) return setAviso(r.error);
    if (r.aviso) return setAviso(r.aviso);
    router.push(partidoId ? `/partidos/${partidoId}` : "/partidos");
  }

  async function eliminar() {
    if (!window.confirm("¿Eliminar este partido sin terminar?")) return;
    setGuardando(true);
    setAviso(null);
    const r = await eliminarMarcador(id);
    setGuardando(false);
    if (r.error) return setAviso(r.error);
    router.replace("/partidos");
    router.refresh();
  }

  const pips = (n: number) => (
    <span className="pips" aria-hidden>
      {Array.from({ length: setsParaGanar }, (_, i) => (
        <i key={i} className={i < n ? "on" : undefined} />
      ))}
    </span>
  );

  // El destello verde sale de donde tocó el dedo.
  function destello(e: React.PointerEvent<HTMLButtonElement>, girada: boolean) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    let x = e.clientX - r.left;
    let y = e.clientY - r.top;
    if (girada) {
      x = r.width - x;
      y = r.height - y;
    }
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
    el.classList.add("toque");
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("toque")));
  }

  const mitad = (lado: "a" | "b", nombre: string, puntos: number, sets: number, girar: boolean) => (
    <button
      type="button"
      onPointerDown={(e) => destello(e, girar)}
      onClick={() => sumar(lado)}
      disabled={terminado || faltaSaque || abandonado || guardando}
      aria-label={`Sumar un punto a ${nombre}`}
      className={cn("mitad", girar && "girada")}
    >
      <span className="quien">{nombre}</span>
      <span key={puntos} className={cn("pts tabular", puntos > 0 && "pop")}>
        {puntos}
      </span>
      {pips(sets)}
    </button>
  );

  return (
    <div className="marcador">
      <div className="mtop">
        <button
          type="button"
          className="cristal-osc"
          onClick={() => router.push(partidoId ? `/partidos/${partidoId}` : "/partidos")}
        >
          Salir
        </button>
        <span>{`Al mejor de ${setsParaGanar * 2 - 1} · a ${puntosPorSet} puntos`}</span>
        <span className="w-[74px] shrink-0" aria-hidden />
      </div>

      {aviso ? (
        <p role="alert" className="px-4 py-2 text-center text-[15px] text-[#ffd60a]">
          {aviso}
        </p>
      ) : null}

      {faltaSaque ? (
        <section aria-labelledby="elegir-saque" aria-busy={eligiendo} className="saque">
          <div className="mx-auto w-full max-w-xs">
            <h1 id="elegir-saque">¿Quién saca primero?</h1>
            {(
              [
                ["a", nombreA],
                ["b", nombreB],
              ] as const
            ).map(([lado, nombre]) => (
              <button
                key={lado}
                type="button"
                aria-label={`Saca primero ${nombre}`}
                onClick={() => void empezar(lado)}
                disabled={eligiendo || guardando}
                className="opcion cristal-osc"
              >
                {nombre}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void empezar()}
              disabled={eligiendo || guardando}
              className="sortear"
            >
              <Shuffle aria-hidden className="size-5" />
              {eligiendo ? "Preparando…" : "Sortear"}
            </button>
          </div>
        </section>
      ) : (
        <>
          {mitad("b", nombreB, b, sb, girado)}

          <div className="mcentro cristal-osc">
            <button type="button" onClick={deshacer} disabled={pasos.length === 0 || guardando || abandonado}>
              Deshacer
            </button>
            <span className="marca">
              {sa}-{sb}
              <small aria-live="polite">
                {terminado ? "partido terminado" : `saca ${(sacaA ? nombreA : nombreB).split(" ")[0]}`}
              </small>
            </span>
            <button
              type="button"
              onClick={() => setGirado((g) => !g)}
              title="Girar la mitad de arriba"
              aria-label="Girar la mitad de arriba"
              aria-pressed={girado}
            >
              ⇅
            </button>
          </div>

          {mitad("a", nombreA, a, sa, false)}
        </>
      )}

      <div className="mbot">
        {abandonado ? (
          <p className="mb-2 text-center text-[15px] text-white/[0.62]">Este partido quedó sin terminar.</p>
        ) : null}
        {abandonado || faltaSaque ? null : (
          <button type="button" onClick={terminar} disabled={guardando} className="terminar">
            {guardando ? "Guardando…" : terminado ? "Registrar el resultado" : "Terminar"}
          </button>
        )}
        {terminado ? null : (
          <button type="button" onClick={eliminar} disabled={guardando || eligiendo} className="eliminar">
            {guardando ? "Eliminando…" : "Eliminar partido"}
          </button>
        )}
      </div>
    </div>
  );
}
