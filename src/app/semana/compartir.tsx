"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Comparte la imagen de la semana para mandarla al grupo.
 *
 * La imagen se pide apenas aparece el botón y no al tocarlo: Safari en iPhone
 * solo deja abrir el menú de compartir si `navigator.share` se llama enseguida
 * del toque, y una descarga en el medio le hace perder ese permiso. Donde no se
 * puede compartir un archivo (una computadora), la imagen se descarga.
 */
export function CompartirSemana({ src, archivo, texto }: { src: string; archivo: string; texto: string }) {
  const [listo, setListo] = useState<File | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const pidiendo = useRef<Promise<File> | null>(null);

  function pedir(): Promise<File> {
    pidiendo.current ??= fetch(src, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        const f = new File([blob], archivo, { type: "image/png" });
        setListo(f);
        return f;
      })
      .catch((e) => {
        pidiendo.current = null;
        throw e;
      });
    return pidiendo.current;
  }

  useEffect(() => {
    pedir().catch(() => {});
    // `pedir` cambia en cada render pero lo que pide depende solo de `src`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function descargar(f: File) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function compartir() {
    setAviso(null);
    let f = listo;
    if (!f) {
      try {
        f = await pedir();
      } catch {
        setAviso("No se pudo armar la imagen. Probá de nuevo.");
        return;
      }
    }
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [f] })) {
      try {
        await navigator.share({ files: [f], text: texto });
      } catch (e) {
        // Cerrar el menú sin elegir nada no es un error.
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Safari pierde el permiso si la imagen todavía se estaba armando: ya
        // quedó lista, el segundo toque funciona.
        if (e instanceof DOMException && e.name === "NotAllowedError") {
          setAviso("Listo, tocá de nuevo para compartir.");
          return;
        }
        descargar(f);
      }
      return;
    }
    descargar(f);
  }

  return (
    <div className="pila-botones mt-2 mb-1">
      <button type="button" className="btn bloque" onClick={compartir}>
        Compartir imagen
      </button>
      {aviso ? (
        <p role="status" className="text-center text-[15px] text-muted-foreground">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
