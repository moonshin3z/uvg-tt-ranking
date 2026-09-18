import { requerirCoordinador } from "@/lib/auth/coordinador";

/**
 * Solo la puerta: de acá para adentro hay que ser coordinador.
 *
 * El tope y el contenedor los pone cada pantalla, porque el panel va de borde
 * a borde como en el prototipo y las de gestión no.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requerirCoordinador();
  return <>{children}</>;
}
