# 12 — Inventario de integración PostgreSQL, Lista 01

## Actualización más reciente — corrección acotada (2026-11-14)

**79 suites: 59 PASS, 0 FAIL, 20 BLOCKED.** Se ejecutaron tests en 60 suites, incluida `Files.integration.spec.ts`, cuya parte local aprobó 12 tests pero conserva 16 casos S3 sin ejecutar; por ello sigue BLOCKED. Total acumulado de integración PostgreSQL: **1048 tests PASS, 0 FAIL** (sin volver a sumar intentos fallidos anteriores ni los 512 unitarios de otra actividad).

La causa del fallo de `default-roles` fue **deriva del esquema scratch**, no una expectativa desactualizada ni un cambio intencional de autorización. La migración 1.48.0 declara `timetracking_can_log`; el `all-triggers.sql` vigente de 1.73.0 lo asigna a Editor y Executor, además de `view` y `manage_all` a Editor. `can-log-time-on-task.ts` exige `TIMETRACKING_CAN_LOG` para registrar tiempo, mientras `can-stop-timer.ts` permite `MANAGE_ALL` para detener. Antes de la corrección, la función activa de scratch contenía una sola aparición de `timetracking_can_log` (Executor), igual que `all-triggers.sql` 1.69.0. Una suite API previa reaplicó ese script antiguo sobre scratch y sustituyó `tasks.add_roles_and_permissions()`; el valor de `app.version` siguió en 1.74.0 y por sí solo no detectó la deriva. El test aislado reprodujo 1 FAIL. Con identidad de clúster, base, rol y versión verificados, se restauró **solo esa función en scratch** desde la migración vigente de 1.73.0; la definición ahora contiene dos asignaciones. `default-roles.test.ts` pasó **2/2** (0.66 s). No se modificó el test, permisos productivos ni reglas de negocio.

Los cuatro tests API reejecutaban todas las SQL de 1.67.0, incluido `all-triggers.sql`, aun sobre una base ya migrada a 1.74.0. En modo exclusivo `L01_TEST_DB_ONLY=1`, sus fixtures omiten la reaplicación; el guard verifica antes la identidad física y las tablas `tv_files.files`, `tv_files.file_to_task`, `tasks.import_jobs` y la función vigente. La configuración usa almacenamiento local en `api/.test-data/lista01-pg-files`; no apunta a los adjuntos activos o recuperados. Resultados por archivo: `WebhooksFiles.integration.spec.ts` **1/1 PASS** (4.12 s); `Import.integration.spec.ts` **11/11 PASS** (3.70 s, proveedor de importación stub); `FilesQuota.integration.spec.ts` **7/7 PASS** (4.07 s); `Files.integration.spec.ts` **12 PASS/16 SKIP** (3.86 s, solo proveedor local). Sus ramas S3 y migración local↔S3 requieren un servicio S3 sintético y permanecen BLOCKED. Ningún script DDL de 1.67.0 se reaplicó durante estas cuatro corridas. Se observó una advertencia deprecada de `pg` sobre consultas concurrentes, sin fallo.

Clasificación técnica de las **19 SDK BLOCKED**, sin ejecutarlas en esta actividad:

| Dependencia | Suites | Posible preparación posterior |
|---|---|---|
| Receptor HTTP sintético | `webhooks`, `webhooks-sprints` | Servidor local unido solo a scratch; comprobar entregas reales. Un mock HTTP serviría para contrato de payload, pero no validaría entrega. |
| Receptor y sesión por código | `webhooks-permissions` | Receptor local y SMTP sintético o doble de entrega de códigos. |
| Sesión por código en setup | `start`, `start-token-scope`, `start-shared-projects`, `kanban-columns-order`, `auth-tokens`, `auth-sessions`, `account-deletion`, `collaboration-roles-token-scope` | Mock de envío y captura del código para pruebas de autorización; servicio SMTP sintético si se pretende validar el flujo de correo. |
| Correo de acceso o recuperación | `registration-flag`, `password-reset`, `password-change`, `login-code`, `login-case` | SMTP sintético con buzón consultable para probar entrega y caducidad; un mock solo cubre la lógica HTTP. |
| Identidad SSO | `sso`, `sso-public-urls` | IdP ficticio y URLs públicas scratch; dobles de metadata/respuestas para pruebas de contrato, servicio local para redirecciones completas. |
| Pocket ID | `scim-pocket-id` | Proveedor ficticio o mock de su cliente HTTP; servicio local si se verifican callbacks. |

