# 04 — Entorno de desarrollo aislado

## Actualización más reciente — entorno BR07 de verificación (2026-11-14)

[br07.compose.yaml](entorno/br07.compose.yaml) añade al proyecto Compose autorizado únicamente `br07-db` y `br07-api`, PostgreSQL 17, tres volúmenes nuevos y red `internal=true` sin puertos publicados. No se combina con la API de recuperación ni comparte montajes con original, DB activa, recovery o scratch. La API usa la imagen de laboratorio ya construida, sin reconstruir contenedores existentes. Las claves aleatorias nuevas se guardan fuera del repo en `%TEMP%\taskview-l01-br07-20261114\br07.env` con ACL exclusiva del usuario.

Procedimiento reproducible y limitado: comprobar que los nombres `_br07_20261114_pgdata`, `_files`, `_logs` y la red BR07 no existan; verificar los hashes del dump/adjunto privados contra [05](05-respaldo-versionamiento.md); cargar solo las tres variables `L01_BR07_*` en el proceso PowerShell; ejecutar `docker compose -p taskview-l01-b5a7e65 -f docs/auditoria-taskview/entorno/br07.compose.yaml --profile br07 config --quiet` y `up -d br07-db`. Verificar con `docker inspect` nombre, imagen, red interna, ausencia de puerto y montajes nuevos; con SQL confirmar base/rol y cero tablas. Copiar el dump validado solo a `br07-db:/tmp/br07-validated.dump`, el adjunto solo a `/br07-files/3/<uuid>`, y ejecutar `docker exec taskview-l01-b5a7e65-br07-db-1 pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U taskview_l01_br07 -d taskview_l01_br07_20261114 /tmp/br07-validated.dump`. Comprobar esquema, conteos y hash; recién entonces iniciar `br07-api` con `up -d --no-deps br07-api`. No usar `--remove-orphans`, `down -v`, backup nuevo ni migraciones.

La API normal inicia PgBoss y workers al escuchar en 1401. Los módulos de notificaciones, recurrencia, tiempo, webhooks e importación registran colas/programaciones que escriben en DB; email omite envío sin `SMTP_HOST`, push se desactiva sin credenciales Firebase. El dump contiene cero integraciones y webhooks, cero jobs pendientes; otras rutas OAuth/SSO solo contactarían proveedores si se configuraran y se invocaran. La red BR07 solo tiene DB/API y no tiene gateway externo; los trabajos operativos quedan en la copia. [br07-probe.mjs](entorno/br07-probe.mjs) se ejecuta dentro de `br07-api`, recibe las credenciales sintéticas por stdin y solo imprime estados/conteos/hashes. El resultado y límites están en [05](05-respaldo-versionamiento.md) y [07](07-informe-pruebas.md).

## Actualización más reciente — PostgreSQL scratch para Lista 01 (2026-11-14)

Se creó `entorno/test-db.compose.yaml` como overlay del proyecto Compose `taskview-l01-b5a7e65`. Sus únicos servicios son `test-db` (PostgreSQL 17.12), `test-migration` (ejecutado una vez) y `test-api` (API exclusiva). `test-db` tiene base `taskview_l01_scratch_20261114`, rol sintético `taskview_l01_scratch`, volumen nuevo `taskview-l01-b5a7e65_test_20261114_pgdata` y red nueva `taskview-l01-b5a7e65_test_20261114_net`. `test-api` solo pertenece a esa red y usa volúmenes nuevos `_test_20261114_files` y `_test_20261114_logs`. La red puente tiene desactivado IP masquerade para impedir salida externa. Ningún servicio scratch comparte red o volumen con DB activa, recovery u original. Los puertos de scratch se vinculan solo a loopback: PG `127.0.0.1:25432` y API `127.0.0.1:21401`.

Se prefirió runner dentro de la red exclusiva, pero la toolchain Node 24 y las dependencias congeladas están instaladas en el host Windows, mientras la imagen API solo contiene el build. Se ejecutó Vitest desde host. Para impedir un destino equivocado, ambos `globalSetup` verifican host/puerto/nombre/rol exactos, versión `1.74.0` y el identificador físico de clúster scratch `7708101047748980774` antes de cualquier fixture o limpieza. SDK exige además `L01_TEST_DB_ONLY=1` y URL API scratch. Las credenciales aleatorias y claves sintéticas solo residen en `%TEMP%\taskview-l01-test-20261114\test-db.env` con ACL del usuario; no se versionan ni se imprimen. Un puerto diferente, otra base o un clúster recreado cancela la ejecución. Riesgo residual: un proceso host ajeno a estos comandos podría acceder a otros puertos; estos tests no lo hicieron.

