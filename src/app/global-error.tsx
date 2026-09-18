"use client";

/**
 * Último recurso: si falla el layout raíz, este componente reemplaza el
 * documento entero, así que lleva su propio <html> y estilos en línea.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    // `data-app` también acá: si una ruta revienta durante la auditoría, el
    // guardia de identidad tiene que reconocer que sigue siendo esta app y
    // reportar el error real, no "esta URL no sirve esta aplicación".
    <html lang="es-GT" data-app="uvgtt">
      <body
        data-uvgtt-error="1"
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f1f4f0",
          color: "#131714",
        }}
      >
        <span aria-hidden style={{ fontSize: "2.5rem" }}>
          🏓
        </span>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Algo se rompió</h1>
        <p style={{ margin: 0, color: "#5d6a61" }}>Recargá la página. Si sigue pasando, avisale al coordinador.</p>
        <button
          onClick={reset}
          style={{
            minHeight: 44,
            padding: "0 1.25rem",
            borderRadius: 8,
            border: "none",
            background: "#0a7d40",
            color: "white",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
        {error.digest ? <code style={{ fontSize: "0.75rem", color: "#5d6a61" }}>{error.digest}</code> : null}
      </body>
    </html>
  );
}