Typecheck de API y SDK (`tsc --noEmit`) PASS. Guardia negativa API con puerto activo `15432` canceló en `globalSetup` (`DB_PORT mismatch`, 0 tests). Al cierre, scratch conserva versión 1.74.0 y la función vigente; bases activa y recuperada mantienen conteos `2|2|18|1|20` de datos L01 y ambos adjuntos SHA-256 `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`. Los contenedores originales mantienen IDs, image IDs y `StartedAt`; el lockfile conserva SHA-256 `2D0FA9B63C3438A1A707AD12D7D00509F97BAD96F5FBDE94A3959D74844BE494`.

El directorio local exclusivo `api/.test-data/lista01-pg-files` conserva un archivo sintético generado por importación. No se confundió con los volúmenes de adjuntos activo o recuperado ni se limpió automáticamente; puede inspeccionarse en una reproducción futura.

La corrección del scratch se puede reproducir con `api/vitest.lista01.pg.restore-default-role.mjs` después de establecer las cuatro variables DB fijas y `L01_TEST_DB_ENV_FILE` al archivo privado temporal. El script falla cerrado si cambia la identidad y aplica una sola función dentro de una transacción. El riesgo pendiente es que otras suites vuelvan a aplicar `all-triggers.sql` antiguo; esta actividad no las repitió. La suite de archivos no queda íntegramente verificada hasta disponer de S3 sintético. Lista 01 sigue abierta.

Inventario base de la ejecución anterior: **23 API y 56 SDK**. Sus resultados históricos de entonces fueron 55 PASS, 1 FAIL y 23 BLOCKED; prevalece la actualización anterior. Un test de `graph` fue omitido por la propia suite. Dos suites SDK bloqueadas llegaron al setup y omitieron sus 31 tests.

## Lectura de riesgos y clasificación

Todas las suites SDK comparten `setup-db.ts`: antes y después de cada archivo ejecuta DELETE y TRUNCATE CASCADE sobre `tv_auth.api_tokens`, `tv_auth.user_tokens`, `history.tasks_tasks`, `collaboration.users` y `tasks.goals`; recrea organizaciones personales. Por ello la clasificación de cada fila incluye **limpieza destructiva**, aunque la ruta pruebe solo lectura. El guard `vitest.lista01.pg.setup.ts` valida host, puerto, nombre, rol, versión e identificador físico del clúster *antes* de invocar ese setup. El SDK escribe mediante HTTP en la API scratch y mediante PG directo para el setup. Las rutas de prueba expresan el objetivo y el esquema principal; sus servicios y triggers pueden tocar otros esquemas. Los esquemas de la tabla son orientación por módulo, no una traza SQL exhaustiva.

Las suites API usan fixtures con INSERT/UPDATE/DELETE y limpieza `afterAll` en la misma DB. Algunas reaplican scripts de migración con DDL; `Automations`, `TokenScope`, `OAuth` y `ScimEmailChange` lo hicieron en scratch en la ejecución anterior. Las cuatro suites de archivos/importación incluían `all-triggers.sql` de 1.67.0, que elimina y recrea triggers/funciones de una versión anterior; ahora lo omiten exclusivamente en modo scratch, después de validar esquema actual. Transacciones aparecen explícitamente en `FilesQuota`; los scripts de migración y el setup pueden activar los 21 triggers de la base. Ninguna fila usa las bases `taskview_l01`, `taskview_l01_recovery` ni el PostgreSQL original.

## API: 23 suites

