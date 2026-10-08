# Despliegue

Lo que hay que hacer para que esto exista en internet. El orden importa: cada
paso necesita algo del anterior.

Los pasos marcados **(vos)** necesitan una cuenta o una credencial y no los
puede hacer nadie más. Los marcados **(código)** ya están hechos.

## 0. Antes de empezar

- **(código)** Ningún `.env` está rastreado por git, y `.gitignore` tiene
  `.env*`. La llave de servicio nunca sale de tu máquina ni del panel de Vercel.
- **(código)** El registro abierto está cerrado en `supabase/config.toml`, en
  los dos interruptores. Y aunque se abriera, el trigger crea todo perfil como
  jugador: el rol solo lo da `asignar_rol`, que exige coordinador.
- **(vos)** Confirmá con el club **cuántos sets se juegan**. Resuelto el 27 de
  septiembre: al mejor de 3 a 11 puntos, que es lo que viene elegido. Se fija al
  crear el ranking y no se cambia después, porque el sistema rechazaría un 3-1
  en un ranking configurado a 2.

## 1. El repositorio (vos)

```
git add -A
git commit -m "Primer despliegue"
```

Después, crear el repositorio en GitHub **privado** y:

```
git remote add origin https://github.com/<tu-usuario>/uvg-tt.git
git push -u origin main
```

Privado porque el reglamento, los nombres y los carnets del club no tienen por
qué ser públicos, aunque el código no tenga secretos. Ojo si alguna vez se
hace público (pasó el 4 de octubre, para trabajar desde la tablet):
`supabase/pruebas/calendario.sql` y
`src/lib/ranking/calendario-del-club.fixture.tsv` tienen los nombres y carnets
reales. La app ya los muestra en las fichas públicas, pero no hace falta
repetirlos en el repositorio.

### Si el push se rechaza por `.github/workflows/ci.yml`

```
! [remote rejected] main -> main (refusing to allow an OAuth App to create or
update workflow .github/workflows/ci.yml without workflow scope)
```

No es un problema del código. GitHub trata los archivos de
`.github/workflows/` como un permiso aparte: subir uno equivale a poder correr
comandos en la infraestructura de GitHub con tu cuenta, así que la credencial
necesita el permiso `workflow`, y el inicio de sesión normal de Git para
Windows no lo pide.

La salida es darle a Git una credencial que sí lo tenga:

1. En GitHub: **Settings → Developer settings → Personal access tokens →
   Tokens (classic) → Generate new token (classic)**.
2. Marcar **`repo`** y **`workflow`**. Vencimiento: 90 días está bien.
3. Copiar el token (se ve una sola vez).
4. Borrar la credencial vieja, si no Windows la sigue usando sin preguntar:
   **Panel de control → Administrador de credenciales → Credenciales de
   Windows**, y quitar `git:https://github.com`.
5. `git push -u origin main`. Cuando pida usuario va tu usuario de GitHub, y
   cuando pida contraseña va el token, no tu contraseña.

El token es una contraseña: no va en ningún archivo del proyecto.

## 2. Supabase en la nube (vos)

En supabase.com, crear un proyecto. Región: la más cercana, `us-east-1`.

Guardá la contraseña de la base donde no se pierda; hace falta para el `db push`
y para conectarse con `psql`.

**Antes del `db push`**, en el panel: **Database > Extensions**, habilitá
`pg_cron`. El orden importa. La migración 19 programa la autoconfirmación sola
si encuentra `pg_cron` habilitado, y si no lo encuentra solo deja un aviso en el
log y sigue. Habilitándolo antes, el paso 4 se vuelve una verificación en lugar
de trabajo.

Después, desde la carpeta del proyecto:

```
npx supabase login
npx supabase link --project-ref <el ref del proyecto>
npx supabase db push
```

`db push` aplica las 31 migraciones en orden. **No corre la semilla**, y así
tiene que ser: la semilla es de desarrollo y crea nueve usuarios de prueba con
el PIN 123456.

Verificá que aplicaron todas:

```
npx supabase migration list
```

Las 31 tienen que aparecer con fecha en las dos columnas, local y remoto.

Después, en el SQL Editor del panel, pegá entero `supabase/verificar-nube.sql`.
Solo lee: no escribe ni borra nada. Devuelve una fila por revisión, y las diez
tienen que decir OK. Comprueba lo que `migration list` no ve: que RLS esté
encendida en todas las tablas, que `debe_cambiar_pin` no se pueda leer desde el
navegador, que no haya usuarios de prueba, y que estén las 12 funciones del
sistema y la vista de posiciones.

Al final del archivo hay una consulta aparte para el cron, que va después de
habilitar `pg_cron`.

## 3. El primer coordinador (vos)

Este paso no se puede automatizar y es fácil olvidarlo. `asignar_rol` exige que
quien la llame ya sea coordinador, así que el primero se crea a mano.

En el panel de Supabase, en Authentication, creá un usuario con:

- Email: `<tu-carnet>@uvgtt.local`
- Contraseña: un PIN de 6 dígitos que no sea obvio
- Confirmar el email: sí

