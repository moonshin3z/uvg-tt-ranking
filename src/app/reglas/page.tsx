import type { Metadata } from "next";
import Link from "next/link";
import { rankingVigente } from "@/lib/ranking/consultas";
import { formatearFecha, textoFechaLimite } from "@/lib/fechas";
import { Pie, Rotulo } from "@/components/fila";
import { Tope } from "@/components/tope";

export const metadata: Metadata = {
  title: "Cómo funciona",
  description: "Reglas del ranking del club de tenis de mesa de la UVG.",
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <Rotulo>{titulo}</Rotulo>
      <div className="grupo flex flex-col gap-3 px-4 py-3.5 text-[15px] leading-relaxed text-pretty">{children}</div>
    </section>
  );
}

export default async function PaginaReglas() {
  // Los números salen del ranking en curso: si el coordinador los cambia,
  // esta página cambia con ellos en vez de quedar mintiendo.
  const r = await rankingVigente();
  const victoria = r?.pts_victoria ?? 1;
  const derrota = r?.pts_derrota ?? 0;
  const premiados = r?.n_premiados ?? 3;
  const suben = r?.n_ascienden ?? 3;
  const bajan = r?.n_descienden ?? 3;
  const horas = r?.horas_autoconfirmacion ?? null;
  const sets = r?.sets_para_ganar ?? 2;

  return (
    <>
      <Tope titulo="Cómo funciona" sub="Reglamento del ranking" atras="/" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-8">
        {r ? (
          <Pie>
            Estas son las reglas del <span className="font-semibold">{r.nombre}</span>. La fecha límite es el{" "}
            {formatearFecha(r.fecha_limite)}, o sea que {textoFechaLimite(r.fecha_limite)}.
          </Pie>
        ) : (
          <Pie>
            Todavía no hay un ranking en curso. Cuando el coordinador publique uno, acá vas a ver sus reglas exactas.
          </Pie>
        )}

        <Seccion titulo="Divisiones y calendario">
          <p>
            El club juega en dos divisiones, Mayor y Menor. Cada una es una liga aparte: jugás contra todos los de tu
            división, una sola vez, y nunca contra alguien de la otra.
          </p>
          <p>
            El calendario sale completo desde el primer día, así que podés ver de entrada contra quién te toca. No hay
            fechas asignadas para cada partido: se coordinan entre ustedes y se juegan antes de la fecha límite.
          </p>
          <p>
            Las divisiones se arman antes de empezar y después no entra nadie nuevo. Si te sumás al club con el
            ranking ya en marcha, jugás el siguiente.
          </p>
        </Seccion>

        <Seccion titulo="Puntos y posiciones">
          <p>
            Ganar un partido da {victoria} punto{victoria === 1 ? "" : "s"} y perder da {derrota}. No importa por
            cuánto ganaste: un {sets}-0 y un {sets}-{sets - 1} valen lo mismo. Los sets se registran para tener el
            historial, no para la tabla.
          </p>
          <p>
            La tabla se ordena por puntos. Un resultado suma recién cuando está confirmado, así que si registrás un
            partido y tu rival todavía no lo confirmó, no vas a ver el cambio en la tabla.
          </p>
        </Seccion>

        <Seccion titulo="Registrar un resultado">
          <p>
            Cualquiera de los dos registra el partido desde Mis partidos. Se anota cuántos sets ganó cada uno y el
            sistema deduce quién ganó; los puntos de cada set son opcionales.
          </p>
          <p>
            Después le aparece al otro para confirmar. Si está de acuerdo, toca Confirmar y listo. Si no, toca No es
            así y escribe qué pasó: el partido queda en disputa y lo resuelve el coordinador hablando con los dos.
          </p>
          {horas ? (
            <p>
              Si el rival no responde en {horas} horas, el resultado se confirma solo. Igual se puede disputar
              después, así que una confirmación automática no cierra el tema para siempre.
            </p>
          ) : (
            <p>Un resultado necesita siempre la confirmación del rival o la decisión del coordinador.</p>
          )}
          <p className="text-muted-foreground">
            Nadie puede confirmar su propio registro. Quien registró puede corregirlo mientras el otro no haya
            respondido.
          </p>
        </Seccion>

        <Seccion titulo="Premios, ascensos y descensos">
          <p>
            Al terminar el ranking se premia a los primeros {premiados} de cada división. Los {suben} primeros de
            Menor suben a Mayor y los {bajan} últimos de Mayor bajan a Menor, y así se arman las divisiones del
            ranking siguiente.
          </p>
          <p>
            Si dos o más quedan empatados en puntos en un puesto que define premio, ascenso o descenso, juegan un
            partido de desempate entre ellos. Si son tres o más, juegan todos contra todos entre ellos. Un empate que
            no cambia nada no se desempata.
          </p>
        </Seccion>

        <Seccion titulo="Partidos que no se juegan">
          <p>
            Llegada la fecha límite, el coordinador revisa los partidos que quedaron sin jugar y decide caso por caso:
            puede anularlos, de modo que no cuenten para ninguno, o dárselo por ganado a alguien.
          </p>
          <p>
            Si alguien se retira del club a mitad del ranking, se anulan todos sus partidos, incluso los que ya había
            jugado, y sale de la tabla. Puede sonar drástico, pero es lo más parejo: si no alcanzó a jugar contra
            todos, los que sí le ganaron tendrían puntos que los demás nunca pudieron disputar.
          </p>
        </Seccion>

        <Seccion titulo="Tu cuenta">
          <p>
            Entrás con tu carnet y un PIN de seis dígitos que te da el coordinador. La primera vez que entrás tenés
            que cambiarlo por uno tuyo. Si lo olvidás, el coordinador te genera uno nuevo.
          </p>
          <p>
            La tabla, los perfiles y el calendario se pueden ver sin cuenta. La cuenta sirve para registrar y
            confirmar resultados.
          </p>
        </Seccion>

        <p className="text-center text-sm">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline"
          >
            Volver a la tabla
          </Link>
        </p>
      </main>
    </>
  );
}
