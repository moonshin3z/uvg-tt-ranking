import Link from "next/link";
import { requerirCoordinador } from "@/lib/auth/coordinador";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requerirCoordinador();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Panel" className="flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1 text-sm font-medium">
        <Link href="/admin/ranking" className="rounded-md px-3 py-2 hover:bg-background">
          Ranking
        </Link>
        <Link href="/admin/partidos" className="rounded-md px-3 py-2 hover:bg-background">
          Partidos
        </Link>
        <Link href="/admin/jugadores" className="rounded-md px-3 py-2 hover:bg-background">
          Jugadores
        </Link>
      </nav>
      {children}
    </div>
  );
}
