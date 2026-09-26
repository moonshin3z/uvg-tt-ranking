import { cn } from "@/lib/utils";

/** Bloque gris con el brillo que corre, para los estados de carga. */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn("brillo rounded-md", className)} />;
}

/**
 * Filas que cargan dentro de un bloque blanco, como en el prototipo: un
 * círculo y una raya por fila, cada una con el brillo un poco corrido.
 */
export function EsqueletoTarjeta({ filas = 3 }: { filas?: number }) {
  const anchos = [62, 78, 54, 70, 58, 74, 50, 66];
  return (
    <div className="grupo">
      <div className="esq" aria-hidden>
        {Array.from({ length: filas }, (_, i) => (
          <div key={i}>
            <b style={{ animationDelay: `${i * 90}ms` }} />
            <i style={{ width: `${anchos[i % anchos.length]}%`, animationDelay: `${i * 90}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Envoltorio común: anuncia la carga a lectores de pantalla una sola vez. */
export function PantallaCargando({ children }: { children: React.ReactNode }) {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-label="Cargando"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 pt-[54px] pb-8"
    >
      {children}
    </main>
  );
}

/** El título grande mientras carga. */
export function EsqueletoTitulo() {
  return (
    <div className="grande flex flex-col gap-2.5 pt-1">
      <Esqueleto className="h-8 w-52 rounded-lg" />
      <Esqueleto className="h-4 w-40" />
    </div>
  );
}
