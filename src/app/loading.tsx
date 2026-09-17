import { Esqueleto, PantallaCargando } from "@/components/esqueleto";

export default function Cargando() {
  return (
    <PantallaCargando>
      <div className="flex flex-col gap-2">
        <Esqueleto className="h-8 w-64" />
        <Esqueleto className="h-4 w-48" />
      </div>
      <Esqueleto className="h-12 w-full rounded-lg" />
      <div className="flex flex-col gap-px rounded-xl border p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Esqueleto key={i} className="my-1.5 h-6 w-full" />
        ))}
      </div>
    </PantallaCargando>
  );
}
