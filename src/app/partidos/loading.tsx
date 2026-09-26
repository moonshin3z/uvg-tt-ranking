import { EsqueletoTarjeta, EsqueletoTitulo, PantallaCargando } from "@/components/esqueleto";

export default function Cargando() {
  return (
    <PantallaCargando>
      <EsqueletoTitulo />
      <EsqueletoTarjeta filas={2} />
      <EsqueletoTarjeta filas={4} />
    </PantallaCargando>
  );
}
