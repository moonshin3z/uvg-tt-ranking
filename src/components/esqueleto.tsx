import { cn } from "@/lib/utils";

/** Bloque gris animado para los estados de carga. */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function EsqueletoTarjeta({ filas = 3 }: { filas?: number }) {
  return (
    <div className="rounded-xl border p-4 sm:p-6">
      <Esqueleto className="mb-4 h-5 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: filas }, (_, i) => (
          <Esqueleto key={i} className="h-4 w-full" />
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
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
    >
      {children}
    </main>
  );
}
