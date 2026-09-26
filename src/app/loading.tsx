import { Esqueleto, EsqueletoTarjeta, EsqueletoTitulo, PantallaCargando } from "@/components/esqueleto";

export default function Cargando() {
  return (
    <PantallaCargando>
      <EsqueletoTitulo />
      <Esqueleto className="mx-4 h-11 rounded-[10px]" />
      <EsqueletoTarjeta filas={8} />
    </PantallaCargando>
  );
}
