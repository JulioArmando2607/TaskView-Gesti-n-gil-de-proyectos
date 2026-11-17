# 07 — Informe de pruebas y verificaciones

## Validación final de runtime API — 2026-11-14 (estado vigente)

Se activó **solo** la API del laboratorio Compose `taskview-l01-b5a7e65` mediante [overlay de imagen](entorno/api-authlog.compose.yaml), tras validar `docker compose config --quiet` y su destino efectivo: PostgreSQL `db/taskview_l01`, SMTP `mailpit`, almacenamiento local y puerto `127.0.0.1:11725`. La imagen `taskview-l01-api:authlog-20261114` tiene ID `sha256:5e4e6f07e92747b58aae3011dfa7f869c8c4b0e0b116a1965508a0dd7c303f50`; el bundle de la imagen coincide por SHA-256 `74ad848ef1dae1053a60b5bd3d4b1942512ebaec4a673cb00e8f65087a0e2233` con el que pasó build, typecheck y regresiones de la sección siguiente. El contenedor anterior de API del laboratorio era `69b03782b502…`, imagen `sha256:ccb3dac6…`; `up -d --no-deps --no-build api` recreó únicamente esa API. El nuevo contenedor es `a57f53795f8e…`, con imagen corregida, estado `running`, volumen de archivos/logs del laboratorio y puerto loopback. No se ejecutaron migraciones ni se recrearon los demás servicios.

[Probe reproducible](entorno/l01-api-runtime-probe.mjs): credenciales sintéticas desde archivo privado DPAPI por stdin y respuestas/tokens solo en memoria. Resultado: opciones de login **200**, login inválido **400**, login válido **200**, lectura autenticada de proyecto `L01-*` **200**, refresh **200**, logout **204**, sesión revocada **401**. La ejecución se repitió con resultados iguales. El primer intento de análisis de logs marcó la bandera diagnóstica `cookie: yes` como posible valor sensible; se precisó el detector y se repitió, sin modificar API. En la repetición, **6 líneas nuevas de Pino** sin contraseña, login, marcador inválido, tokens exactos, patrón JWT ni campo sensible con valor; se conservó el diagnóstico seguro `Refresh token source: body`. La salida del contenedor desde su recreación tampoco mostró esos marcadores ni patrón JWT; se inspeccionó de forma privada, sin publicar logs completos. La regresión puntual de navegador [l01-auth-regression.mjs](../../web/scripts/l01-auth-regression.mjs) pasó login, refresh tras 401 y logout; **0** patrones sensibles de consola, **0** errores de página. Estas pruebas cubren este flujo sintético, no todos los caminos de autenticación ni logs históricos.

Integridad posterior: activa, recovery y BR07 conservan cada una `2|4|18|1|20` filas de usuarios/proyectos totales/tareas/archivos/historial; los tres adjuntos conservan SHA-256 `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`; scratch conserva ID físico `7708101047748980774` y esquema 1.74.0. Los contenedores originales conservan IDs, imágenes y `StartedAt` registrados. Lockfile SHA-256 `F4226C0B6453291FAC58A089B37288C43DE8D426EB0F1206118623FA150CFE17`, sin cambio nuevo; `git diff --check` PASS. No se ejecutaron migraciones ni se alteraron esquemas, reglas de negocio, servicios originales o bases protegidas fuera de las sesiones sintéticas previstas en la base activa del laboratorio. Los resultados anteriores de 512 unitarios, 1048 PostgreSQL, PF01–PF12 y BR01–BR08 no se duplican. La decisión formal del responsable sigue **PENDIENTE**.

## Corrección de seguridad AuthModel — 2026-11-14 (resultado vigente)

