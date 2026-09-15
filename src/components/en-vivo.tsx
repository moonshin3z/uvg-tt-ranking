"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Refresca la página cuando cambia cualquier partido (Supabase Realtime).
 * Como la tabla se calcula en el servidor, basta con volver a pedirla.
 */
export function EnVivo() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const canal = supabase
      .channel("partidos-en-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "partido" }, () => {
        // Agrupa ráfagas de cambios en un solo refresh
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(canal);
    };
  }, [router]);

  return null;
}
