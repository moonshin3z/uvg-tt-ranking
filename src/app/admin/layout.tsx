import Link from "next/link";
import { requerirCoordinador } from "@/lib/auth/coordinador";
import { createClient } from "@/lib/supabase/server";
import { datos } from "@/lib/supabase/errores";
import { Tope } from "@/components/tope";

/**
 * El coordinador no debería tener que entrar a Partidos para enterarse de que
 * hay algo que atender: las disputas y los resultados sin confirmar se avisan
 * en la pestaña.
 */
async function pendientesDeAtencion(): Promise<{ disputas: number; sinConfirmar: number }> {
  const supabase = await createClient();
  const ranking = datos(
    await supabase
      .from("ranking")
      .select("id")
      .in("estado", ["abierto", "en_desempates", "fase_regular_cerrada"])
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "el ranking en curso",
  );
  if (!ranking) return { disputas: 0, sinConfirmar: 0 };

  const filas = datos(
    await supabase
      .from("partido")
      .select("estado, division!inner(ranking_id)")
      .eq("division.ranking_id", ranking.id)
      .in("estado", ["disputado", "jugado"]),
    "los partidos por atender",
  );

  return {
    disputas: (filas ?? []).filter((f) => f.estado === "disputado").length,
    sinConfirmar: (filas ?? []).filter((f) => f.estado === "jugado").length,
  };
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requerirCoordinador();
  const { disputas, sinConfirmar } = await pendientesDeAtencion();

  return (
    <>
      <Tope titulo="Panel" sub="Coordinación del club" />
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Panel" className="flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1 text-sm font-medium">
        <Link href="/admin/ranking" className="inline-flex min-h-10 items-center rounded-md px-3 py-2 hover:bg-background">
          Ranking
        </Link>
        <Link href="/admin/partidos" className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 py-2 hover:bg-background">
          Partidos
          {disputas > 0 ? (
            <span
              aria-label={`${disputas} en disputa`}
              className="inline-flex size-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground"
            >
              {disputas}
            </span>
          ) : sinConfirmar > 0 ? (
            <span
              aria-label={`${sinConfirmar} sin confirmar`}
              className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
            >
              {sinConfirmar}
            </span>
          ) : null}
        </Link>
        <Link href="/admin/jugadores" className="inline-flex min-h-10 items-center rounded-md px-3 py-2 hover:bg-background">
          Jugadores
        </Link>
      </nav>
      {children}
    </div>
    </>
  );
}