El scratch estaba vacío antes de `test-migration`. Se revisó el migrador: usa `DB_NAME` para limitar la terminación de sesiones y transacciones por script, aunque atrapa errores individuales de SQL; por ello se verificó el resultado. La migración se dirigió solo a `test-db`, terminó con código 0 y produjo versión `1.74.0`, 81 tablas de usuario y 21 triggers iniciales. La API scratch añadió posteriormente objetos de PgBoss; no se repitió la migración. No se copiaron datos ni credenciales de otros entornos.

Uso reproducible: desde la raíz, cargar las cuatro variables sintéticas del archivo privado temporal solo al proceso actual; ejecutar `docker compose -p taskview-l01-b5a7e65 -f docs/auditoria-taskview/entorno/test-db.compose.yaml --profile test-db up -d test-db test-api` sin `--remove-orphans`; verificar con `docker inspect` que ambos están solo en la red scratch, `docker ps` y consulta de solo lectura a `pg_control_system()`/`app.version`. En `api/`, fijar `L01_TEST_DB_ENV_FILE`, `DB_HOST=127.0.0.1`, `DB_PORT=25432`, `DB_NAME=taskview_l01_scratch_20261114`, `DB_USER=taskview_l01_scratch`, `L01_PG_GROUP` allowlisted y ejecutar `node .\node_modules\vitest\vitest.mjs run --config vitest.lista01.pg.config.ts`. En SDK, fijar también `L01_TEST_DB_ONLY=1`, `L01_TEST_DB_PASSWORD` y `L01_TEST_DB_SYSTEM_ID` desde el archivo privado, `TASKVIEW_TEST_URL=http://127.0.0.1:21401`, `L01_SDK_PG_GROUP` allowlisted y el mismo comando Vitest desde `taskview-packages/taskview-api/`. Cada grupo es un archivo y se ejecuta secuencialmente. No ejecutar el `vitest.config.ts` SDK heredado ni su `.env.for-test`.

Se conserva el scratch para reproducción. No usar `down -v`, prune ni migraciones sobre las bases existentes. Inventario, grupos, resultados y límites: [12 — Inventario PostgreSQL](12-inventario-postgresql.md).

Estado al 2026-11-14: **PF01–PF12 y el ensayo sintético de respaldo/restauración de DB/adjuntos ejecutados**. Builds, tipos y laboratorio aislado verificados; BR01–BR06 y BR08 PASS, BR07 BLOCKED porque no se inició una API de recuperación en modo de solo lectura. PostgreSQL 17.12 mantiene esquema 1.74.0; API/Web/Mailpit del laboratorio están activos y recovery-db está separado en red interna/volúmenes nuevos. Suites unitarias/integración aislables y verificaciones de seguridad restantes continúan pendientes. La instalación original conserva sus IDs, estado y hora de inicio.

El estado de pausa del 2026-11-13 y los procedimientos marcados «no ejecutados» en las secciones siguientes son históricos; esta actualización prevalece donde difieran.

## Requisitos contrastados

| Requisito | Evidencia / situación |
|---|---|
| Windows 11 / Docker Desktop | Cliente y servidor Docker 29.9.3 responden; Compose v5.7.0. No se modificó ni se certificó la configuración interna WSL2. |
| Node | Host conserva 20.19.5. Se descargó y verificó Node 24.22.2 portable en `$env:TEMP/taskview-l01-toolchain/node-v24.22.2-win-x64`; satisface `>=24 <25`. Se comprobó SHA-256 del ZIP contra SHASUMS256.txt oficial antes de extraerlo. |
| pnpm | Instalado y verificado 10.28.1 en `$env:TEMP/taskview-l01-toolchain/pnpm/node_modules/.bin/pnpm.cmd`. No está añadido al PATH global. Lockfile 9.0 conservado; no se instaló nada en la raíz del monorepositorio. |
| Bun | Ausente; requerido por `api/package.json` para `dev`, no para el bundle Node. |
| PostgreSQL | Imagen 17 ya disponible; digest fijado en Compose aislado. PostgreSQL activo reporta 17.12. No se publica su puerto actual. |
| Dependencias locales | `pnpm install --frozen-lockfile` completado en la continuación anterior; lockfile intacto. |
| Compilación/tipos | TypeScript API/web y build completo web PASS; `build:docker` y `build:migration` API reconstruidos en esta actividad. |
| Lint | API FAIL, 18 errores/10 warnings/9 infos; web FAIL, 48 errores de estilo. No se aplicó autofix. |
| Pruebas funcionales | Aún pendientes: Vitest/E2E y PF01–PF12 no se ejecutaron. El laboratorio runtime ya está disponible para esa fase. |

