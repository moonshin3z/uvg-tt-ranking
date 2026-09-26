import { Esqueleto, EsqueletoTarjeta, EsqueletoTitulo, PantallaCargando } from "@/components/esqueleto";

export default function Cargando() {
  return (
    <PantallaCargando>
      <EsqueletoTitulo />
      <Esqueleto className="mx-4 h-[120px] rounded-[18px]" />
      <EsqueletoTarjeta filas={2} />
      <EsqueletoTarjeta filas={3} />
    </PantallaCargando>
  );
}
