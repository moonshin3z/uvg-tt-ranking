"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { sincronizarMarcador } from "@/app/partidos/acciones";

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

  const terminado = sa >= setsParaGanar || sb >= setsParaGanar;
  // El saque cambia cada dos puntos.
  const puntosDelSet = a + b;
  const sacaA = Math.floor(puntosDelSet / 2) % 2 === 0;

  const mandar = useCallback(
    (
      estado: { a: number; b: number; sa: number; sb: number; hist: [number, number][] },
      fin: boolean,
    ) => {
      version.current += 1;
      void sincronizarMarcador({
        marcadorId: id,
        version: version.current,
        puntosA: estado.a,
        puntosB: estado.b,
        setsA: estado.sa,
        setsB: estado.sb,
        historial: estado.hist,
        saca: Math.floor((estado.a + estado.b) / 2) % 2 === 0 ? "a" : "b",
        estado: fin ? "terminado" : "en_juego",
      }).then((r) => {
        if (r.error) setAviso(r.error);
        else if (r.aviso) setAviso(r.aviso);
      });
    },
    [id],
  );

  function sumar(lado: "a" | "b") {
    if (terminado) return;
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

  const pips = (n: number) => (
    <span className="flex gap-[7px]">
      {Array.from({ length: setsParaGanar }, (_, i) => (
        <i
          key={i}
          className={cn("block size-2.5 rounded-full", i < n ? "bg-[#7ad14f]" : "bg-white/[0.22]")}
        />
      ))}
    </span>
  );

  const mitad = (lado: "a" | "b", nombre: string, puntos: number, sets: number, girar: boolean) => (
    <button
      type="button"
      onClick={() => sumar(lado)}
      disabled={terminado}
      aria-label={`Sumar un punto a ${nombre}`}
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden border-0 bg-transparent p-2 text-white active:bg-white/[0.06]",
        girar && "rotate-180",
      )}
    >
      <span className="max-w-[92%] truncate text-[15px] text-white/70">{nombre}</span>
      <span className="text-[96px] leading-[0.84] font-bold tracking-[-0.06em] tabular">{puntos}</span>
      {pips(sets)}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#07200f] text-white">
      <div className="flex shrink-0 items-center justify-between gap-2.5 px-3.5 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-2 text-[13px] text-white/60">
        <button
          type="button"
          onClick={() => router.push(partidoId ? `/partidos/${partidoId}` : "/partidos")}
          className="min-h-10 px-2.5 text-[15px] text-white"
        >
          Cerrar
        </button>
        <span className="truncate">{aviso ?? `Al mejor de ${setsParaGanar * 2 - 1} · a ${puntosPorSet} puntos`}</span>
        <span />
      </div>

      {mitad("b", nombreB, b, sb, girado)}

      <div className="flex shrink-0 items-center justify-between gap-2.5 border-y border-white/[0.12] bg-white/[0.07] px-3.5 py-[9px]">
        <button
          type="button"
          onClick={deshacer}
          disabled={pasos.length === 0}
          className="min-h-10 min-w-10 rounded-lg px-3 text-[14px] font-medium text-white/[0.82] disabled:opacity-35"
        >
          Deshacer
        </button>
        <span className="text-center text-[15px] font-semibold tracking-[0.02em]">
          {sa}-{sb}
          <small className="block text-center text-[12.5px] font-normal text-white/[0.55]">
            {terminado ? "partido terminado" : `saca ${(sacaA ? nombreA : nombreB).split(" ")[0]}`}
          </small>
        </span>
        <button
          type="button"
          onClick={() => setGirado((g) => !g)}
          title="Girar la mitad de arriba"
          aria-pressed={girado}
          className="min-h-10 min-w-10 rounded-lg px-3 text-[14px] text-white/[0.82]"
        >
          ⇅
        </button>
      </div>

      {mitad("a", nombreA, a, sa, false)}

      <div className="shrink-0 px-3.5 pt-2.5 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={terminar}
          disabled={guardando}
          className="min-h-12 w-full rounded-md bg-[#7ad14f] text-[16px] font-semibold text-[#07220a] disabled:opacity-60"
        >
          {guardando ? "Guardando..." : terminado ? "Registrar el resultado" : "Terminar"}
        </button>
      </div>
    </div>
  );
}
