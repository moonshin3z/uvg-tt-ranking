"use client";

import { useEffect, useState } from "react";

/**
 * El aviso de «sin conexión», del estado `sin-red` del prototipo: una
 * tarjeta oscura que flota encima de la barra de pestañas.
 *
 * Aparece cuando el teléfono pierde la señal, que en una cancha de la U pasa
 * seguido. El prototipo lo dibuja como una pantalla entera porque ahí la tabla
 * no cargó; acá la tabla ya está en pantalla y lo que hace falta es avisar
 * antes de que toquen algo que va a fallar.
 *
 * El texto dice la verdad y no lo que uno querría: el marcador sí sigue
 * funcionando sin señal, porque lleva su propio estado y manda una foto
 * completa que se pone al día sola cuando vuelve. Registrar un resultado o
 * confirmar uno, no: eso necesita el servidor en el momento.
 */
export function SinRed() {
  const [sinRed, setSinRed] = useState(false);

  useEffect(() => {
    // `navigator.onLine` solo es de fiar como negativo: en falso seguro que no
    // hay red; en verdadero puede haber wifi sin internet. Por eso se usa para
    // avisar, no para bloquear nada.
    const mirar = () => setSinRed(!navigator.onLine);
    mirar();
    window.addEventListener("online", mirar);
    window.addEventListener("offline", mirar);
    return () => {
      window.removeEventListener("online", mirar);
      window.removeEventListener("offline", mirar);
    };
  }, []);

  if (!sinRed) return null;

  return (
    <div role="status" aria-live="polite" className="sin-red">
      Sin conexión. El marcador sigue funcionando y se pone al día solo; registrar o confirmar un resultado va a tener
      que esperar a que vuelva la señal.
    </div>
  );
}
