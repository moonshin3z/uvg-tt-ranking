import { Esqueleto, EsqueletoTarjeta, PantallaCargando } from "@/components/esqueleto";

export default function Cargando() {
  return (
    <PantallaCargando>
      <Esqueleto className="h-11 w-full rounded-lg" />
      <Esqueleto className="h-8 w-56" />
      <EsqueletoTarjeta filas={3} />
      <EsqueletoTarjeta filas={2} />
    </PantallaCargando>
  );
}