| Archivo | Objetivo | Esquemas y operaciones principales | Resultado/clase |
|---|---|---|---|
| `api/src/tv-modules/auth/__tests__/Auth.spec.ts` | Autenticación HTTP | tv_auth, usuarios; INSERT/DELETE y sesiones | PASS 23 |
| `api/src/tv-modules/auth/__tests__/AuthModel.spec.ts` | Modelo de usuarios | tv_auth; INSERT/SELECT/DELETE | PASS 13 |
| `api/src/tv-modules/auth/__tests__/JwtStorage.spec.ts` | Sesiones JWT | tv_auth; INSERT/SELECT/DELETE | PASS 4 |
| `api/src/tv-modules/auth/__tests__/LoginByProvider.spec.ts` | Login por proveedor | tv_auth; INSERT/SELECT/DELETE | PASS 2 |
| `api/src/tv-modules/automations/__tests__/Automations.integration.spec.ts` | Automatizaciones | tasks, automations; DML y reaplica DDL 1.69.0 con advisory lock | PASS 20 |
| `api/src/tv-modules/files/__tests__/Files.integration.spec.ts` | Adjuntos locales y S3 | files; DML; DDL heredado omitido en scratch | BLOCKED parcial: 12 PASS/16 SKIP (S3) |
| `api/src/tv-modules/files/__tests__/FilesQuota.integration.spec.ts` | Cuotas de archivos | files; transacciones; DDL heredado omitido en scratch | PASS 7 |
| `api/src/tv-modules/import/__tests__/Import.integration.spec.ts` | Importación | tasks/files; DML; DDL heredado omitido en scratch | PASS 11 |
| `api/src/tv-modules/integrations/__tests__/IntegrationsOAuth.integration.spec.ts` | OAuth de integraciones | integrations/tv_auth; DML | PASS 11 |
| `api/src/tv-modules/integrations/__tests__/IntegrationsPermissions.integration.spec.ts` | Permisos de integraciones | integrations/collaboration; DML | PASS 18 |
| `api/src/tv-modules/integrations/__tests__/IntegrationsSync.integration.spec.ts` | Sincronización simulada | integrations/tasks; DML; HTTP nock | PASS 7 |
| `api/src/tv-modules/integrations/__tests__/IntegrationsWebhooks.integration.spec.ts` | Webhooks de integraciones | integrations; DML | PASS 18 |
| `api/src/tv-modules/invoices/__tests__/Invoices.integration.spec.ts` | Facturas | billing; DML | PASS 17 |
| `api/src/tv-modules/oauth/__tests__/OAuth.integration.spec.ts` | OAuth y clientes | tv_auth; DML y reaplica DDL 1.64.0 | PASS 59 |
| `api/src/tv-modules/oauth/__tests__/OAuthDcrDisabled.integration.spec.ts` | Registro de clientes desactivado | tv_auth; DML | PASS 4 |
| `api/src/tv-modules/organizations/__tests__/TokenScope.integration.spec.ts` | Alcance de token | organizations/tv_auth; DML y reaplica DDL 1.65.0 | PASS 11 |
| `api/src/tv-modules/realtime/__tests__/RealtimeRepository.integration.spec.ts` | Persistencia realtime | realtime; DML | PASS 2 |
| `api/src/tv-modules/scim/__tests__/ScimEmailChange.integration.spec.ts` | Cambio de correo SCIM | scim/tv_auth; DML y reaplica DDL 1.70.0 con advisory lock | PASS 2 |
| `api/src/tv-modules/sso/__tests__/SsoMetadataSync.integration.spec.ts` | Metadatos SSO | sso; DML; servidor HTTP efímero local | PASS 3 |
| `api/src/tv-modules/sso/__tests__/SsoSignInScim.integration.spec.ts` | Inicio SSO/SCIM | sso/scim/tv_auth; DML y dobles | PASS 9 |
| `api/src/tv-modules/tasks/__tests__/TaskMassAssignment.integration.spec.ts` | Asignación masiva | tasks/collaboration; DML | PASS 5 |
| `api/src/tv-modules/tasks/__tests__/TaskMove.integration.spec.ts` | Movimiento y jerarquía | tasks/time_tracking; DML | PASS 10 |
| `api/src/tv-modules/webhooks/__tests__/WebhooksFiles.integration.spec.ts` | Webhook de archivos | webhooks/files; DML; DDL heredado omitido en scratch | PASS 1 |

Los 22 PASS API son ejecutables con PostgreSQL aislado; `Files.integration.spec.ts` queda BLOCKED parcial por S3. `S3FileStorage.integration.spec.ts` queda fuera de estas 79 y tampoco se ejecutó.

## SDK: 56 suites