Nota histórica previa al 2026-11-14: no había builds ni servicios Docker. En esta continuación los bundles e imágenes de laboratorio se construyeron; esos builds no sustituyen las pruebas funcionales que siguen pendientes.

## Herramientas preparadas antes de la pausa

La descarga utilizó `https://nodejs.org/dist/v24.22.2/SHASUMS256.txt` y `https://nodejs.org/dist/v24.22.2/node-v24.22.2-win-x64.zip`. El archivo ZIP, el manifiesto y la distribución extraída permanecen en la carpeta temporal de herramientas. La extracción y `node.exe --version` terminaron con código 0 y salida `v24.22.2`.

Con el directorio de Node portable añadido solo al PATH del proceso ejecutor, se ejecutó:

```powershell
$l01Tools = Join-Path $env:TEMP 'taskview-l01-toolchain'
$env:PATH = (Join-Path $l01Tools 'node-v24.22.2-win-x64') + ';' + $env:PATH
npm.cmd install --prefix (Join-Path $l01Tools 'pnpm') --cache (Join-Path $l01Tools 'npm-cache') --no-audit --no-fund pnpm@10.28.1
& (Join-Path $l01Tools 'pnpm/node_modules/.bin/pnpm.cmd') --version
```

Resultado: un paquete instalado; pnpm 10.28.1; código 0. Se ignoró el aviso de actualización de npm. No se cambió el PATH de Windows ni Node global. No se instaló Bun. El uso de npm fue exclusivamente para pnpm en el prefijo temporal, no para dependencias del proyecto.

Para una **futura reanudación**, activar ambas herramientas únicamente en la nueva sesión PowerShell:

```powershell
$l01Tools = Join-Path $env:TEMP 'taskview-l01-toolchain'
$l01NodeDir = Join-Path $l01Tools 'node-v24.22.2-win-x64'
$l01PnpmDir = Join-Path $l01Tools 'pnpm/node_modules/.bin'
if (-not (Test-Path (Join-Path $l01NodeDir 'node.exe'))) { throw 'Falta Node portable; revisar punto de continuación' }
if (-not (Test-Path (Join-Path $l01PnpmDir 'pnpm.cmd'))) { throw 'Falta pnpm local; revisar punto de continuación' }
$env:PATH = $l01NodeDir + ';' + $l01PnpmDir + ';' + $env:PATH
node --version
pnpm.cmd --version
```

Las carpetas temporales pueden ser eliminadas por Windows; comprobar su existencia al reanudar. Ningún paso posterior de instalación/build se ejecutó antes de la pausa.

## Configuración entregada

Archivo: [entorno/compose.yaml](entorno/compose.yaml). Proyecto fijo `taskview-l01-b5a7e65`; usar siempre `-p` explícito, no `taskview`.

| Recurso | Actual observado | Laboratorio propuesto |
|---|---|---|
| API | Host 1725 → 1401 | 127.0.0.1:11725 → 1401 |
| Web | Host 8888 → 80 | 127.0.0.1:18888 → 80 |
| PostgreSQL | Sin publicación host | 127.0.0.1:15432 → 5432 |
| Datos | `taskview_pgdata` | `taskview-l01-b5a7e65_pgdata` |
| Archivos/logs | Bind mounts existentes | Volúmenes `taskview-l01-b5a7e65_files` y `_logs` |
| Red | `taskview_default` | `taskview-l01-b5a7e65_default`, bridge propia con `enable_ip_masquerade=false` |
| Imágenes API/web | Etiquetas `gimanhead/...:latest` | `taskview-l01-api:b5a7e65`, `taskview-l01-web:b5a7e65` |

