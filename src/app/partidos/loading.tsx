import { Esqueleto, EsqueletoTarjeta, PantallaCargando } from "@/components/esqueleto";

export default function Cargando() {
  return (
    <PantallaCargando>
      <Esqueleto className="h-8 w-48" />
      <EsqueletoTarjeta filas={2} />
      <EsqueletoTarjeta filas={3} />
    </PantallaCargando>
  );
}
