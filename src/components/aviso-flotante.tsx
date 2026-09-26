"use client";

import { useEffect, useState } from "react";

/**
 * El aviso que baja desde arriba y se va solo, como el de iOS al guardar
 * algo: «Registrado. Diego lo tiene que confirmar.» Se muestra al montar.
 */
export function AvisoFlotante({ texto }: { texto: string }) {
  const [ver, setVer] = useState(false);

  useEffect(() => {
    const entra = requestAnimationFrame(() => setVer(true));
    const sale = setTimeout(() => setVer(false), 2600);
    return () => {
      cancelAnimationFrame(entra);
      clearTimeout(sale);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className={ver ? "aviso-flotante ver" : "aviso-flotante"}>
      <span className="ok" aria-hidden>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span>{texto}</span>
    </div>
  );
}