Los tres puertos nuevos no aparecieron en listeners durante la inspección; comprobar nuevamente antes de arrancar. No hay volúmenes/redes externos ni `container_name`, ni acceso a socket Docker desde los servicios. Compartir capas de imagen PostgreSQL es seguro; compartir su volumen no lo sería. `pull_policy: never` impide reemplazar imágenes por descargas al arrancar; el build puede descargar sus bases originales.

Perfil normal sin opciones: solo DB. `app`: API/web. `maintenance`: migrador explícito; no arranca con `app`. La API espera DB saludable, **no ejecuta ni valida automáticamente las migraciones**. La configuración inicial `internal: true` impidió publicar puertos en el Docker Desktop observado (los bindings declarados no aparecieron en `NetworkSettings.Ports`). Se cambió la red del laboratorio a bridge dedicada sin masquerading IP para permitir bindings en 127.0.0.1 y limitar el egreso normal; Compose no configura correo, GitLab, webhooks, S3 ni otros servicios externos. El aislamiento probado es por proyecto/red/volúmenes y sin SNAT; no se intentó conexión hacia servicios reales ni se certificó una regla de firewall del host.

## Variables

`api/src/types/app.types.ts` exige DB_HOST/USER/PASSWORD/NAME/PORT, APP_PORT, JWT_ALG/SIGN, ACCESS_LIFE_TIME, REFRESH_LIFE_TIME y APP_URL. El Compose fija DB_HOST=`db`, base/usuario=`taskview_l01`; no permite parametrizar el destino hacia producción.

También fija `API_PUBLIC_URL`, `TASKVIEW_API_URL`, CORS exclusivo, UTC, autenticación por contraseña, correo de invitaciones desactivado y almacenamiento local persistente. `ENCRYPTION_KEY` exige 64 caracteres hex (`api/src/utils/crypto.ts`). OAuth/SSO, SMTP, S3, Centrifugo y Firebase quedan sin configurar; sus nombres completos están en el código y documentación original. No copiar `.env` de uso cotidiano.

En la ejecución del 2026-11-14 se generaron secretos sintéticos nuevos para los tres nombres de [.env.example](entorno/.env.example) y se guardaron en `entorno/.env`, excluido por [.gitignore](entorno/.gitignore). No imprimirlo ni ejecutar `compose config` sin `--quiet` cuando contenga secretos. No copiar valores a Git ni reutilizarlos fuera del laboratorio.

## Secuencia original desde PowerShell (histórica)