| Archivo | Objetivo | Esquemas/operaciones; limpieza común | Resultado/clase |
|---|---|---|---|
| `taskview-packages/taskview-api/src/api/__tests__/webhooks.test.ts` | webhooks | integrations/webhooks; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: receptor HTTP de webhook; servicio local pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/webhooks-sprints.test.ts` | webhooks sprints | tasks/sprints; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: receptor HTTP de sprint; servicio local pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/webhooks-permissions.test.ts` | webhooks permissions | collaboration, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: login por correo y receptor; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/ui-preferences.test.ts` | ui preferences | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/token-scope-organization.test.ts` | token scope organization | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/time-tracking.test.ts` | time tracking | tasks, history; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/tasks.test.ts` | tasks | tasks, history; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/tasks-cross-goal.test.ts` | tasks cross goal | tasks, history; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/tasks-complete-visibility.test.ts` | tasks complete visibility | tasks, history; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/tasks-access.test.ts` | tasks access | tasks, history; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/tags.test.ts` | tags | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/start.test.ts` | start | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: sesión por código; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/start-token-scope.test.ts` | start token scope | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: sesión por código; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/start-shared-projects.test.ts` | start shared projects | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: sesión por código; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/start-dashboard.test.ts` | start dashboard | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/start-calendar.test.ts` | start calendar | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/sso.test.ts` | sso | scim/sso, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: IdP externo simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/sso-public-urls.test.ts` | sso public urls | scim/sso, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: IdP/URL pública local pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/sprints.test.ts` | sprints | tasks/sprints; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/sprints-security.test.ts` | sprints security | tasks/sprints; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/sessions.test.ts` | sessions | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/scim.test.ts` | scim | scim/sso, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/scim-pocket-id.test.ts` | scim pocket id | scim/sso, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: Pocket ID externo simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/scim-group-projects.test.ts` | scim group projects | scim/sso, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/registration-flag.test.ts` | registration flag | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: registro/código por correo; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/recurrence.test.ts` | recurrence | tasks, history; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/recurrence-after-completion.test.ts` | recurrence after completion | tasks, history; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/permissions.test.ts` | permissions | collaboration, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/password-reset.test.ts` | password reset | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: correo de recuperación; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/password-change.test.ts` | password change | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: correo de confirmación; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/organizations.test.ts` | organizations | organizations; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/notifications.test.ts` | notifications | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/login-code.test.ts` | login code | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: correo de acceso; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/login-case.test.ts` | login case | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: correo de acceso; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/kanban.test.ts` | kanban | tasks/kanban; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/kanban.access.test.ts` | kanban.access | tasks/kanban; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/kanban-columns-order.test.ts` | kanban columns order | tasks/kanban; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: setup envía login-code; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/integrations-access.test.ts` | integrations access | integrations/webhooks; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/guard-param-confusion.test.ts` | guard param confusion | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/graph.test.ts` | graph | tasks/goals; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/graph-access.test.ts` | graph access | tasks/goals; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/goals.test.ts` | goals | tasks/goals; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/goals-list.test.ts` | goals list | tasks/goals; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/automations.test.ts` | automations | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/automations.access.test.ts` | automations.access | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/auth-tokens.test.ts` | auth tokens | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: sesión por código; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/auth-sessions.test.ts` | auth sessions | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: sesión por código; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/api-tokens.test.ts` | api tokens | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/analytics.access.test.ts` | analytics.access | esquemas de ruta API; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/account-deletion.test.ts` | account deletion | tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: sesión/correo; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/billing-invoices.test.ts` | billing invoices | billing; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/collaboration-goal-access.test.ts` | collaboration goal access | collaboration, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/collaboration-roles-token-scope.test.ts` | collaboration roles token scope | collaboration, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | BLOCKED: setup envía login-code; SMTP simulado pendiente |
| `taskview-packages/taskview-api/src/api/__tests__/collaboration.test.ts` | collaboration | collaboration, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/collaboration-roles.access.test.ts` | collaboration roles.access | collaboration, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS |
| `taskview-packages/taskview-api/src/api/__tests__/default-roles.test.ts` | default roles | collaboration, tv_auth; CRUD HTTP; setup DELETE/TRUNCATE CASCADE | PASS 2 tras restaurar función scratch vigente |

Los 37 PASS SDK son ejecutables con PostgreSQL aislado. El fallo previo de `default-roles` se debió a la función scratch reemplazada por una migración antigua; pasó tras restaurar la definición vigente. Las 19 BLOCKED requieren configuración adicional: SMTP o receptor HTTP sintético, IdP/Pocket ID simulado o setup de sesión. `collaboration-roles-token-scope` y `kanban-columns-order` se intentaron previamente; ambas quedaron bloqueadas en setup por ausencia de `send-login-code`, con 20 y 11 tests omitidos respectivamente.

## Ejecución y límites

Comandos (desde `api/` o `taskview-packages/taskview-api/`):

```powershell
# Variables DB_* fijas a 127.0.0.1:25432/taskview_l01_scratch_20261114,
# credenciales sintéticas leídas del archivo privado temporal y grupo allowlist.
node .\node_modules\vitest\vitest.mjs run --config vitest.lista01.pg.config.ts --reporter=default --silent
```

API usa `L01_PG_GROUP` y `L01_TEST_DB_ENV_FILE`; SDK usa `L01_SDK_PG_GROUP`, `L01_TEST_DB_ONLY=1` y `TASKVIEW_TEST_URL=http://127.0.0.1:21401`. Ambos guardias cancelan si no coincide el identificador físico de clúster `7708101047748980774`, además de versión `1.74.0`, nombre y rol. No se cargó `conf.private.ts` ni `.env.for-test`; el SDK sobrescribe su helper de credenciales solo al activar la marca scratch.

