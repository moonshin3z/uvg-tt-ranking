import { Aviso, BotonInicio } from "@/components/aviso";

export default function NoEncontrado() {
  return (
    <Aviso titulo="Esta página no existe" detalle="Puede que el enlace esté viejo o mal escrito.">
      <BotonInicio />
    </Aviso>
  );
}