Esta secuencia fue escrita antes de instalar dependencias y está conservada como referencia histórica; sus builds/typecheck se ejecutaron posteriormente y el laboratorio ya está activo. Para el procedimiento reproducible actualizado, seguir la sección «Ejecución del laboratorio» al final de este documento y el informe 07.

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm run build:packages
pnpm --filter taskview-ce-api-server type-check
pnpm --filter taskview-ce-api-server lint
pnpm --filter web-nuxt-ui lint
pnpm --dir api run build:docker
pnpm --dir api run build:migration
pnpm run build:webapp
```

`build:webapp` incluye puente Capacitor y chequeo de tipos. Para los Dockerfiles originales se necesita copiar recursos como lo hace `api/build-docker-api.sh`, evitando sus comandos que etiquetan `latest`:

```powershell
Copy-Item -LiteralPath api/production.package.json -Destination api/dist/package.json
Copy-Item -LiteralPath api/production.ecosystem.config.js -Destination api/dist/ecosystem.config.js
New-Item -ItemType Directory -Force -Path api/dist-migration/taskview
Copy-Item -Path api/src/migrations/taskview/* -Destination api/dist-migration/taskview -Recurse
node api/commands/copy-migration-files.js
```

Los directorios de salida deben ser artefactos de esta compilación, no copias antiguas. El script original de copia se inspeccionó; coloca `api/dist-migration` en `api/postgresql/dist-migration`. No ejecutar `build-dockers.sh` ni scripts `build-docker-*.sh` que etiquetan imágenes de la instalación actual.

```powershell
$l01Compose = 'docs/auditoria-taskview/entorno/compose.yaml'
$l01Env = 'docs/auditoria-taskview/entorno/.env'
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env --profile app --profile maintenance config --quiet
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env --profile app --profile maintenance build api web migration
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env up -d db
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env --profile maintenance run --rm migration
```

**Condición antes de migrar:** confirmar proyecto, volumen nuevo, `DB_HOST=db`, base `taskview_l01` y ausencia de conexiones a `taskview_default`. El migrador original termina sesiones de su DB destino. Si el volumen existe con datos, detener esta operación y revisar su origen. Estos comandos no se ejecutaron en Lista 01.

Tras revisar salida sin errores y comprobar `app.version` esperado 1.74.0, iniciar:

```powershell
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env --profile app up -d api web
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env ps
```

Abrir web `http://localhost:18888` y verificar en red del navegador que solo llama a `http://localhost:11725`. Usar perfil de navegador separado y cuentas sintéticas; el puerto separa localStorage, pero no todos los ámbitos de cookies. Revisar cuentas iniciales instaladas por SQL y cambiar cualquier credencial de bootstrap antes de usar la instancia. No documentar valores.

Para desarrollo interactivo, `pnpm run dev:webapp` usa 5174 y `pnpm run dev:api` necesita Bun. No apuntarlos a 1725/8888: una configuración dedicada debe fijar API, CORS, DB 15432 y archivos exclusivos. El flujo Docker anterior es la preparación entregada; no se dejó un `.env` activo en `api/`.

## Validaciones pendientes

Nota histórica, reemplazada por las verificaciones de PF01–PF12 y BR01–BR08 agregadas posteriormente: adaptar/seleccionar suites Vitest sin `conf.private` ni destinos heredados y adaptar Playwright al puerto real, evitando reutilizar servidores cotidianos. Las pruebas funcionales PF01–PF12 ya pasaron; falta evaluar las suites unitarias/integración seguras. No ejecutar `pnpm test` global sin aislamiento: hay suites con DB y servicios externos. La lectura funcional mediante API recovery permanece BLOCKED; no usar `docker compose down -v` ni limpieza global.

## Ejecución del laboratorio — 2026-11-14

Se activó Node 24.22.2/pnpm 10.28.1 desde `%TEMP%\taskview-l01-toolchain`; se verificaron rama `chore/l01-auditoria-taskview`, HEAD `b5a7e6598d927fe2e8a5936150093390c31ed13c` y estado previo. Se reconstruyeron los artefactos API/migrador con `pnpm.cmd --dir api run build:docker` y `pnpm.cmd --dir api run build:migration` (exit 0), y el frontend con `pnpm.cmd run build:webapp` (exit 0). El bundle web y los bundles API/migración son del código actual. Se copiaron los archivos de runtime a `api/dist` y se usó `node api/commands/copy-migration-files.js` para preparar el contexto de migración.

| Recurso | Resultado observado |
|---|---|
| API | `taskview-l01-api:b5a7e65`, ID `sha256:ccb3dac6fbd4cda0aabd41febafbab6d7d5c61ba4d5abd7016c1c92b2361109f` |
| Web | `taskview-l01-web:b5a7e65`, ID `sha256:e1a87d3201b26328d02c47121e59d9fee5c6f8f28f4ab0ba6ddc7e75d8f25752` |
| Migrador | `taskview-l01-migration:b5a7e65`, ID `sha256:b409b86c1b141f4cbc81b081b1fd9948783fb72c7a86703737f3f527daf6d39c` |
| PostgreSQL | Digest local fijado `sha256:846a7ddaa67a4b354ae1d21087b683901aa6113a4ed626d3787cfbf6c85e3e07`; versión runtime 17.12 |

Los IDs personalizados son distintos de las imágenes API/web de la instalación original. No se retaggearon imágenes originales ni se usó `latest` como destino.

El `.env` sintético se generó con RNG criptográfico y contiene únicamente las tres variables de `.env.example` (DB password, JWT signing key y encryption key; 32 bytes aleatorios cada una). `git check-ignore docs/auditoria-taskview/entorno/.env` lo confirma excluido. Los valores no se imprimieron ni se copiaron a los informes.

### Aislamiento y red

El `docker compose ... config --quiet` final pasó y la configuración efectiva se inspeccionó en memoria: DB/usuario `taskview_l01`, host DB `db`, imágenes y volúmenes del proyecto, red bridge propia, API pública en 11725, web en 18888 y DB en 15432, todos enlazados a `127.0.0.1`. No aparecen las redes/volúmenes `taskview_default`/`taskview_pgdata`, puertos originales, nombres de imagen originales ni URL GitLab institucional. El contenedor DB monta solo `taskview-l01-b5a7e65_pgdata`; API usa volúmenes propios `_files` y `_logs`; no hay bind mounts ni socket Docker.

La red final se inspeccionó como `bridge`, proyecto `taskview-l01-b5a7e65`, `internal=false` y `com.docker.network.bridge.enable_ip_masquerade=false`; solo tiene endpoints DB/API/web del laboratorio. Esta configuración fue necesaria porque `internal: true` dejó los host bindings sin publicación efectiva en Docker Desktop (NetworkSettings.Ports vacío; no había listener localhost). Con bridge sin masquerading, los tres puertos aparecen publicados y se acceden desde Windows. Docker documenta que una red interna carece de conexión a interfaces host y que deshabilitar masquerading impide el egreso normal a Internet en una bridge custom ([redes internas](https://docs.docker.com/compose/how-tos/networking/#internal-networks), [bridge y publicación de puertos](https://docs.docker.com/engine/network/port-publishing/)). No se sondeó ningún servicio externo real; la opción de masquerade se verificó en metadatos de red, no mediante una prueba de egreso. No equivale a una política de firewall del host.

### Migración, arranque y comunicación

Antes de migrar se comprobó contenedor `taskview-l01-b5a7e65-db-1`, servicio/proyecto Compose, volumen nuevo, red del laboratorio, DB/usuario sintéticos, PostgreSQL 17.12 y cero tablas de aplicación previas. Se revisó que `disconnectOthers()` filtra `pg_stat_activity.datname = $1` usando `process.env.DB_NAME` y excluye su propio PID. El entrypoint solo pasa `--create` al encontrar cero tablas en `tasks`.

La primera ejecución del migrador terminó con exit 255 antes de ejecutar el script SQL: `exec /entrypoint.sh: no such file or directory`. Se confirmó que el checkout Windows tenía CRLF, incompatible con el shebang Linux. Se añadió una normalización `sed -i 's/\r$//'` en `api/postgresql/dockerfile`, se reconstruyó solo la imagen del laboratorio y se verificó la primera línea dentro de la imagen (`23 21 2f 62 69 6e 2f 73 68 0a`, executable). La segunda migración, bajo el proyecto Compose explícito, terminó con exit 0 y `Migration successful!`.

Inspección PostgreSQL en transacción de solo lectura: DB `taskview_l01`, PostgreSQL 17.12, `app.version=1.74.0`, 70 versiones en `about.versions`, 81 tablas tras migración inicial. Después de iniciar API se observaron 89 tablas, de las cuales 8 están en `pgboss`; el código `api/src/core/JobQueue.ts` arranca PgBoss con esquema `pgboss`, por lo que el incremento corresponde al esquema operativo de la cola. No se volvió a migrar.

La primera imagen web falló con exit 127 porque `web/docker-runtime-config.sh` también tenía CRLF. Se añadió la normalización equivalente en `web/dockerfile`, se reconstruyó solo la imagen web y se confirmó el shebang LF dentro de la imagen. El web inició sin reinicios.

Pruebas HTTP reproducibles: `Invoke-WebRequest` GET `http://localhost:18888/` → 200; GET `/config.js` → 200 y `apiUrl` `http://localhost:11725`; GET `http://localhost:11725/module/auth/login-options` con Origin web → 200 y `Access-Control-Allow-Origin: http://localhost:18888`; OPTIONS preflight para GET y `authorization,content-type` → 204 con el mismo origen. No se realizó login, CRUD, pruebas funcionales ni E2E.

Estado final: API, web y DB `running`, DB `healthy`, cero reinicios. Compose publica `127.0.0.1:11725->1401`, `127.0.0.1:18888->80`, `127.0.0.1:15432->5432`. La red y los tres volúmenes son exclusivos. Los logs saneados no contienen los secretos del `.env` ni referencias institucionales. API emite advertencias preexistentes de `punycode` y de consultas `pg` concurrentes; no impiden el estado healthy/running.

Durante la recreación de red se usó `docker compose ... down` sin `-v` y con perfiles `app` y `maintenance`; se verificó que eliminó solo contenedores/red del proyecto y preservó los tres volúmenes. No se hizo limpieza global.

### Instalación original y siguiente paso

API original ID `aa6cc8...`, web `1c1338...`, DB `b6d4f6...`: los IDs completos, image IDs, estados `running` y StartedAt UTC coinciden con la inspección previa. `taskview_pgdata` y sus bind mounts no se usaron. No se alteraron imágenes ni configuración de la instalación.

El laboratorio está **listo para PF01–PF12 y las pruebas unitarias/integración seguras de Lista 01**. Estas pruebas, la revisión de seguridad funcional, el respaldo/restauración sintéticos y el lint pendiente aún no se ejecutaron. Mantener las credenciales sintéticas privadas y no cargar datos reales.

## Desbloqueo de autenticación sintética — 2026-11-14

Se contrastó el comportamiento con la [documentación oficial de instalación](https://taskview.tech/docs/getting-started/installation#log-in-with-the-default-user), que indica que una instalación inicial instala un usuario predeterminado y permite reclamarlo desde Account settings → Login and email. La [documentación de autenticación](https://taskview.tech/docs/configuration/authentication#the-default-user-self-hosted) confirma que este flujo no necesita SMTP ni acceso a la base. En el checkout, `api/src/migrations/taskview/sql/0.0.0/app/auth/app_permissions.sql` crea ese usuario con `block=0`, y `AuthController.changeDefaultUserCredentials` protege el cambio verificando sesión, correo bootstrap y contraseña actual. La cuenta se comprobó solo en `taskview_l01`: había exactamente una coincidencia habilitada. El login inicial funcionó; inmediatamente se cambió login/email/password mediante `POST /module/auth/credentials/change` (endpoint de `AuthRoutes.ts`), sin SQL de escritura. La sesión bootstrap quedó revocada.

Se habilitó una segunda cuenta mediante `POST /module/auth/registration` con identificadores sintéticos del dominio reservado `.invalid`. El código del checkout bloquea la cuenta hasta la confirmación por email; por ello se añadió Mailpit exclusivamente al Compose del laboratorio:

| Parámetro | Configuración comprobada |
|---|---|
| Imagen | `ghcr.io/axllent/mailpit:v1.33.1@sha256:c95e8356f55b65520e8b7fd4d74d3e2d06e4a83513f639e316b1e592fbd52646` (linux/amd64), fijada por digest. |
| Red | Servicio unido únicamente a `taskview-l01-b5a7e65_default`; sin forwarding/relay configurado. No se probó egreso a servicios externos. |
| SMTP | Escucha interna Mailpit en `mailpit:25`; no se publica el puerto SMTP en el host. |
| UI/API Mailpit | Solo `127.0.0.1:18025` en el host. Sin autenticación; el buzón contiene únicamente mensajes sintéticos. |
| Destinatarios | `MP_SMTP_ALLOWED_RECIPIENTS` limita los mensajes a direcciones `@taskview-l01.invalid`. |
| TaskView | `SMTP_HOST=mailpit`, remitente `.invalid`; no se configuran usuario ni contraseña. `api/src/core/Email.ts` asigna `ssl`/`tls` solo si `SMTP_ENCRYPTION` vale `ssl`/`tls`; ambas opciones quedaron apagadas para SMTP local sin TLS. `emailjs@4.0.3` usa puerto 25 por defecto y TaskView no pasa `SMTP_PORT` al constructor, aunque la variable aparezca en el esquema. |

La compatibilidad se confirmó funcionalmente: TaskView entregó la confirmación a Mailpit por SMTP sin TLS ni autenticación, y la cuenta se activó usando `GET /module/auth/confirm/email/:code/login/:login` contra la API local. El código de confirmación se mantuvo en memoria, se consumió y no se registró. No se configuró ningún SMTP externo.

El API del laboratorio se recreó para aplicar el host SMTP; DB y Web no se recrearon y sus volúmenes quedaron intactos. La API volvió a running, Mailpit está healthy y los puertos actuales son API 11725, Web 18888, PostgreSQL 15432 y Mailpit UI 18025, todos publicados en loopback. El Compose mantiene `taskview-l01-b5a7e65`; la red conserva masquerading deshabilitado y los tres volúmenes del laboratorio. Los contenedores originales conservaron IDs, image IDs, estado y StartedAt. Se ejecutó una consulta de solo lectura que confirmó dos cuentas sintéticas activas.

Las dos contraseñas nuevas se generaron criptográficamente y se conservan cifradas con DPAPI del usuario Windows actual en `%TEMP%\taskview-l01-private\synthetic-accounts.json`, fuera del repositorio. No se muestran ni guardan tokens. El inicio/cierre de sesión y la revocación se probaron directamente contra la API para evitar el riesgo ya anotado de logging de tokens en `web/src/plugins/axios.ts`.

Para reproducir la infraestructura (sin migrar):

```powershell
$compose = 'docs/auditoria-taskview/entorno/compose.yaml'
$envFile = 'docs/auditoria-taskview/entorno/.env'
docker compose -p taskview-l01-b5a7e65 -f $compose --env-file $envFile --profile app config --quiet
docker compose -p taskview-l01-b5a7e65 -f $compose --env-file $envFile --profile app up -d mailpit
docker compose -p taskview-l01-b5a7e65 -f $compose --env-file $envFile --profile app up -d api
```

Los comandos anteriores solo describen lo ejecutado para Mailpit/API; no ejecutar migraciones. Continuar la Lista 01 desde PF02–PF12, usando las dos cuentas guardadas en el archivo DPAPI de TEMP. No copiar sus secretos al repo ni a evidencias.
## Destino de recuperación sintético — 2026-11-14

Se añadió [entorno/recovery.compose.yaml](entorno/recovery.compose.yaml) como overlay del Compose base. Mantiene el proyecto explícito `taskview-l01-b5a7e65`, pero el servicio `recovery-db` usa solo la red nueva `taskview-l01-b5a7e65_recovery_20261114_net` (`internal=true`), sin puertos publicados ni conexión a la red del laboratorio activo. Sus volúmenes son `taskview-l01-b5a7e65_recovery_20261114_pgdata` y `taskview-l01-b5a7e65_recovery_20261114_files`; la imagen PostgreSQL 17 se fija al mismo digest verificado. Sus credenciales sintéticas están en un archivo privado TEMP con ACL limitada al usuario Windows actual, fuera del repositorio. No se configuró API/Web de recuperación ni servicios externos.

Para reproducir en una sesión PowerShell, `recoveryEnv` debe apuntar al archivo privado creado para una ejecución nueva; no recrear nombres de volumen existentes ni sobrescribir este destino:

```powershell
$project = 'taskview-l01-b5a7e65'
$compose = 'docs/auditoria-taskview/entorno/compose.yaml'
$recoveryCompose = 'docs/auditoria-taskview/entorno/recovery.compose.yaml'
$labEnv = 'docs/auditoria-taskview/entorno/.env'
$recoveryEnv = Join-Path (Join-Path $env:TEMP 'taskview-l01-recovery-<run-id>') 'recovery.env'
docker compose -p $project -f $compose -f $recoveryCompose --env-file $labEnv --env-file $recoveryEnv --profile recovery config --quiet
docker compose -p $project -f $compose -f $recoveryCompose --env-file $labEnv --env-file $recoveryEnv --profile recovery up -d recovery-db
```

Antes de `up`, comprobar que la red y los dos volúmenes con sufijo único no existen. Después, verificar etiquetas Compose del servicio/contendor, base/usuario por nombre, único volumen de PG, volumen de archivos, red interna exclusiva, ausencia de bindings de puerto y cero objetos de usuario. El `up` se dirige solo al servicio `recovery-db`; no ejecutar operaciones `down -v` ni de limpieza global.

En el ensayo ejecutado, el API del laboratorio se detuvo con `docker compose -p taskview-l01-b5a7e65 -f $compose --env-file $labEnv --profile app stop api` para evitar escrituras durante la copia de DB/archivos; se volvió a iniciar con `start api`. No se detuvo ningún contenedor original. Dump y adjuntos se guardaron fuera del checkout en `%TEMP%\taskview-l01-recovery-20261114\artifacts`; el manifiesto y archivos tienen ACL privada. `pg_dump -Fc`/`pg_restore --list` y restauración en recuperación pasaron; el detalle está en [05](05-respaldo-versionamiento.md) y los estados BR01–BR08 en [07](07-informe-pruebas.md).

El destino se restauró con `--exit-on-error --single-transaction --no-owner --no-acl`, sin `--clean` ni migraciones. PostgreSQL de recuperación queda ejecutándose sin puertos. La lectura por API de recuperación no se intentó: TaskView inicia PgBoss y no se verificó un modo estrictamente read-only. El ensayo certifica restauración de DB/adjuntos sintéticos y sus relaciones por consultas de solo lectura, no una prueba funcional de la aplicación restaurada. No usar este procedimiento como respaldo autorizado de la instalación institucional.