En la ejecución anterior: API 19 suites PASS, 238 tests PASS; SDK 36 suites PASS y 1 FAIL, 778 tests PASS y 1 FAIL. El total histórico fue 56 suites con tests, 55 PASS, 1 FAIL, 23 BLOCKED, 1016 tests PASS y 1 FAIL. **El estado actual está al inicio de este documento.** El resultado del test `recurrence-after-completion` fue transitoriamente 21/22 y pasó 22/22 en repetición exacta; queda como riesgo de intermitencia. `scim` y `scim-group-projects` requirieron tres dominios `.example` sintéticos en la API scratch y aprobaron al repetir. `token-scope-organization` requirió permitir URL privada en la API scratch para un destino reservado `.test`; aprobó 28/28, con red scratch sin salida hacia destinos externos. `TaskMove` requirió corregir dos timestamps inválidos de fixture; `Auth.spec` requirió ajustar el tiempo sintético de expiración y leer el estado HTTP correctamente. No se alteró lógica de negocio.

Duraciones Vitest finales registradas por grupo API (s): auth_model 1.07, auth_session 0.79, realtime_repo 0.79, task_assignment 5.20, task_move 4.36, token_scope 3.64, automation 4.74, auth_http 8.57, auth_provider 0.97, integrations_permissions 3.75, integrations_sync 4.02, integrations_webhooks 3.63, integrations_oauth 3.60, oauth_dcr_disabled 3.35, invoices 3.82, sso_metadata 3.47, sso_scim 1.45, oauth 4.27 y scim_email 0.91. SDK registrado (s): sprints 1.80, tasks 4.44, permissions 5.35, tasks_access 0.74, tasks_visibility 0.71, sprints_security 0.85, kanban 0.73, collaboration 1.17, goals 0.74, time_tracking 5.28, organizations 1.40 y token-scope-organization final 1.30. Para otros grupos SDK se conservaron conteos/estado, pero no la duración individual en la evidencia de consola; no se inventa ni se repite la corrida solo para reconstruir tiempos.

Pruebas negativas de guardias: API con `DB_NAME=taskview_l01` y grupo `auth_model` canceló en `globalSetup` con `Scratch guard: DB_NAME mismatch`; SDK con `DB_NAME=taskview_l01_recovery` y grupo `sprints` canceló con `SDK scratch guard: DB_NAME mismatch`. Ambas terminaron antes de ejecutar suites o tests (0/0), sin fixture ni limpieza. La comprobación de identidad del scratch final devolvió base, clúster y versión esperados; no se observaron conexiones de prueba a otras DB.

Los 512 tests unitarios aprobados anteriormente no se repitieron ni se suman al resultado PostgreSQL. No se midió cobertura. Un PASS por suite no implica cobertura completa del módulo. El S3 sintético y las dependencias SDK siguen pendientes antes del cierre de Lista 01.