El trigger le crea el perfil solo, como jugador. Después, en el SQL Editor:

```sql
update public.usuario
   set rol = 'coordinador', debe_cambiar_pin = false
 where carnet = '<tu-carnet>';
```

`debe_cambiar_pin = false` porque el PIN lo elegiste vos, no te lo dieron.

## 4. Autoconfirmación (vos)

Los resultados se confirman solos al cumplirse el plazo, y eso lo dispara
`pg_cron`. Si lo habilitaste antes del `db push`, ya quedó programado. Comprobalo
en el SQL Editor:

```sql
select jobname, schedule, active from cron.job;
```

Tiene que aparecer `autoconfirmar-partidos` con `15 * * * *` y `active = true`.

Si la consulta no devuelve nada, es que `pg_cron` no estaba habilitado cuando
corrieron las migraciones. Habilitalo en **Database > Extensions** y programalo
a mano:

```sql
select cron.schedule(
  'autoconfirmar-partidos', '15 * * * *',
  'select public.autoconfirmar_vencidos()'
);
```

Sin esto, la autoconfirmación solo ocurre cuando alguien abre la aplicación, que
en la práctica funciona pero no es de fiar: si nadie entra en tres días, el
plazo no corre.

## 5. Vercel (vos)

Importar el repositorio de GitHub. Framework: Next.js, detectado solo.

Variables de entorno, las tres, para Production y Preview. Los valores están en
Project Settings > API del proyecto de Supabase:

| Variable                        | De dónde sale                                       |
| ------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project URL                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clave publicable                                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | la clave secreta. **Sin** el prefijo `NEXT_PUBLIC_` |

Si a la tercera le pones `NEXT_PUBLIC_`, queda en el JavaScript que descarga
cualquiera y se salta toda la seguridad de la base. No es una advertencia
genérica: esa llave ignora RLS.

## 6. Cerrar el círculo de auth (vos)

En Supabase, Authentication > URL Configuration:

- Site URL: la URL de Vercel, `https://<algo>.vercel.app`
- Redirect URLs: la misma

Sin esto, los enlaces que manda Supabase apuntan a `localhost` y no funcionan
desde un teléfono.

## 7. Probarlo de verdad (vos)

Desde el teléfono, no desde la laptop:

1. Entrar con el coordinador y crear el semestre y el ranking.
2. Dar de alta a dos jugadores. Anotá los PIN que muestra la pantalla: no se
   vuelven a ver.
3. Armar las divisiones, sortear, generar el calendario.
4. Entrar con uno de los dos jugadores, registrar un resultado.
5. Entrar con el otro y confirmarlo.
6. Ver que la tabla cambió.

Si los seis pasos funcionan desde un teléfono, el club puede usarlo.

## 8. Respaldo (vos)

El plan gratis de Supabase guarda respaldos de los últimos días, pero no los
podés restaurar solo. Antes de cada cierre de ranking, que es el momento donde
un error duele de verdad:

```
npx supabase db dump -f respaldo-YYYY-MM-DD.sql
```

Guardalo fuera de la máquina. Son unos kilobytes.

## 9. Publicar desde un Codespace (vos)

Sirve cuando no tenés la computadora: un Codespace del repositorio en el
navegador, con la terminal de abajo.

- **Los comandos, de a uno.** `supabase login` se queda esperando Enter y un
  código de 8 caracteres; si pegás el bloque entero, se come las líneas que
  siguen como si fueran tu respuesta.
- **`npm ci` no hace falta para publicar.** Si falla con `EUSAGE` (el lockfile
  "no sincronizado"), es que en el Codespace se tocó `package.json` o
  `package-lock.json`: `git status` lo muestra y `git checkout --` lo arregla.
  Pero el CLI se puede bajar solo, con la misma versión del proyecto:

  ```
  npx -y supabase@2.117.0 login
  npx -y supabase@2.117.0 link --project-ref <el ref del proyecto>
  npx -y supabase@2.117.0 migration list
  npx -y supabase@2.117.0 db push
  git push origin main
  ```

- **IPv6 no molesta.** El Codespace no tiene IPv6 y la conexión directa a la
  base sí lo usa, pero `link` y `db push` van por el pooler por defecto.
- **Si no te acordás de la contraseña de la base**, se cambia en Project
  Settings > Database. La app no la usa: usa las llaves de la API.

## Lo que NO hay que hacer

**No corras la semilla en producción.** `supabase/seed.sql` crea nueve usuarios
con PIN 123456 y les apaga `debe_cambiar_pin`. Solo corre con
`supabase db reset`, que es local; `db push` no la toca. Pero si algún día
copias y pegas ese archivo en el SQL Editor de producción, quedan nueve cuentas
abiertas con el mismo PIN.

**No corras `supabase db reset` contra la nube.** Borra todo.

**No cambies `sets_para_ganar` de un ranking con partidos ya registrados.** Los
resultados viejos quedan contradiciendo la configuración nueva.
