import type { Puesto } from "@/lib/ranking/medallas";

const COLORES: Record<Puesto, { cara: string; borde: string; numero: string }> = {
  1: { cara: "#f6c744", borde: "#d39e0c", numero: "#7a5300" },
  2: { cara: "#e2e6eb", borde: "#a7b0bb", numero: "#4f5864" },
};

/**
 * La medalla de oro o de plata, con la cinta verde de la UVG. Colores planos y
 * sin degradados con id, así puede aparecer varias veces en la misma pantalla
 * sin que los `id` del SVG choquen.
 */
export function Medalla({ puesto, tamano = 24, className }: { puesto: Puesto; tamano?: number; className?: string }) {
  const c = COLORES[puesto];
  return (
    <svg
      width={tamano}
      height={Math.round(tamano * 1.25)}
      viewBox="0 0 32 40"
      aria-hidden
      className={className}
      style={{ flex: "0 0 auto" }}
    >
      <path d="M6.5 0h7.5l5 15h-7.5z" fill="#0b9e51" />
      <path d="M25.5 0H18l-5 15h7.5z" fill="#077a3e" />
      <circle cx="16" cy="26" r="12.5" fill={c.cara} />
      <circle cx="16" cy="26" r="9.6" fill="none" stroke={c.borde} strokeWidth="1.6" />
      <path
        d="M8.8 21.4a9.2 9.2 0 0 1 5.6-4.3"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.6"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <text
        x="16"
        y="30.4"
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="800"
        fill={c.numero}
        style={{ fontFamily: "inherit" }}
      >
        {puesto}
      </text>
    </svg>
  );
}