Se revisaron los logs de `AuthModel`, `AuthController`, `Email`, middleware de usuario y Pino. `AuthModel.getUserByLogin` registraba el resultado completo de `SELECT *` (incluido material de autenticación) y el identificador de login; dos rutas de error incluían códigos de confirmación/recuperación. Otras capturas registraban objetos `Error` que podían contener SQL, parámetros o contenido de correo. `AuthController` registraba el parámetro `state` y las excepciones SMTP; `Email.send` registraba mensaje y stack. La configuración Pino anterior no redactaba campos. [Inventario por archivo y línea](12-seguridad-deuda-tecnica.md#corrección-de-seguridad-authmodel--2026-11-14).

Se sustituyeron esos logs por eventos con operación y resultado, sin usuario completo, login, correo, códigos, tokens ni excepción cruda. Pino 9 usa ahora redacción de campos estructurados como defensa adicional; las cadenas creadas antes de llamar al logger se saneaban en el origen. No cambiaron rutas HTTP, respuestas, SQL, sesiones, permisos ni esquema. El nuevo test `AuthLogging.lista01.spec.ts` captura logs en memoria con marcadores sintéticos: **6/6 PASS**, 0 marcadores en los mensajes de éxito, fallo de búsqueda, confirmación, recuperación y excepción de correo; la prueba de Pino observó `[REDACTED]` y conservó el nombre de operación. Los marcadores no se imprimieron.

Comandos de ejecución, con Node 24 portable en `PATH` y sin mostrar el archivo privado de credenciales:

```text
api/: node node_modules/vitest/vitest.mjs run --config vitest.lista01.auth-logging.config.ts
api/: L01_PG_GROUP=auth_model o auth_http; node node_modules/vitest/vitest.mjs run --config vitest.lista01.pg.config.ts
api/: node node_modules/typescript/bin/tsc --noEmit
api/: pnpm run build:docker
raíz/: docker build --network none -f docs/auditoria-taskview/entorno/api-authlog.Dockerfile -t taskview-l01-api:authlog-20261114 api
```

Para las dos corridas PostgreSQL se fijaron `L01_TEST_DB_ENV_FILE` al archivo temporal privado y `DB_HOST/PORT/NAME/USER` exactamente como exige [el guard](../../api/vitest.lista01.pg.guard.ts); el guard confirmó la identidad antes de ejecutar cada suite.

Regresiones puntuales: `AuthModel.spec.ts` **13/13 PASS** y `Auth.spec.ts` **23/23 PASS**, cada una con guardia PostgreSQL scratch confirmando base `taskview_l01_scratch_20261114`, esquema 1.74.0 e ID físico del clúster; `AccountDeletion.test.ts` **5/5 PASS** y `log-level.spec.ts` **3/3 PASS** sin DB. Incluyen login, registro/confirmación, recuperación, refresh y logout; no se suman otra vez a los 512 unitarios ni 1048 PostgreSQL históricos. Typecheck API `tsc --noEmit` **PASS**; `pnpm run build:docker` **PASS** (el primer intento de shell falló solo porque pnpm no estaba en PATH del proceso; se corrigió PATH sin cambiar dependencias). Biome focal: 1 error preexistente de import sin uso en `AuthController`, 1 warning y 1 info; sin autofix.

La imagen nueva y exclusiva `taskview-l01-api:authlog-20261114` se construyó con `docker build --network none` desde el bundle local y la imagen API previa del laboratorio. Imagen ID `sha256:5e4e6f07e92747b58aae3011dfa7f869c8c4b0e0b116a1965508a0dd7c303f50`. Un contenedor efímero `--network none` confirmó mensajes saneados y redacción en el bundle, y ausencia del patrón antiguo de resultado completo de `getUserByLogin`. **No se recreó ni se sustituyó la API activa del laboratorio.** [Dockerfile reproducible](entorno/api-authlog.Dockerfile).

Integridad final de solo lectura: originales conservan IDs/imágenes/`StartedAt`; activa, recovery y BR07 mantienen cada una `2|4|18|1|20` filas de usuarios/proyectos totales/tareas/archivos/historial; los tres adjuntos conservan SHA-256 `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`. Scratch mantiene ID físico `7708101047748980774` y esquema 1.74.0. El lockfile mantiene SHA-256 `F4226C0B6453291FAC58A089B37288C43DE8D426EB0F1206118623FA150CFE17`; `git diff --check` PASS. No se ejecutaron migraciones, GitLab, suites S3/MCP/E2E, commits ni cambios a contenedores originales. **La observación R1 de fuente queda corregida y verificada en el alcance probado; la imagen API activa sigue con el código previo y no debe usarse como evidencia de esta corrección.** La decisión formal de cierre permanece pendiente.

## Correcciones obligatorias previas al cierre — 2026-11-14

**Resultado: APTA CON CORRECCIONES OBLIGATORIAS; Lista 01 continúa abierta.** [Detalle, matriz de permisos y evidencia](12-seguridad-deuda-tecnica.md). Se construyó `taskview-l01-web:security-20261114` (imagen `sha256:6e50d640…`) desde el frontend corregido y se recreó **solo** el contenedor web del proyecto `taskview-l01-b5a7e65` mediante [overlay específico](entorno/web-security.compose.yaml). El contenedor anterior `5dac7637f29f` fue reemplazado por `ff4db60b59a3` en `127.0.0.1:18888`; API, DB, scratch, recovery, BR07 y originales no se recrearon. En la imagen nueva no aparecen las cadenas `We got refresh data tokens` ni `We got new token` (búsqueda en contenedor sin red, ausencia esperada). Typecheck y build web PASS.

Regresión de navegador puntual con cuenta sintética DPAPI y Chrome headless, sin ejecutar la suite E2E: **login PASS, refresh tras 401 PASS (HTTP 200 y access renovado), logout PASS (tokens eliminados)**. Consola: 0 patrones JWT/refresh/Authorization sensible; errores de página: 0. Se adaptó solo el probe a formulario de contraseña directo y redirección de organización observados; el flujo productivo no cambió. Credenciales y tokens no se imprimieron. El probe quedó en [web/scripts/l01-auth-regression.mjs](../../web/scripts/l01-auth-regression.mjs).

Kanban: nueva prueba aislada de seis escenarios con tarjetas sintéticas, sin conexión a DB. Antes de la corrección **5 PASS/1 FAIL**: vecinos invertidos provocaban dos rebalanceos y dos incrementos de versión para una solicitud. Se eliminó un bloque `if` redundante en `KanbanManager.ts`; después **6 PASS/0 FAIL**, con órdenes finales únicos y un solo rebalanceo. API typecheck y build Docker PASS. `require-token-permission.test.ts` 5/5 PASS como regresión puntual de autorización. El contrato Kanban no recibe versión esperada de columna; no se validó concurrencia real entre procesos ni se cambió el contrato.

`@eslint/js` 9.39.3, antes solo transitivo, se añadió como devDependency directa web; el lockfile cambió **solo tres líneas** en el importador `web`, sin paquetes ni versiones nuevas. `pnpm install --offline --frozen-lockfile --filter web-nuxt-ui` PASS. Lint web ahora arranca sin `NODE_PATH` y sigue **FAIL 48 errores de estilo/0 warnings**; Biome API **FAIL 18 errores/11 warnings/9 infos**. No hubo autofix masivo ni cambio de reglas.

Docker original sigue publicado en `0.0.0.0`/`[::]` para 1725 y 8888; Windows escucha en `::`. `Get-NetFirewallProfile` y `netsh` informaron Domain/Private/Public desactivados. La inspección de reglas de puertos fue denegada incluso en reintento escalado. **No se comprobó acceso desde otro equipo** ni se modificó firewall/puertos. Laboratorio y scratch están solo en loopback; recovery/BR07 sin publicación. La evaluación de exposición LAN y mitigación operativa requiere autorización del responsable.

Integridad final: original API/web/DB conserva IDs `aa6cc8…`/`1c1338…`/`b6d4f6…`, image IDs, `StartedAt` y estado `running`. DB activa, recovery y BR07 mantienen `2 usuarios|4 proyectos totales|18 tareas|1 archivo|20 historial`; hash del adjunto en los tres volúmenes `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`. Scratch no se usó para la prueba Kanban. Lockfile SHA-256 nuevo `F4226C0B6453291FAC58A089B37288C43DE8D426EB0F1206118623FA150CFE17`; `git diff --check` PASS. No se ejecutaron migraciones, restauraciones, suites S3/MCP/E2E completas, commit, push o merge. Los 512 unitarios, 1048 PostgreSQL, PF01–PF12 y BR01–BR08 anteriores no se repitieron y conservan sus resultados.

Las secciones inferiores conservan resultados históricos; prevalece esta actualización para imagen web, Kanban y lockfile.

## Revisión final de seguridad y deuda técnica — 2026-11-14

**Decisión recomendada: APTA CON CORRECCIONES OBLIGATORIAS; Lista 01 no se declara cerrada.** El detalle y la matriz están en [12 — Seguridad y deuda técnica](12-seguridad-deuda-tecnica.md). Se eliminaron de `web/src/plugins/axios.ts` los logs de token/refresh y se evitaron registros de objetos de error potencialmente sensibles en `useLogout.ts` y `login.vue`. Se añadió defensa para errores Axios sin `config` o `response`, sin cambiar el flujo de autenticación. Typecheck y build web PASS; no hay test unitario frontend y no se ejecutó Playwright por restricción de esta actividad. El artefacto local `web/dist` no contiene las cadenas sensibles; la imagen web en ejecución sigue siendo la anterior y requiere reconstrucción/verificación controlada antes de uso real.

Lint actualizado: **API 18 errores**, web **48 errores**, total **66**; ningún error nuevo en los tres archivos web modificados. Los 48 web son de estilo. API: 9 de imports/variables sin uso, 5 de callbacks/thenable, 3 de regex con marcador de control y 1 de asignación en expresión Kanban. El ESLint normal no arranca porque `@eslint/js` no figura como dependencia directa web; los 48 diagnósticos se obtuvieron con `NODE_PATH` de proceso dirigido al paquete ya presente en el almacén pnpm, sin instalación ni cambio de lockfile. Biome API añadió 11 warnings y 9 infos, no incluidos en los 66 errores.

PF07, PF08 y PF09 se revisaron sin repetirlos: roles múltiples y revocación 200→403, separación entre proyectos 403 y autorización de archivo 403. SDK `api-tokens` y `token-scope-organization` PASS previos; scopes de sesión/colaboración siguen entre las 19 suites SDK pendientes. También continúan 16 casos S3 de Files, una suite S3 separada, 12 MCP integración y 8 E2E. Su relevancia para Scrum y condiciones de diferimiento constan en 12. **No se ejecutaron** suites S3/E2E, migraciones ni proveedores externos.

Integridad de solo lectura de esta actividad: DB activa, recovery y BR07 `2 usuarios|4 proyectos totales|18 tareas|1 archivo|20 historial` cada una; los dos proyectos `L01-*` son un subconjunto del total de cuatro. Los tres volúmenes de adjuntos y el artefacto privado conservan el hash de 05. Scratch conserva ID físico `7708101047748980774`; original mantiene IDs, imágenes, `StartedAt` y estado `running`. Puertos L01 solo en loopback o sin publicación; original 1725/8888 en todas las interfaces, sin cambiarlo. `.env` ignorado, secretos temporales con ACL de un usuario; revisión acotada de logs no encontró patrones JWT/Bearer. Lockfile SHA-256 `2D0FA9B63C3438A1A707AD12D7D00509F97BAD96F5FBDE94A3959D74844BE494`; `git diff --check` PASS. Sin commit, push, merge ni Lista 02.

Los resultados anteriores de **512 unitarios PASS**, **1048 PostgreSQL PASS/0 FAIL**, PF01–PF12 y BR01–BR08 PASS se conservan sin repetición. Las secciones inferiores son trazabilidad histórica donde indiquen pendientes ya resueltos.

## Resultado más reciente — BR07 funcional (2026-11-14)

**BR07 PASS** mediante API exclusiva contra una **nueva copia desechable** del respaldo sintético validado. No se conectó una API a `taskview_l01_recovery` y no se generó otro backup. SHA-256 del dump y del adjunto privados verificados antes de copiar; `pg_restore --exit-on-error --single-transaction --no-owner --no-acl` terminó exit 0 solo en `taskview_l01_br07_20261114`. Esquema 1.74.0, 89 tablas, 21 triggers, conteos L01 y hash del archivo comprobados antes de arrancar la API. [Arquitectura y comandos](05-respaldo-versionamiento.md); [Compose y probe](entorno/br07.compose.yaml).

API BR07 `running`, solo en red interna junto a BR07 DB, sin puertos publicados. Los secretos son sintéticos e independientes en archivo temporal privado. No hay SMTP, S3 ni proveedores institucionales; el respaldo tiene cero integraciones, webhooks y jobs pendientes. PgBoss puede hacer escrituras operativas solamente en esta copia. La cuenta sintética recuperada inició sesión 200. El probe autenticado comprobó por contenido: proyectos IDs 3/4 `L01-*`; 13 tareas incompletas listadas en proyecto 3 y subtareas 3→2/4→3; sprint 1 `completed` con los tres campos de retro; roles 9/10; dos entradas de historial de tarea 13; adjunto ID `00cf6093-5393-4f04-befc-d040b6157738` de 38 bytes con descarga autorizada y SHA-256 `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`. Todos esos endpoints devolvieron 200 y las aserciones de datos pasaron. El probe no emitió token, contraseña, URL firmada ni contenido del archivo. BR01–BR06 y BR08 conservan PASS.

Regresión puntual scratch: función `tasks.add_roles_and_permissions()` conserva dos referencias a `timetracking_can_log`, conforme al SQL vigente 1.73.0. Tras ejecutar solo `FilesQuota.integration.spec.ts` (7/7 PASS), la función seguía intacta y `default-roles.test.ts` pasó 2/2. Los fixtures corregidos omiten la reaplicación de `all-triggers.sql` antiguo cuando `L01_TEST_DB_ONLY=1` y el guard verifica esquema y clúster. No se repitieron las demás suites ni se suman estos resultados a los totales históricos.

Integridad final: DB activa, recovery y copia BR07 conservan cada una conteos L01 `2 usuarios|2 proyectos|18 tareas|1 archivo|20 historial`; hashes del adjunto en los tres volúmenes iguales. Scratch conserva su clúster `7708101047748980774` y esquema 1.74.0. Contenedores originales conservan IDs, image IDs, `StartedAt` y `running`; lockfile SHA-256 `2D0FA9B63C3438A1A707AD12D7D00509F97BAD96F5FBDE94A3959D74844BE494`. No hubo migración sobre bases protegidas, acceso a GitLab, commit, push ni merge. Lista 01 continúa abierta por S3, 19 suites SDK, E2E, seguridad y 66 errores lint previos; no se abordaron en esta actividad.

Las secciones inferiores conservan estados históricos de BR07 BLOCKED previos a esta verificación; prevalece este resultado.

## Corrección acotada más reciente — 2026-11-14

El FAIL de `default-roles.test.ts` se debió a **deriva del esquema scratch**: una suite API había reaplicado `all-triggers.sql` 1.69.0 y sustituyó la función de roles predeterminados vigente en 1.73.0. El test aislado reprodujo la falta de `timetracking_can_log` para Editor. Se restauró solo `tasks.add_roles_and_permissions()` desde 1.73.0, dentro de una transacción y tras verificar identidad del scratch. El test completo aprobó 2/2. No se corrigió el test ni se alteraron permisos productivos. Evidencia de migraciones, autorización y SQL en [12 — Inventario PostgreSQL](12-inventario-postgresql.md).

Las cuatro suites API bloqueadas se ejecutaron por separado con el esquema 1.74.0 ya migrado, sin reaplicar `all-triggers.sql` 1.67.0. `WebhooksFiles` aprobó 1/1, `Import` 11/11 y `FilesQuota` 7/7. `Files` aprobó 12 casos locales; sus 16 casos S3 se omitieron deliberadamente y la suite permanece **BLOCKED parcial**. Typecheck API/SDK PASS. No se ejecutaron las 19 SDK bloqueadas; su clasificación por SMTP sintético, receptor, sesión e IdP está en [12](12-inventario-postgresql.md).

| Resultado PostgreSQL actualizado | Cantidad |
|---|---:|
| Suites identificadas | 79 |
| Suites con tests ejecutados | 60, incluida 1 parcial |
| Suites PASS completas | 59 |
| Suites FAIL | 0 |
| Suites BLOCKED | 20: 19 SDK y 1 API parcial |
| Tests PASS acumulados | 1048 |
| Tests FAIL actuales | 0 |

La guardia API volvió a rechazar el puerto activo 15432 antes de ejecutar tests. Scratch mantiene versión 1.74.0 y dos referencias a `timetracking_can_log` en la función vigente. Bases activa y recuperada conservan conteos L01 `2 usuarios|2 proyectos|18 tareas|1 archivo|20 historial`, hashes de ambos adjuntos y contenedores originales sin cambios de IDs, imágenes o inicio. Lockfile intacto; no hubo migración sobre bases protegidas, backup, restauración, commit, push ni merge. Persisten S3 y 19 suites SDK pendientes, además de las demás verificaciones de Lista 01. No se avanzó a BR07, E2E, seguridad ni Lista 02.

La sección siguiente conserva el estado de la ejecución PostgreSQL anterior como evidencia histórica.

## Resultado más reciente — integración PostgreSQL de Lista 01 (2026-11-14)

Este resultado actualiza el estado PostgreSQL de las secciones históricas siguientes. El inventario individual de las 79 suites, sus rutas, operaciones, dependencias, riesgos y clasificación está en [12 — Inventario PostgreSQL](12-inventario-postgresql.md). Se preparó PostgreSQL 17 scratch, volumen y red nuevos, API scratch y guardias Vitest que validan base, rol, versión e identificador físico del clúster antes de escrituras y `TRUNCATE`. Los grupos se ejecutaron secuencialmente; no se usaron `conf.private.ts`, `.env.for-test` heredado, S3 ni Playwright.

| Resultado | Cantidad |
|---|---:|
| Suites PostgreSQL identificadas | 79 |
| Suites ejecutadas con tests | 56 |
| Suites PASS | 55 |
| Suites FAIL | 1 |
| Suites BLOCKED | 23 |
| Tests PASS | 1016 |
| Tests FAIL | 1 |

API: 19 suites PASS y 238 tests PASS. SDK: 36 suites PASS y una FAIL, 778 tests PASS y uno FAIL. Dos suites SDK bloqueadas llegaron al setup pero no ejecutaron sus 31 tests por ausencia de `send-login-code`; se cuentan en BLOCKED, no en ejecutadas. `graph` marcó un test como skipped. Las cuatro API bloqueadas reaplican `all-triggers.sql` de una versión anterior y requieren revisar su efecto sobre el esquema actual, además de preparar almacenamiento/importación; 19 SDK bloqueadas requieren correo, receptor o IdP sintético y configuración de sesión. No se añadieron los 512 PASS unitarios previos a los 1016 de esta actividad.

Fallo reproducible: `default-roles.test.ts` aprobó 1/2; el rol editor no incluye `timetracking_can_log` que el test espera. Es una discrepancia funcional de permisos por investigar, sin cambios en negocio. Fallos de infraestructura corregidos solo en fixtures/configuración: timestamps inválidos del fixture `TaskMove`, expiración de refresh de `Auth.spec`, dominios `.example` de SCIM, receptor `.test` de webhook con red scratch sin salida externa. `recurrence-after-completion` falló una vez y aprobó 22/22 en repetición exacta: posible intermitencia. No se ocultaron diagnósticos ni se afirmó cobertura total; no se midió cobertura.

Integridad final: contenedores originales API/web/DB conservan IDs `aa6cc8…`/`1c1338…`/`b6d4f6…`, image IDs y `StartedAt` previos, en ejecución. Laboratorio activo y recovery-db siguen en ejecución; DB activa y recuperada mantienen cada una 2 usuarios sintéticos, 2 proyectos `L01-*`, 18 tareas, 1 archivo y 20 filas de historial. Los dos adjuntos sintéticos conservan SHA-256 `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`. Lockfile SHA-256 `2D0FA9B63C3438A1A707AD12D7D00509F97BAD96F5FBDE94A3959D74844BE494`, sin alteración. Git conserva cambios previos y añade únicamente infraestructura/fixtures/documentación de esta actividad; no hubo commit, push, merge, backup ni restauración. Las evidencias no incluyen contraseñas ni tokens. Los 66 errores lint conocidos permanecen registrados.

Las integraciones PostgreSQL **aún no bastan para cerrar Lista 01**: queda una suite FAIL y 23 BLOCKED, además de otras verificaciones previas pendientes. PF01–PF12 y BR01–BR06/BR08 conservan PASS; BR07 sigue BLOCKED y no se trabajó aquí. No se inició Lista 02.

Fecha: 2026-11-13. Checkout `b5a7e65`. No se confundió inspección estática con prueba de ejecución. PASS significa que la comprobación indicada se ejecutó y pasó; BLOCKED identifica prerrequisitos faltantes; NOT RUN indica no ejecutada. No se alteraron datos reales para pruebas.

Actualización 22:07 -05:00: el usuario pidió detener nuevas actividades y preparar un punto de continuación. Solo se completaron herramientas y verificaciones iniciales de la continuación; no hubo nuevas compilaciones, migraciones ni suites. La evidencia de la auditoría inicial se conserva y se distingue de los resultados nuevos.

## Matriz requerida

| Prueba | Estado | Comando utilizado | Evidencia | Observaciones |
|---|---|---|---|---|
| P01 Integridad | PASS | `git status --short`; `git branch --show-current`; `git log -1 --format="%H %cs %s"`; `git describe --tags --always --dirty`; `git diff --exit-code`; `git diff --cached --exit-code` | Inicialmente limpio en main, SHA b5a7e6598d927fe2e8a5936150093390c31ed13c; rama de auditoría creada. Al finalizar, solo archivos nuevos de esta entrega. | No commit/push/merge, no archivos originales reemplazados. |
| P02 Dependencias | PASS | `pnpm.cmd install --frozen-lockfile` con toolchain portable | 1788 paquetes; exit 0; SHA-256 de `pnpm-lock.yaml` sin cambios: `2D0FA9B63C3438A1A707AD12D7D00509F97BAD96F5FBDE94A3959D74844BE494`. | Scripts de build de varias dependencias ignorados por pnpm 10; no se aprobó su ejecución. |
| P03 Frontend | FAIL | `pnpm.cmd --filter web-nuxt-ui typecheck`; `pnpm.cmd --filter web-nuxt-ui lint`; `pnpm.cmd run build:webapp`; `pnpm.cmd --filter web-nuxt-ui build-only` | Tipos exit 2; lint exit 1 (48 errores); build completo exit 2. Vite aislado exit 0 y `web/dist/index.html` presente. | E2E NOT RUN; el bundle Vite no constituye build completo válido. |
| P04 Backend | FAIL | `pnpm.cmd --filter taskview-ce-api-server type-check`; `pnpm.cmd --filter taskview-ce-api-server lint`; `pnpm.cmd --dir api run build:docker`; `pnpm.cmd --dir api run build:migration` | Tipos exit 2; lint exit 1 (18 errores, 10 warnings); ambos bundles exit 0. | Servidor/migrador de archivos y bundle de migración generados; Vitest NOT RUN. |
| P05 Docker | PASS | `docker version --format '{{.Client.Version}} / {{.Server.Version}}'`; `docker compose version`; `docker compose -p taskview-l01-b5a7e65 -f docs/auditoria-taskview/entorno/compose.yaml --profile app --profile maintenance config --quiet` | Docker 29.9.3 cliente/servidor, Compose 5.7.0; config exit 0. | Solo validación de configuración; build/up NOT RUN. Interpolación con tres marcadores efímeros en entorno del proceso, retirados al finalizar. |
| P06 Regresión básica | NOT RUN | Ninguno | Sin instancia aislada funcional ni cuentas sintéticas. | Login, proyectos, tareas/subtareas, Kanban, sprints y roles pendientes. No se usó sesión ni cuenta cotidiana. |
| P07 Seguridad/aislamiento | BLOCKED | `docker compose ... config --format json` procesado en memoria sin imprimir environment; `docker inspect` filtrado; `Get-NetTCPConnection -State Listen` | Diseño separado validado: puertos 11725/18888/15432 localhost, red interna, volúmenes propios. | Subcomprobación estática PASS; aislamiento efectivo, credenciales y flujos HTTP requieren arrancar laboratorio. No se declara seguridad integral aprobada. |

El código de salida global de una sesión PowerShell con varios comandos no siempre representa cada fallo intermedio; se registraron por separado los errores de resolución de comandos.

## Resultados nuevos antes del punto de continuación

| Comprobación | Estado | Comando / evidencia | Alcance |
|---|---|---|---|
| Lectura de los nueve informes y auxiliares | PASS | `Get-Content ... -Encoding UTF8` | Se conservaron como línea base; no se repitió la auditoría funcional. |
| Git / herramientas iniciales | PASS | Rama `chore/l01-auditoria-taskview`, SHA original; Docker 29.9.3 y Compose 5.7.0 | `git status --short` solo muestra `?? docs/auditoria-taskview/`; no commits nuevos. |
| Node portable | PASS | Descarga oficial 24.22.2, comparación SHA-256 con SHASUMS256.txt, extracción, `node.exe --version` | Salida v24.22.2, exit 0; directorio temporal exclusivo. |
| pnpm local | PASS | `npm.cmd install --prefix .../pnpm --cache .../npm-cache --no-audit --no-fund pnpm@10.28.1`; `pnpm.cmd --version` | Un paquete instalado; 10.28.1; exit 0. No es instalación de dependencias del monorepositorio. |
| Instalación congelada / compilación / lint | NOT RUN | Ninguno con toolchain nueva | Pausa anterior a `pnpm install --frozen-lockfile`. No hay api/dist ni web/dist. |
| Recursos del laboratorio | PASS | `docker ps -a`, `docker volume ls`, `docker network ls` filtrados por etiqueta `com.docker.compose.project=taskview-l01-b5a7e65` | Las tres consultas no devuelven recursos. No implica que la aplicación funcione. |
| Secretos de laboratorio | NOT RUN | `Test-Path docs/auditoria-taskview/entorno/.env` devuelve False | No se generaron secretos ni cuentas. |
| PF01–PF12, unitarias/integración/E2E | NOT RUN | Ninguno | Sin aplicación aislada ni datos sintéticos. |
| Respaldo/restauración sintéticos | NOT RUN | Ninguno | Sin DB ni adjuntos de laboratorio. |
| Integridad Docker al detener | PASS | `docker inspect` limitado a nombre, ID, imagen, StartedAt y estado | Los tres originales siguen running, con IDs, imágenes y arranques iguales a la inspección inicial de esta continuación. |

No se observaron procesos `node.exe`/`npm.exe`/`pnpm.exe` con ejecutable bajo `taskview-l01-toolchain` en la comprobación de cierre. El comando de instalación ya había terminado con exit 0. La celda de orquestación 27 no pudo recuperarse tras la interrupción (`exec cell 27 not found`); su segunda operación era una lectura de tests y controladores, cuyo resultado no se da por verificado. No hay build/migración pendiente de recuperar.

## Verificaciones adicionales ejecutadas

| Verificación | Resultado / alcance |
|---|---|
| `rg --files`, búsquedas por módulo y lectura de manifiestos/esquemas/Routes | Directorios api/web/taskview-packages confirmados; no AGENTS.md encontrado mediante búsqueda local y del directorio padre. Se revisaron las áreas listadas en 01–03. |
| `docker ps --format '{{.Names}}\|{{.Image}}\|{{.Ports}}'` | API 1725→1401, web 8888→80; PostgreSQL sin puerto host. También hay otros servicios que no se tocaron. |
| `docker inspect` con plantilla limitada a nombre, image ID, StartedAt, mounts y redes | Red/volumen activos documentados; archivos y logs por bind. No se mostró Config.Env. |
| `docker image inspect` procesado con `ConvertFrom-Json`, seleccionando Id/RepoDigests/Created/etiquetas OCI | Digests en 05; etiquetas OCI revision/version ausentes. |
| `docker exec taskview-taskview-api-server-1 cat /usr/src/app/package.json` canalizado a `ConvertFrom-Json`, seleccionando name/version | Runtime 1.17.0; contrastado con production.package.json. No demuestra versión real de fuentes. |
| SQL de metadatos con `PGOPTIONS=-c default_transaction_read_only=on`, `psql -X -v ON_ERROR_STOP=1 -At` | PostgreSQL 17.12; app.version 1.74.0; no datos de negocio consultados. |
| Script Node por stdin: comprobar rutas de `install.json` y `migrate.json` con `fs.existsSync` | 70 versiones, 169 referencias de scripts; 0 rutas faltantes. Prueba de existencia, no ejecución ni validez SQL. |
| Lectura del lockfile con Node | Versiones exactas en 01; no modificación del lockfile. |
| Aserciones PowerShell sobre JSON Compose en memoria | PASS: red interna, destino DB fijo, volúmenes con prefijo exclusivo y no externos, sin bind mounts y puertos publicados solo en 127.0.0.1. Sin listeners en 11725/18888/15432 al repetir la consulta. No prueba conectividad runtime. |
| `docker compose -p taskview-l01-b5a7e65 -f docs/auditoria-taskview/entorno/compose.yaml --env-file docs/auditoria-taskview/entorno/.env.example config --quiet` | Rechazó variables obligatorias vacías, como se esperaba: PASS de prueba negativa. No se arrancó ningún servicio. |
| `git check-ignore docs/auditoria-taskview/entorno/.env` | PASS: configuración privada excluida. El archivo de secretos no fue creado. |
| Script Node con `fs.existsSync` sobre enlaces Markdown locales y rutas completas de código | 9 documentos Markdown; 0 referencias locales faltantes entre las comprobadas. No sustituye revisión semántica de cada conclusión. |
| Inspección final de los tres contenedores originales | Siguen running con los mismos image IDs y StartedAt: API 2026-11-13T20:25:01.439578433Z; web 20:24:55.107263083Z; DB 20:24:55.2220635Z. No hubo reinicios provocados por esta auditoría. |

Consulta de metadatos ejecutada correctamente desde PowerShell:

```powershell
$auditSql = 'export PGOPTIONS="-c default_transaction_read_only=on"; psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -c "SELECT current_setting(''server_version''); SELECT version FROM app.version WHERE id = 1;"'
$auditSql | docker exec -i taskview-db-1 sh
```

## Incidencias de ejecución registradas

- El sandbox del ejecutor falló al crear su proceso (`helper_sandbox_lock_failed`, acceso denegado). Las lecturas/verificaciones necesarias se reintentaron mediante el mecanismo de aprobación de ejecución; no se eludieron restricciones con otro acceso.
- Un comando de búsqueda con expansión `{...}` no era válido en PowerShell. Se sustituyó por búsqueda de rutas reales.
- Una consulta de etiqueta OCI por plantilla y un `node -p` dentro del contenedor fallaron por comillas de Windows. Se reemplazaron por selección estructurada de JSON y lectura del manifiesto. No hubo mutación de contenedores.
- Un primer script SQL por stdin obtuvo las dos versiones pero terminó con error de sintaxis por delimitador heredoc/CRLF. Se repitió con `psql -c` en modo read-only y terminó correctamente. No contenía DDL ni DML.
- Una primera extracción de versiones del lockfile no reconoció CRLF; al normalizar finales de línea devolvió las versiones documentadas. No afectó archivos.

## Riesgos previos de las pruebas del repositorio

`api/vitest.config.ts` importa configuración privada ausente y fija conexiones/valores de ejemplo: no trasladarlos a documentación operativa ni usarlos en una DB cotidiana. Hay suites de archivos con S3/SeaweedFS y pruebas de integración con PostgreSQL. `web/e2e/docker-compose.yml` referencia `dockers-check` ausente y nombres de imágenes `taskview-se-*`; no es un stack CE listo en este checkout. `web/playwright.config.ts` tiene global setup/teardown comentados, baseURL/webServer 5173 y reuseExistingServer, frente a Vite 5174. El Compose de `api/dev-containers-test/` coincide con puertos de la instalación existente. Todos requieren destino exclusivo antes de ejecutar suites.

## Pendientes de aceptación técnica

### Continuación limitada a instalación y compilación

Rama `chore/l01-auditoria-taskview`, HEAD `b5a7e6598d927fe2e8a5936150093390c31ed13c`; Node v24.22.2 y pnpm 10.28.1 activados solo en cada proceso PowerShell. El hash SHA-256 del lockfile se comprobó antes y después, sin variación. El estado Git final muestra solo `?? docs/auditoria-taskview/`; todos los `dist` y `node_modules` generados están ignorados. No se hicieron cambios de aplicación ni se creó laboratorio Docker.

| Comando ejecutado desde la raíz salvo `--dir` | Estado | Exit | Duración | Resultado |
|---|---|---:|---:|---|
| `pnpm.cmd install --frozen-lockfile` | PASS | 0 | 37 s | 1788 paquetes; aviso de scripts de dependencias ignorados y descargas lentas. |
| `pnpm.cmd run build:packages` | PASS | 0 | 8 s | SDK y esquemas: TypeScript y Vite completados. Aviso de nombre global inferido para `drizzle-arktype`. |
| `pnpm.cmd --filter capacitor-widget-bridge build` | PASS | 0 | 1 s | tsc y `dist` presentes. |
| `pnpm.cmd --filter taskview-ce-api-server type-check` | FAIL | 2 | 6 s | TS2769 en `api/src/tv-modules/auth/AuthModel.ts:273,365` y `api/src/utils/api.ts:8`; TS2578 en `CollaborationManager.ts:91`; TS18048 en `RecurrenceGenerator.ts:161,162`. La salida conservada mostró los últimos 22 renglones: estos ejemplos no son un inventario exhaustivo. |
| `pnpm.cmd --filter web-nuxt-ui typecheck` | FAIL | 2 | 9 s | `useToast` no reconocido en `TaskSprintSelect.vue:74` y otros; `useAppConfig` en `useThemeColors.ts:210`; `defineShortcuts` en `useTaskShortcuts.ts:15`. Dos errores del puente en `useLogout.ts:2` y `useWidgetSnapshot.ts:6` corresponden a una ejecución antes de compilarlo. |
| `pnpm.cmd --filter taskview-ce-api-server lint` | FAIL | 1 | 1 s | Biome: 515 archivos, 18 errores, 10 advertencias, 9 informativos; 17 diagnósticos excedieron el límite de salida. Sin fixes. |
| `pnpm.cmd --filter web-nuxt-ui lint` | FAIL | 1 | 8 s | ESLint: 48 errores; ejemplos de sangría en `web/src/stores/base-screen.store.ts:119–130`. Sin fixes. |
| `pnpm.cmd --dir api run build:docker` | PASS | 0 | 39 s | `api/dist/taskview-server.js` y `taskview-files-migrate.js` presentes. Solo bundle: no imagen ni contenedor. |
| `pnpm.cmd --dir api run build:migration` | PASS | 0 | 1 s | `api/dist-migration/taskview-db-migration.js` presente; no se ejecutó migración. |
| `pnpm.cmd run build:webapp` | FAIL | 2 | 21 s | Reconstruye paquetes/puente y se detiene en `vue-tsc`; persisten errores de composables. |
| `pnpm.cmd --filter web-nuxt-ui build-only` | PASS | 0 | 12 s | Vite generó `web/dist/index.html`; aviso de chunks mayores de 500 kB, principal ~5.88 MB. No incluye typecheck. |

El build completo web volvió a construir el puente antes del fallo, de modo que el resultado de tipos sigue siendo FAIL aunque los dos errores iniciales del puente fueran temporales. El sandbox falló al iniciar una lectura final (`helper_sandbox_lock_failed`); se reintentó por el mecanismo de aprobación y se verificaron los artefactos y el hash. Las pruebas funcionales, Vitest, E2E, Docker y respaldo no se ejecutaron en esta continuación.

Herramientas e instalación congelada resueltas; los typecheck y lint de API/web requieren atención y el build completo web falla. En otra ejecución autorizada, revisar estos diagnósticos antes de pasar a Docker, pruebas funcionales y recuperación. La Lista 01 sigue pendiente; P06 no se ejecutó y P07 conserva su alcance estático. El documento 10 refleja el punto anterior a esta continuación y esta sección registra los avances posteriores.

## Diagnóstico y corrección TypeScript/lint — 2026-11-13

Ejecución acotada solicitada: no se inició Docker, laboratorio, migraciones, pruebas funcionales, Vitest ni E2E. Se conservaron diagnósticos completos en `%TEMP%\taskview-tslint-20261113-222724\` (fuera del repositorio); los logs contienen salida de compilador/linter, no secretos. Node v24.22.2 y pnpm 10.28.1 se activaron solo en el proceso PowerShell. Rama y HEAD permanecieron `chore/l01-auditoria-taskview` / `b5a7e6598d927fe2e8a5936150093390c31ed13c`.

### TypeScript y build

| Verificación | Antes de correcciones | Después | Estado final |
|---|---:|---:|---|
| API `pnpm.cmd --filter taskview-ce-api-server type-check` | 12 diagnósticos TypeScript | 0 | PASS (exit 0) |
| Web `pnpm.cmd --filter web-nuxt-ui typecheck` | 0 | 0 | PASS (exit 0) |
| Build completo `pnpm.cmd run build:webapp` | PASS en esta ejecución | PASS | PASS (exit 0) |

Los 12 errores API se agruparon así: cinco en `api/src/migrations/migrate.ts` por añadir `lastQuery` a `PoolClient` y asignar una función que no conservaba las sobrecargas de `query`; cuatro TS2769 en `AuthModel.ts` y `utils/api.ts` por pasar primero el mensaje y luego los datos a Pino, contrario a su firma instalada; un TS2578 por un `@ts-expect-error` ya innecesario en `CollaborationManager.ts`; y dos TS18048 porque la propiedad `ended` de la unión de resultados puede estar ausente. Las correcciones preservan el seguimiento temporal de la última consulta mediante `Proxy`, registran solo texto (sin valores ligados), usan el orden objeto/mensaje de Pino, quitan la supresión obsoleta y comprueban que `outcome.ended` exista.

Los diagnósticos frontend previamente observados (`useToast`, `useAppConfig`, `defineShortcuts` y los tipos de Capacitor) no se reprodujeron después de compilar paquetes compartidos y el puente: typecheck web y build completo pasaron sin errores. No se agregaron imports ni declaraciones de tipos especulativas. No hay evidencia suficiente para atribuir con certeza la desaparición a una causa única; los errores del puente sí habían sido registrados antes de compilar ese paquete.

### Lint

| Verificación | Errores antes | Errores después | Advertencias adicionales | Estado |
|---|---:|---:|---:|---|
| API `pnpm.cmd --filter taskview-ce-api-server lint` | 18 | 18 | 10 warnings, 9 infos | FAIL (exit 1) |
| Web `pnpm.cmd --filter web-nuxt-ui lint` | 48 | 48 | 0 | FAIL (exit 1) |

API se contó con un segundo diagnóstico `biome lint . --max-diagnostics=100`, que enumeró todos los errores (el script ordinario corta la lista). Los 18 se distribuyen en `GoalPermissionsFetcher.ts` y `all-events.ts` (callbacks de `forEach` que retornan valor); `AuthController.ts` (imports/variable sin uso); `InviteEmailDispatcher.spec.ts` (propiedad `then`); `JiraDcWikiMarkup.ts` (tres caracteres de control en expresiones regulares); `IntegrationsRepository.ts`, `KanbanRepository.ts`, `OAuthManager.ts` y `StartRepository.ts` (imports sin uso); `InvoicePdfRenderer.spec.ts` (dos callbacks de `forEach`); `KanbanManager.ts` (asignación en expresión); `messages.ts` (alias sin uso); y `SsoManager.ts` (miembro privado sin uso). Son diagnósticos preexistentes repartidos entre código y pruebas; los potenciales cambios semánticos (regex, thenable, asignación/callbacks) requieren revisión individual. No se aplicó autofix.

Web reportó 48 errores de estilo: sangría/atributos Vue en `ApiTokenItem.vue`, `ProjectAddInput.vue`, `SessionItem.vue`, `TimeReportsKpis.vue`, `UiCustomizationSection.vue`; comas en `usePriorityOptions.ts`; e indentación en `base-screen.store.ts`. ESLint marcó 47 como potencialmente corregibles con `--fix`; no se ejecutó porque sería una reescritura mecánica sobre varios archivos. Biome también informa que `api/biome.json` declara esquema 2.3.8 y el CLI instalado es 2.3.11; no se migró la configuración.

### Comandos de verificación ejecutados

| Comando | Exit / estado |
|---|---|
| `pnpm.cmd --filter taskview-ce-api-server type-check` (diagnóstico inicial y posterior) | 2 con 12 errores; luego 0 |
| `pnpm.cmd --filter web-nuxt-ui typecheck` (inicial y posterior) | 0; 0 |
| `pnpm.cmd --filter taskview-ce-api-server lint` (inicial y posterior) | 1; 1, 18 errores / 10 warnings / 9 infos |
| `pnpm.cmd --filter web-nuxt-ui lint` (inicial y posterior) | 1; 1, 48 errores |
| `pnpm.cmd run build:webapp` (inicial y posterior) | 0; 0 |
| `pnpm.cmd exec biome lint . --max-diagnostics=100` desde `api/` | 1, inventario completo de los 18 errores API |
| `git diff --check` | PASS |

Los logs de cada ejecución y los códigos de salida están en la carpeta temporal indicada, no versionada. `pnpm-lock.yaml` conserva SHA-256 `2D0FA9B63C3438A1A707AD12D7D00509F97BAD96F5FBDE94A3959D74844BE494`. Los bundles completos no prueban el arranque HTTP ni la regresión funcional. Riesgo residual: lint continúa bloqueado y las correcciones de logging solo se validaron estáticamente; las suites de pruebas con DB no se ejecutaron.

### Cambios de código

- `api/src/migrations/migrate.ts`: proxy tipado para capturar la última consulta sin mutar el tipo de `PoolClient`; no captura valores enlazados.
- `api/src/tv-modules/auth/AuthModel.ts` y `api/src/utils/api.ts`: argumentos de Pino en el orden requerido por la versión instalada.
- `api/src/tv-modules/collaboration/CollaborationManager.ts`: eliminación de directiva `@ts-expect-error` obsoleta.
- `api/src/tv-modules/recurrence/RecurrenceGenerator.ts`: guardia definida para el resultado `ended`.

No se cambió el lockfile, configuración de Docker, esquema ni contrato público. La instalación original no se consultó ni modificó en esta actividad.

### Estado para la siguiente fase

Compilación y tipos están listos para que una actividad separada evalúe el laboratorio Docker aislado; lint conserva deuda técnica y debe tratarse como tal antes de adoptar un gate limpio. Docker, laboratorio, migraciones, pruebas funcionales y respaldo siguen NOT RUN en esta actividad. No se inició Lista 02.
Aclaración comprobada sobre los composables frontend: `web/vite.config.ts` registra `@nuxt/ui/vite`; la dependencia instalada es `@nuxt/ui` 4.4.0. El archivo generado `web/auto-imports.d.ts` (incluido explícitamente en `web/tsconfig.app.json`) declara `useToast`, `useAppConfig` y `defineShortcuts` mediante imports de los exports presentes en esa versión. Por el patrón de autoimport ya configurado, añadir imports manuales duplicaría el mecanismo. Los typecheck actuales se ejecutaron con esas declaraciones disponibles. El archivo es generado/ignorado y no se modificó.
## Laboratorio Docker aislado — 2026-11-14

Ejecución posterior a la corrección de TypeScript/lint. Se mantuvieron la rama `chore/l01-auditoria-taskview` y HEAD `b5a7e6598d927fe2e8a5936150093390c31ed13c`; sin commits. Los logs de build/migración/arranque se conservaron solo en `%TEMP%\taskview-docker-prep-20261113-224055\`; no se imprimieron secretos. El `.env` sintético está fuera del control de versiones por `entorno/.gitignore`.

| Prueba | Estado | Comando / evidencia | Observaciones |
|---|---|---|---|
| Build API runtime | PASS | `pnpm.cmd --dir api run build:docker` exit 0; artefacto posterior al cambio de código | Etiqueta Compose privada del laboratorio. |
| Build migrador | PASS | `pnpm.cmd --dir api run build:migration` exit 0; hash del bundle en staging coincide con el origen antes de construir | Paquete incluyó scripts SQL en contexto `api/postgresql/dist-migration/taskview`. |
| Build web | PASS | `pnpm.cmd run build:webapp` exit 0; imagen web reconstruida después del arreglo CRLF | No confundir con pruebas funcionales. |
| Compose config / secretos | PASS | `docker compose -p taskview-l01-b5a7e65 -f docs/auditoria-taskview/entorno/compose.yaml --env-file docs/auditoria-taskview/entorno/.env --profile app --profile maintenance config --quiet` | Config efectiva revisada en memoria; DB destino, URLs, puertos, secretos sintéticos, volúmenes, imágenes y red coinciden; ninguna referencia a recursos originales/GitLab institucional. |
| Construcción de imágenes | PASS | `docker compose -p taskview-l01-b5a7e65 -f ... --env-file ... --profile app --profile maintenance build api web migration`; luego builds dirigidos de `migration` y `web` | IDs: API `sha256:ccb3dac6fbd4cda0aabd41febafbab6d7d5c61ba4d5abd7016c1c92b2361109f`; web `sha256:e1a87d3201b26328d02c47121e59d9fee5c6f8f28f4ab0ba6ddc7e75d8f25752`; migración `sha256:b409b86c1b141f4cbc81b081b1fd9948783fb72c7a86703737f3f527daf6d39c`. |
| Inicio DB | PASS | `docker compose -p taskview-l01-b5a7e65 -f ... --env-file ... up -d db`; `docker inspect`; `psql` read-only | Contenedor `taskview-l01-b5a7e65-db-1`, PostgreSQL 17.12, DB/usuario `taskview_l01`, volumen `_pgdata` exclusivo, healthy, cero tablas de aplicación antes de migrar. |
| Migración inicial | FAIL, corregida | `... --profile maintenance run --rm migration` | Exit 255 antes de ejecutar el bundle: script `/entrypoint.sh` tenía CRLF y falló su shebang. No hubo SQL ni cambios a la DB. |
| Migración final | PASS | Mismo `docker compose -p taskview-l01-b5a7e65 -f ... --env-file ... --profile maintenance run --rm migration` | Exit 0, `Migration successful!`; versión `app.version=1.74.0`; 70 filas de versiones, 81 tablas al terminar migración. |
| Arranque API/web inicial | PARCIAL | `... --profile app up -d api web`; `docker inspect`, logs | API running y conectada a PostgreSQL; web exit 127 por CRLF en el script runtime de nginx. |
| Arranque API/web final | PASS | `... --profile app up -d api web`; `docker compose ... ps` | Tres servicios running, DB healthy, reinicios 0. API 11725→1401; web 18888→80; DB 15432→5432, bindings solo `127.0.0.1`. |
| HTTP web/configuración | PASS | `Invoke-WebRequest` GET `http://localhost:18888/` y `/config.js` | Ambos 200; `config.js` apunta a `http://localhost:11725`. |
| API y CORS | PASS | GET `/module/auth/login-options` con `Origin: http://localhost:18888`; OPTIONS con método GET y headers `authorization,content-type` | GET 200 con `Access-Control-Allow-Origin` correcto; preflight 204 con el mismo origen. Prueba de transporte/CORS, no login. |
| Aislamiento Docker | PASS con alcance | `docker inspect`, `docker network inspect`, `docker volume ls`, Compose config efectivo, scan de logs | Red bridge exclusiva con IP masquerading deshabilitado; volúmenes `_pgdata`, `_files`, `_logs`; solo endpoints del laboratorio; cero bind mounts/socket Docker; sin secretos o URL institucional en logs/config. No se probó conexión a servicios externos reales ni una regla firewall de host. |
| Integridad instalación original | PASS | `docker inspect` limitado a ID, image ID, estado, StartedAt y nombres de volúmenes/red | Los tres IDs, image IDs, `running`, StartedAt UTC, `taskview_pgdata` y mounts coinciden con el inventario previo. No hubo reinicio/recreación. |
| PF01–PF12, Vitest/E2E, respaldo/restauración | NOT RUN | Ninguno | Siguiente actividad de Lista 01; solicitada detención al terminar laboratorio. |

### Hallazgos de contenedores y migrador

La red de la configuración inicial tenía `internal: true`. Aunque Compose declaraba los mappings, Docker Desktop dejó `NetworkSettings.Ports` vacíos y no permitió solicitudes Windows a localhost. Se cambió solo la configuración de red del laboratorio a bridge sin `com.docker.network.bridge.enable_ip_masquerade`; luego el daemon publicó los puertos localhost. Docker describe que `internal` elimina conexión con interfaces host y que una bridge sin masquerading no ofrece el egreso normal a Internet ([redes internas](https://docs.docker.com/compose/how-tos/networking/#internal-networks), [publicación de puertos/masquerading](https://docs.docker.com/engine/network/port-publishing/)). La salida externa no se probó activamente.

En Windows, `api/postgresql/entrypoint.sh` y `web/docker-runtime-config.sh` están en CRLF al construir el contexto. Se incorporó `sed -i 's/\r$//'` en cada Dockerfile antes de `chmod`; dentro de ambas imágenes se verificó shebang `#!/bin/sh` terminado en LF. Son cambios de compatibilidad de build; no alteran la lógica SQL ni la URL runtime.

La revisión del cambio de `api/src/migrations/migrate.ts` confirmó que el `Proxy` llama al query original con `Reflect.apply(target, client, args)`, conservando el receptor `client` y transmitiendo los mismos argumentos en el mismo orden. La observación guarda únicamente texto de query o marcador de query-config, sin registrar valores ligados. El migrador selecciona sesiones con `datname = process.env.DB_NAME` y excluye `pg_backend_pid()`; el entorno comprobado fija DB_HOST=`db`, DB_NAME/USER sintéticos. Se reconstruyó y ejecutó solo contra la base nueva del proyecto aislado.

Después del inicio API, la inspección read-only contó 89 tablas totales; 8 están en `pgboss`. `api/src/core/JobQueue.ts` inicia PgBoss con el schema `pgboss`, así que ese incremento se atribuye a las tablas del motor de trabajos. La versión de migración siguió en 1.74.0; no se ejecutó una segunda migración.

Los logs de API contienen advertencias de Node `punycode` y `pg` por consultas concurrentes del cliente; no hubo errores fatales y el servicio permaneció running con restart count 0. Deben evaluarse antes de fijar un gate de producción; no se ampliaron a cambios de esta actividad.

En el cambio de red se usó `docker compose ... --profile app --profile maintenance down` sin `-v` para recrear exclusivamente contenedores/red del laboratorio. Los tres volúmenes persistieron y se reutilizó la DB ya migrada. No se ejecutó limpieza global.

### Estado

El entorno está listo para iniciar PF01–PF12 y las suites seguras de Lista 01. No se declara Lista 01 cerrada: faltan pruebas funcionales, autorización/roles, adjuntos/historial, revisión de secretos en comportamiento, respaldo/restauración y lint pendiente. No se inició Lista 02.

## Pruebas funcionales PF01–PF12 — 2026-11-14

Alcance de esta ejecución: prechecks de aislamiento, solicitudes HTTP locales no mutantes a la API del laboratorio y comprobación de disponibilidad de la instalación original. No se ejecutaron migraciones, suites extensas, E2E, backup ni restore; no se crearon cuentas ni datos de aplicación.

### Prechecks y evidencia de aislamiento

| Control | Estado | Evidencia saneada |
|---|---|---|
| Proyecto y servicios del laboratorio | PASS | Proyecto `taskview-l01-b5a7e65`; API `taskview-l01-b5a7e65-api-1` (ID `68d5101739c8`), Web `taskview-l01-b5a7e65-web-1` (`5dac7637f29f`) y DB `taskview-l01-b5a7e65-db-1` (`455ab9ddd923`) en ejecución; PostgreSQL healthy. |
| Puertos y URL de prueba | PASS | Solo se consultaron `localhost:18888` y `localhost:11725`; los bindings observados son `127.0.0.1:18888`, `127.0.0.1:11725` y PostgreSQL `127.0.0.1:15432`. |
| DB sintética | PASS | La inspección previa vigente registra DB/usuario `taskview_l01`, esquema 1.74.0, PostgreSQL 17.12; API configurada con host de servicio `db`. No se consultaron filas de negocio. |
| Recursos Docker aislados | PASS | Red exclusiva `taskview-l01-b5a7e65_default`; volúmenes `taskview-l01-b5a7e65_pgdata`, `_files` y `_logs`. No se conectaron rutas a la red original ni se accedió al volumen original. |
| Proveedores institucionales | PASS | Compose efectivo documentado en 04 configura autenticación password, almacenamiento local y no define SMTP/OAuth/GitLab institucional/S3/Firebase. No se enviaron solicitudes externas; el egreso no se probó activamente en esta ejecución. |
| Datos y cuentas sintéticos | PASS | No se utilizó cuenta ni información institucional. El único intento de autenticación usó identificador ficticio bajo `.invalid` y contraseña ficticia; no se guardaron ni imprimieron valores. |
| Instalación original | PASS | API original ID `aa6cc8…`, Web `1c1338…` y DB `b6d4f6…`: mismo image ID, estado `running` y StartedAt que el inventario anterior. GET web original `http://localhost:8888/` → 200; GET API original `/module/auth/login-options` → 200. Metadatos únicamente; no se consultaron datos de negocio. |

### Acceso y limitación de autenticación

`GET http://localhost:11725/module/auth/login-options` devolvió 200 y confirmó `password=true`, `publicRegistration=true`, SSO desactivado y cero proveedores sociales. El código de `api/src/tv-modules/auth/AuthController.ts` (métodos `registration` y `confirmEmail`) establece que el registro crea la cuenta con bloqueo activo y requiere confirmación enviada por email. El Compose no configura SMTP y no hay un mecanismo local verificado para confirmar ese correo. No se intentó el registro: habría dejado una cuenta sintética bloqueada y habría invocado el envío de correo. Tampoco se modificaron tablas de autenticación ni se usaron credenciales bootstrap desconocidas.

Pruebas HTTP no mutantes ejecutadas contra el laboratorio:

| Comando/operación | Resultado | Alcance |
|---|---|---|
| GET `/module/auth/login-options` | 200 | Opciones de autenticación; no prueba una sesión válida. |
| POST `/module/auth/login` con credenciales ficticias inválidas | 400 | Rechazo de credenciales inválidas; la contraseña no se guardó en evidencia. |
| GET `/module/goals` sin sesión | 401 | Middleware de autenticación rechaza acceso anónimo. |
| GET `/module/tasks` sin sesión | 401 | Middleware de autenticación rechaza acceso anónimo. |
| GET `/module/sprints/1` sin sesión | 401 | Middleware de autenticación rechaza acceso anónimo antes de consultar un sprint. |
| GET `/module/analytics/sections-catalog` sin sesión | 401 | Middleware de autenticación rechaza acceso anónimo. |

El 200 de las opciones y los 401/400 anteriores no demuestran login correcto ni comportamiento CRUD. La observación previa de `web/src/plugins/axios.ts` sobre logging de datos de refresh/token sigue siendo un riesgo: se evitó el navegador y no se obtuvo token válido ni se guardaron logs crudos.

### Matriz PF01–PF12

| Prueba | Estado | Resultado / evidencia | Bloqueo o riesgo |
|---|---|---|---|
| PF01 — Autenticación | BLOCKED | Opciones de login 200; login sintético inválido rechazado 400; recursos protegidos rechazaron acceso anónimo 401. No se comprobó login/cierre de sesión exitosos. | Falta cuenta sintética habilitada. Registro requiere confirmación por email; no hay SMTP ni mecanismo de confirmación local verificado. |
| PF02 — Proyectos | BLOCKED | No se creó ni modificó proyecto. | Requiere sesión autorizada; no se dispone de cuenta sintética habilitada. |
| PF03 — Tareas | BLOCKED | No se crearon ni modificaron tareas, responsables o estados. | Requiere sesión autorizada. |
| PF04 — Subtareas | BLOCKED | No se creó jerarquía ni se probaron ciclos/referencias cruzadas. | Requiere sesión y proyectos sintéticos. |
| PF05 — Kanban | BLOCKED | No se consultaron ni movieron tarjetas. | Requiere acceso a proyecto con permisos. |
| PF06 — Sprints | BLOCKED | No se creó/activó/cerró sprint ni se cambió planificación. | Requiere sesión; no se alteraron estados de sprint. |
| PF07 — Roles | BLOCKED | No se asignaron ni revocaron roles; permisos efectivos no verificados. | Se requieren cuentas sintéticas autorizadas; no se modificaron tablas de auth/roles directamente. |
| PF08 — Permisos entre proyectos | BLOCKED | No se crearon proyectos ni se probó aislamiento funcional entre usuarios. | Requiere dos cuentas activas y dos proyectos sintéticos. |
| PF09 — Adjuntos | BLOCKED | No se cargaron/descargaron archivos. | Requiere sesión y tarea sintética; almacenamiento local no verificado funcionalmente en esta ejecución. |
| PF10 — Historial | BLOCKED | No se generaron cambios de tarea ni se consultó historial. | Requiere sesión y tarea sintética. |
| PF11 — Review y retrospectiva | BLOCKED | No se ejecutó Review ni se persistió retrospectiva. | Requiere sprint sintético y cuenta con permiso; no se cerró ningún sprint. |
| PF12 — Analítica | BLOCKED | La ruta protegida rechazó acceso anónimo 401; no se consultaron indicadores ni gráficos con datos. | Requiere sesión con permisos y datos de proyecto/sprint. |

### Comandos y operaciones registrados

| Operación | Estado | Observación |
|---|---|---|
| Consultas de metadatos Docker (`docker ps`, `docker inspect` con campos seleccionados) | PASS | No se imprimieron variables de entorno ni secretos. |
| GET de páginas web/API originales y laboratorio | PASS | Solo verificaciones HTTP GET a localhost; original web/API 200, laboratorio auth options 200. |
| GET protegidos sin sesión + POST login inválido | PASS (comportamiento de rechazo) | Resultados 401/400; no equivalen a pruebas autenticadas. |
| PF01–PF12 autenticadas | BLOCKED | No se ejecutaron operaciones de escritura de aplicación. |
| Migraciones, respaldo/restauración, E2E y pruebas extensas | NOT RUN | Fuera de alcance o explícitamente prohibidas para esta continuación. |

No se modificó código, esquema, configuración Docker ni lockfile. En esta ejecución solo se actualiza este informe y el resumen ejecutivo. La recomendación es habilitar un método de creación/confirmación de cuentas sintéticas limitado al laboratorio (por ejemplo, SMTP sink de laboratorio o procedimiento oficial de bootstrap documentado), revisando primero el impacto de red; luego repetir PF01 y continuar PF02–PF12. No activar cuentas editando directamente tablas de autenticación.

## Desbloqueo y prueba de autenticación PF01 — 2026-11-14

Esta actualización posterior prevalece sobre el bloqueo anterior de PF01. Se preservan los resultados previos; la única prueba funcional ejecutada en esta continuación fue PF01. PF02–PF12 siguen sin ejecutar.

### Método aplicado

La documentación oficial indica que una instalación nueva incluye un usuario bootstrap y permite reclamarlo dentro de TaskView sin SMTP ni acceso a PostgreSQL ([instalación](https://taskview.tech/docs/getting-started/installation#log-in-with-the-default-user), [autenticación](https://taskview.tech/docs/configuration/authentication#the-default-user-self-hosted)). El código del checkout confirma la semilla en `api/src/migrations/taskview/sql/0.0.0/app/auth/app_permissions.sql` y el endpoint protegido `POST /module/auth/credentials/change` en `api/src/tv-modules/auth/AuthRoutes.ts` / `AuthController.ts`.

En la base sintética `taskview_l01` se comprobó, mediante consulta read-only con filtro de login/email bootstrap, una fila habilitada. Se autenticó mediante API con el método público documentado y se reclamó inmediatamente usando el endpoint oficial, reemplazando las credenciales por valores sintéticos fuertes. No se leyeron ni modificaron hashes, bloqueos, roles o permisos por SQL. El cambio de credenciales revocó la sesión bootstrap; el nuevo login se probó correctamente.

Para habilitar la segunda cuenta se añadió al Compose del laboratorio la imagen Mailpit v1.33.1 AMD64 fijada por digest. Mailpit está unido a la red aislada del laboratorio, sin relay/forward configurado; SMTP escucha solo dentro de Docker en `mailpit:25`, sin TLS ni autenticación, sin publicar el puerto SMTP. Su UI/API está publicada únicamente en `127.0.0.1:18025`. Los destinatarios están limitados a `@taskview-l01.invalid`. TaskView usa `emailjs@4.0.3`: `Email.ts` no pasa puerto, usuario ni contraseña; SSL/TLS solo se activa con `SMTP_ENCRYPTION=ssl|tls`. El cliente usa 25 por defecto, compatible con el listener interno de Mailpit. Esta combinación se validó con el correo de confirmación real de la segunda cuenta sintética. No se conectó SMTP externo.

La segunda cuenta se creó por `POST /module/auth/registration`. El mensaje se obtuvo de Mailpit local, se verificó que el destinatario fuera la dirección `.invalid` esperada, y el enlace/código se procesó en memoria contra el endpoint oficial local `GET /module/auth/confirm/email/:code/login/:login`. No se mostró ni guardó el código. La cuenta inició sesión correctamente. No se creó ningún proyecto o tarea; el registro solo generó el workspace personal previsto por TaskView.

### Resultados

| Control PF01 | Cuenta bootstrap reclamada | Cuenta sintética adicional |
|---|---:|---:|
| Login inicial | PASS — HTTP 200 | PASS — HTTP 200 después de registro y confirmación |
| Cambio/claim de credenciales | PASS — endpoint oficial HTTP 200 | No aplica |
| Sesión nueva accede a API protegida (`GET /module/goals`) | PASS — HTTP 200 | PASS — HTTP 200 |
| Logout (`POST /module/auth/logout`) | PASS — HTTP 204 | PASS — HTTP 204 |
| Token/sesión revocada rechazada al repetir GET protegido | PASS — HTTP 401 | PASS — HTTP 401 |
| Acceso sin autenticación (`GET /module/goals`) | PASS — HTTP 401 | PASS — HTTP 401 |
| Cuenta activa verificada read-only en DB sintética | PASS | PASS |

Resultado: **PF01 PASS** para login, cambio de credenciales bootstrap, autenticación ante API protegida, logout y revocación de sesión de ambas cuentas. Recuento read-only al cierre: exactamente dos cuentas activas que coinciden con los identificadores sintéticos de prueba.

### Aislamiento, cambios y riesgos

- Se modificó solo `docs/auditoria-taskview/entorno/compose.yaml` para agregar Mailpit fijado por digest y añadir `SMTP_HOST=mailpit`/remitente `.invalid` a la API del laboratorio. Se recreó únicamente el contenedor API bajo el proyecto `taskview-l01-b5a7e65`; DB y Web conservaron sus contenedores/volúmenes.
- Mailpit container `taskview-l01-b5a7e65-mailpit-1` está healthy. La publicación UI es loopback `127.0.0.1:18025`; puerto SMTP 25 no está publicado. Mailpit no tiene reenvío ni SMTP relay configurados y acepta solo destinatarios del dominio sintético. La configuración de red conserva `enable_ip_masquerade=false`; no se sondearon servicios externos.
- La UI Mailpit no tiene autenticación; cualquier proceso local que alcance `localhost:18025` puede inspeccionar mensajes de prueba. El buzón solo contiene correo sintético y el código de confirmación utilizado quedó consumido.
- La conexión SMTP de laboratorio es en texto plano y sin autenticación. El tráfico queda en la red bridge del laboratorio; no se usan credenciales SMTP. No es una configuración apropiada para correo real.
- Las contraseñas nuevas se conservan cifradas con DPAPI del perfil Windows actual, fuera del repo: `%TEMP%\taskview-l01-private\synthetic-accounts.json`. No se copiaron secretos ni tokens a informes.
- Los logs recientes de API/Mailpit se inspeccionaron en memoria sin emitirlos y no se encontraron passwords sintéticos, JWT con forma reconocible ni URL de confirmación. La API respondió al endpoint de opciones y se mantuvo running con restart count 0.
- Se volvió a comparar la instalación original: API `aa6cc8…`, Web `1c1338…`, DB `b6d4f6…` conservan exactamente sus image IDs, estado `running` y StartedAt del inventario previo. Sus endpoints web/API respondían 200 en la verificación anterior; no se les enviaron operaciones de autenticación ni datos.

No se ejecutaron migraciones, PF02–PF12, pruebas E2E, backup ni restore. No se modificó el código de aplicación, el esquema, el lockfile ni se inició Lista 02. El laboratorio está listo para reanudar **PF02–PF12 únicamente** en una actividad posterior.
## Pruebas funcionales PF02–PF12 autenticadas — 2026-11-14

Esta actualización posterior prevalece sobre los estados BLOCKED anteriores de PF02–PF12. Se reutilizaron las dos cuentas sintéticas activas ya documentadas. Las solicitudes se enviaron solo a `http://localhost:11725`; el frontend local `http://localhost:18888` y el endpoint de opciones de autenticación respondieron HTTP 200. La API declara `DB_HOST=db`, `DB_NAME=taskview_l01`, `DB_USER=taskview_l01`; PostgreSQL confirma la misma base/usuario y monta exclusivamente `taskview-l01-b5a7e65_pgdata`. El proyecto Compose fue `taskview-l01-b5a7e65`.

Se confirmó red aislada `taskview-l01-b5a7e65_default` con `enable_ip_masquerade=false`, volúmenes exclusivos `taskview-l01-b5a7e65_pgdata`, `_files` y `_logs`, almacenamiento de archivos `local`, URL de aplicación apuntando al puerto 18888 y SMTP exclusivamente a Mailpit (`mailpit`, puerto interno 25). No se configuró GitLab institucional ni se realizaron solicitudes a servicios externos. Los tokens y contraseñas se mantuvieron en memoria; no se guardaron cuerpos de autenticación ni salidas crudas.

### Matriz de resultados

| Prueba | Estado | Evidencia sintética y resultado |
|---|---|---|
| PF02 — Proyectos | PASS | Proyecto sintético ID 3 creado por `POST /module/goals`, consultado por `GET /module/goals`, actualizado por `PATCH /module/goals` y releído con nombre y descripción modificados. Proyecto auxiliar ID 4 quedó disponible para permisos entre proyectos. |
| PF03 — Tareas | PASS | Creación y actualización por `/module/tasks`; nombre funcional se representa en `description` (el modelo no tiene campo separado `name`). Se verificaron descripción, prioridad y estimación por relectura; asignación al segundo usuario sintético por `PATCH /module/tasks/task-users`; completar y reabrir quedaron confirmados por GET (`complete=true` y luego `false`). |
| PF04 — Subtareas y jerarquía | PASS | Se crearon tarea raíz, hija y nieta; GET conservó `parentId`. La referencia circular y la creación con padre de otro proyecto fueron rechazadas. El endpoint existente `GET /:taskId/move-preview?targetGoalId=4` permitió un movimiento válido; `POST /module/tasks/move` lo ejecutó y el GET posterior confirmó el proyecto destino. |
| PF05 — Kanban | PASS | Se consultaron estados TODO/In Progress/Done; una tarjeta cambió de columna por `PATCH /module/kanban/update-tasks-order-and-column` y el GET de la tarea confirmó `statusId`. Dos tareas sintéticas se reordenaron; `/module/kanban/tasks-order/3/7/null` pasó de `[17,16,15,14]` a `[16,17,15,14]` tras solicitar que 16 precediera a 17. |
| PF06 — Sprints | PASS | Sprint sintético ID 1 creado; GET confirmó fechas 2026-12-01/14, objetivo sintético y capacidad 16.00. Tarea con estimación 5 asignada y encontrada en `scope=sprint`. Activación, retrospectiva, Review y cierre respondieron 200; GET final mostró estado `completed`. Las operaciones usaron el ciclo existente, sin cambiar reglas. |
| PF07 — Roles múltiples | PASS | Se distinguieron IDs de colaboración consultando `/module/collaboration/3`; no se intercambiaron con IDs de autenticación. Se crearon roles sintéticos 9 y 10, se asignaron permisos de ver prioridad y editar descripción, y ambos roles se asignaron al colaborador sintético. La edición combinada fue 200. Tras retirar el rol editor, la misma edición fue 403 y el usuario conservó solo el rol 9. |
| PF08 — Permisos entre proyectos | PASS | La segunda cuenta, colaboradora solo en proyecto 3, recibió 403 al leer/editar una tarea de proyecto 4, editar el proyecto 4, consultar su sprint y listar sus archivos. GET posterior con propietario confirmó que la tarea seguía con su descripción original; el proyecto conservó el nombre sintético consultado (`L01-PF08-20261114-123058`). |
| PF09 — Adjuntos | PASS | Se subió un archivo ficticio de 38 bytes asociado a tarea de proyecto 3. Apareció en la lista de tarea, se consultaron sus metadatos y se descargó por URL de vida corta mantenida solo en memoria. SHA-256 de carga y descarga coincidió. La cuenta sin permiso de archivo recibió 403. El API monta el volumen local `_files`. |
| PF10 — Historial | PASS | Tras cambiar descripción y prioridad de una tarea sintética, `GET /module/tasks/:taskId/history` devolvió 200 y un registro con las versiones previa y posterior; GET de la tarea confirmó la versión actual. No se probaron restauraciones. |
| PF11 — Sprint Review y retrospectiva | PASS | En el sprint sintético se guardaron `wentWell`, `wentBad` y `actionItems`; la relectura de detalle confirmó persistencia de los tres campos. Se completó el flujo existente de Review y cierre. No hay campos estructurados de QA/DoD en el alcance actual. |
| PF12 — Reportes y analítica | PASS | Burndown y velocidad respondieron 200. Burndown devolvió total 5 y 14 puntos diarios; la tarea de estimación 5 seguía incompleta y permanecía en 5, mientras la línea ideal decrecía. Velocidad devolvió planned 5 / accepted 0; es coherente con la regla de `SprintsRepository` que solo acepta como completada una tarea cuyo `complete=true`, y clasifica como incomplete la decisión `accepted` enviada para una tarea reabierta. Analytics produjo 18 secciones y `failedSectionIds` vacío; los datos sintéticos mostraron 15 tareas creadas, 0 completadas y distribución 10 sin estado, 4 TODO, 1 In Progress. |

La velocidad expone las propiedades `acceptedHours`/`plannedHours` aunque el proyecto sintético utiliza unidad `points`. El cálculo conserva el valor numérico, sin conversión; revisar las etiquetas/unidades antes de interpretar informes institucionales. Esta limitación queda registrada, no se modificó ninguna fórmula.

### Trazabilidad de rutas inspeccionadas

- Proyectos: `api/src/tv-modules/goals/GoalsRoutes.ts`, `GoalsController.ts`, `types.ts`.
- Tareas, jerarquía e historial: `api/src/tv-modules/tasks/TasksRoutes.ts`, `TasksController.ts`, `tasks.server.types.ts`, `task-move.types.ts`, `TaskMovePlanner.ts`.
- Kanban: `api/src/tv-modules/kanban/KanbanRoutes.ts`, `KanbanController.ts`, `types.ts`.
- Sprints, ciclo, Review, retro, burndown y velocidad: `api/src/tv-modules/sprints/SprintsRoutes.ts`, `SprintsController.ts`, `SprintsManager.ts`, `SprintsRepository.ts`, `types.ts`.
- Roles y colaboración: `api/src/tv-modules/collaboration/CollaborationRoutes.ts`, `CollaborationController.ts`, `CollaborationManager.ts`, `collaboration.server.types.ts`, `api/src/tv-modules/collaboration-roles/CollaborationRolesRoutes.ts` y `CollaborationRolesManager.ts`.
- Archivos: `api/src/tv-modules/files/FilesRoutes.ts`, `FilesController.ts`, `FilesManager.ts`, `types.ts`.
- Analytics: `api/src/tv-modules/analytics/AnalyticsRoutes.ts`, `AnalyticsController.ts`, `types.ts`.

### Integridad y alcance

Al cierre, los contenedores originales conservaron exactamente IDs, image IDs, estado y StartedAt registrados previamente: API `aa6cc8…` / `sha256:bf154c…`, Web `1c1338…` / `sha256:75a207…`, PostgreSQL `b6d4f6…` / `sha256:846a7d…`; los tres siguen `running`. El laboratorio también permanece activo con API `69b037…`, Web `5dac76…`, DB `455ab9…`, Mailpit `92185b…`; el único volumen PostgreSQL del servicio es el prefijado por el proyecto de laboratorio. HTTP web y API del laboratorio respondieron 200 en smoke checks. No se ejecutaron migraciones, cambios de esquema, backup/restore, pruebas E2E, commit/push/merge ni Lista 02. Los datos y roles sintéticos quedan en el laboratorio para inspección posterior; no se borraron.

PF02–PF12 quedan PASS en las operaciones funcionales descritas. PF01 sigue PASS según la actualización anterior. Quedan pendientes para cerrar Lista 01: suites unitarias/integración aislables, ensayo sintético de backup/restauración y verificaciones de seguridad no cubiertas por estos casos; permanece la deuda de lint ya documentada (18 errores API y 48 web). El laboratorio está listo para que una actividad separada realice exclusivamente backup/restauración sintéticos. No se hizo esa actividad aquí.
## Ensayo de respaldo/restauración sintética BR01–BR08 — 2026-11-14

Esta sección posterior complementa PF01–PF12 y conserva todos los resultados previos. Solo se usaron los servicios sintéticos del proyecto Compose `taskview-l01-b5a7e65`. Se verificó por etiquetas el DB origen `taskview-l01-b5a7e65-db-1`, servicio `db`, volumen exclusivo `taskview-l01-b5a7e65_pgdata`, base/usuario `taskview_l01`, PostgreSQL 17.12 y versión de esquema 1.74.0. Los contenedores originales no fueron usados como origen, destino ni herramienta de restauración.

### Estado antes y manifiesto

La consulta sintética anterior al respaldo confirmó: dos usuarios ficticios en autenticación y colaboración; proyectos 3 y 4; 18 tareas, 2 subtareas; sprint 1 `completed`, 1 outcome, 1 retrospectiva; roles 9 y 10 con 1 asignación de usuario y 2 relaciones de permisos; 20 registros de historial; 367 objetos y 21 triggers. No había padres huérfanos ni relaciones padre-hijo entre proyectos. El manifiesto privado con IDs, mapas relacionales, conteos y hashes está en `%TEMP%\taskview-l01-recovery-20261114\artifacts\verification-manifest.json` (no versionado; sin secretos).

El adjunto sintético ID `00cf6093-5393-4f04-befc-d040b6157738` estaba relacionado a tarea 8/proyecto 3; 38 bytes, proveedor `local`, clave relativa `3/<uuid>`. SHA-256 de volumen y metadata PostgreSQL: `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`.

### Matriz BR

| Prueba | Estado | Evidencia / observaciones |
|---|---|---|
| BR01 — Integridad del dump | PASS | `pg_dump -Fc`, PostgreSQL 17.12; archivo `taskview-l01-taskview_l01-20261114.dump`, 331,854 bytes, SHA-256 `14ce4ce875af38229f06f9280bdd9e3ee618846a46319779264b327469550578`; `pg_restore --list` lo leyó antes y después de copiar (787 líneas). Salidas 0. |
| BR02 — Esquema | PASS | Origen y destino reportan `app.version=1.74.0`; 367 objetos y 21 triggers no internos en cada uno. Restauración sin migrador. |
| BR03 — Datos | PASS | Igualdad origen/destino: 2 cuentas sintéticas en `tv_auth.users`, 2 en colaboración, proyectos 3/4, 18 tareas, 2 subtareas, sprint 1, outcome/retro, 2 roles, historial 20 y archivo 1. |
| BR04 — Relaciones | PASS | Mapas de tareas padre-hijo, proyecto, sprint, outcome y archivo-tarea coinciden; 0 padres huérfanos y 0 padres de otro proyecto. |
| BR05 — Roles | PASS | Mismos roles 9/10, asignación role-user `9:2`, permisos `9:31`/`10:22` y relaciones de usuarios a proyecto. Se conservaron permisos de aplicación como datos; no se preservaron propietarios/grants PostgreSQL por `--no-owner --no-acl`. |
| BR06 — Adjuntos | PASS | Un archivo, 38 bytes; volumen recuperado separado. Hash calculado en destino coincide con el origen y con `tv_files.files.checksum_sha256`; vínculo a tarea 8/proyecto 3 restaurado. |
| BR07 — Lectura funcional por API | BLOCKED | No se inició API de recuperación: la API normal inicia PgBoss (`api/src/core/JobQueue.ts`, `api/src/core/all-events.ts`) y no hay modo read-only verificado. Evité posibles escrituras de jobs. SQL valida la persistencia, pero no se cuenta como lectura funcional de TaskView. |
| BR08 — Integridad de origen | PASS | DB activa siguió 1.74.0 con mismos conteos; el hash del adjunto activo no cambió. API/DB/Web/Mailpit del laboratorio están running. Los tres contenedores originales conservan exactamente IDs, image IDs, StartedAt y estado; `taskview_pgdata`, `taskview_default` y bind mounts originales no se usaron. |

### Secuencia ejecutada y destino de recuperación

El API del laboratorio se detuvo brevemente para cerrar una ventana sin escrituras; DB permaneció running/healthy y no se alteraron filas durante el respaldo. Se copiaron los archivos con `docker cp` a `%TEMP%\taskview-l01-recovery-20261114\artifacts` (carpeta con ACL restringida al usuario actual) y el dump se creó dentro del contenedor DB con `pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/<dump>`. No se usó redirección binaria de PowerShell. `pg_restore --list` pasó. El API de origen se volvió a iniciar; mismo ID de contenedor y restart count 0.

La configuración nueva [entorno/recovery.compose.yaml](entorno/recovery.compose.yaml) creó bajo el mismo proyecto `recovery-db`, en red `internal=true` exclusiva sin publicación de puertos, volumen de datos `taskview-l01-b5a7e65_recovery_20261114_pgdata` y volumen de archivos `taskview-l01-b5a7e65_recovery_20261114_files`. Antes de restaurar, se confirmó por etiquetas `service=recovery-db`, base/usuario sintéticos `taskview_l01_recovery`, solo la red/volúmenes esperados y cero objetos de usuario. `pg_restore` finalizó con código 0 usando `--exit-on-error --single-transaction --no-owner --no-acl`; no se usó `--clean`. El esquema owner/ACL de PostgreSQL no es una réplica fiel, pero los permisos y roles de TaskView como filas sí coinciden.

El contenedor recovery-db permanece healthy/running para inspección, sin puertos publicados y conectado solo a su red interna. Los volúmenes de recuperación se conservan. El laboratorio principal se restauró a su estado de servicio; no se detuvo ni reinició ningún contenedor original.

**Conclusión:** respaldo y restauración están validados para la base y los adjuntos sintéticos en sus volúmenes separados. La comprobación funcional por API sigue `BLOCKED`; por ello no se afirma recuperación de aplicación completa. No se ejecutaron migraciones, suites E2E, backup/restauración de datos reales, commits ni Lista 02.
# Actualización más reciente — suites unitarias e integración Lista 01 — 2026-11-14

Esta sección prevalece sobre los estados históricos `NOT RUN` de suites. El inventario, las rutas, los comandos y la evaluación de riesgos están en [11 — Pruebas unitarias e integración](11-pruebas-unitarias-integracion.md).

| Área | Suites descubiertas | Ejecutadas/PASS | Tests PASS | Tests FAIL | BLOCKED |
|---|---:|---:|---:|---:|---:|
| API | 64 | 40/40 | 367 | 0 | 24 |
| Paquetes compartidos (SDK + MCP) | 82 | 14/14 | 145 | 0 | 68 |
| Frontend unitario | 0 | 0 | 0 | 0 | 0 |
| Integración PostgreSQL (subconjunto de API/SDK) | 79 | 0 | 0 | 0 | 79 |
| E2E Playwright | 8 | 0 | 0 | 0 | 8 |

Total sin duplicar el subconjunto PostgreSQL: **154 suites**, **54 ejecutadas/PASS**, **0 fallidas**, **100 BLOCKED**; **512 tests ejecutados/PASS**, **0 FAIL**. La API pasó con configuración exclusiva `api/vitest.lista01.config.ts` y DB de guardia `127.0.0.1:1`; MCP pasó sin variables de conexión. Duraciones finales Vitest: API 2.47 s, MCP 1.45 s. No se midió cobertura ni se infiere cobertura completa de ningún módulo.

Las 56 suites SDK están bloqueadas porque su `globalSetup` trunca tablas y `.env.for-test` apunta al puerto 15432 de la base activa. Otras 23 suites API requieren PostgreSQL y una requiere S3; 12 MCP requieren API real. Playwright tiene puertos/credenciales heredados, `reuseExistingServer` y helpers con API fija a 1401; se bloqueó hasta aislar todos los destinos y datos. No se ejecutaron suites con escrituras sobre `taskview_l01` ni sobre `taskview_l01_recovery`. No hubo fallos de test, excepciones ni dependencias faltantes en lo ejecutado; Vite emitió solo advertencia de API CJS deprecada.

Integridad posterior: contenedores originales con mismos IDs/image IDs/StartedAt y `running`; laboratorio API/Web/DB/Mailpit activo y recovery-db healthy sin puerto publicado. Conteos DB activa y recuperada `2 usuarios | 4 proyectos | 18 tareas | 1 archivo | 20 historial`, sin variación frente a BR08. Hash del adjunto activo y del lockfile sin cambio. Se conservan 18 errores lint API y 48 web. PF01–PF12 y BR01–BR06/BR08 siguen PASS; BR07 sigue BLOCKED sin nueva intervención. La Lista 01 permanece abierta por integración DB/E2E y seguridad restante.

