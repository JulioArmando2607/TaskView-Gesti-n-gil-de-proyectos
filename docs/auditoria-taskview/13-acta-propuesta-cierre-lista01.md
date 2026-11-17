# 13 — Acta de propuesta de cierre técnico de Lista 01

## Validación final de imagen API y runtime — 2026-11-14 (estado vigente)

**Propuesta técnica: OPCIÓN A — APTA PARA CIERRE DE LISTA 01. Decisión del responsable del proyecto: PENDIENTE.** La imagen API corregida `taskview-l01-api:authlog-20261114`, ID `sha256:5e4e6f07e92747b58aae3011dfa7f869c8c4b0e0b116a1965508a0dd7c303f50`, quedó activa únicamente en el contenedor API del laboratorio `a57f53795f8e…`; el original conserva su identidad. Bundle verificado SHA-256 `74ad848ef1dae1053a60b5bd3d4b1942512ebaec4a673cb00e8f65087a0e2233`. Compose efectivo confirmó DB sintética, Mailpit, archivos locales y puerto loopback antes del cambio. No hubo migraciones ni recreación de DB, web, Mailpit, scratch, recovery, BR07 u originales.

Runtime sintético: login válido **200**, inválido **400**, proyecto protegido **200** con dato `L01-*`, refresh **200**, logout **204**, token revocado **401**. Registros Pino nuevos: **6 líneas**, sin marcadores ni JWT y con diagnóstico seguro de refresh; salida del contenedor sin los patrones evaluados. Web contra la API corregida: login/refresh/logout **PASS**, 0 patrones sensibles en consola y 0 errores de página. [Informe y límites](07-informe-pruebas.md#validación-final-de-runtime-api--2026-11-14-estado-vigente). Se verificaron conteos de bases activa/recovery/BR07, identidad scratch, hashes de adjuntos, lockfile e identidad de originales. Las deudas de lint (18 API, 48 web) **no están aceptadas formalmente**.

Para Lista 02, cualquier ruta nueva debe probar permisos efectivos por proyecto, roles múltiples y scopes de sesión/token; antes de ampliar Kanban debe evaluarse concurrencia real. Suites SDK/S3/MCP/E2E se ejecutarán según el flujo afectado. El alcance de red de los puertos originales y la política de firewall requieren decisión operativa separada antes de despliegue/exposición; esta propuesta no autoriza cambiar la instalación original ni desplegar. El responsable debe decidir sobre el cierre y la deuda técnica; no se inicia Lista 02 con esta acta.

**Fecha de corte:** 2026-11-14 (America/Lima). **Estado:** propuesta técnica pendiente de decisión del responsable; Lista 01 no está cerrada y Lista 02 no comenzó.

## Actualización de seguridad AuthModel — 2026-11-14 (prevalece sobre R1 histórico)

**R1 corregido y verificado en fuente, pruebas e imagen API nueva del laboratorio.** `AuthModel` ya no registra filas completas, códigos ni excepciones; los logs relacionados de `AuthController`, correo y middleware se limitaron a operación/resultado. Pino incorpora redacción de campos estructurados. Nueva suite de logs en memoria **6/6 PASS**, con marcadores sintéticos ausentes; regresiones `AuthModel` **13/13** y API auth **23/23 PASS** sobre scratch con guardia, unitarias focales **8/8 PASS**, typecheck y build API PASS. Imagen `taskview-l01-api:authlog-20261114` verificada sin red; **la API activa del laboratorio no se sustituyó**, ni tampoco el original. [Detalle y rutas](12-seguridad-deuda-tecnica.md#corrección-de-seguridad-authmodel--2026-11-14), [resultados](07-informe-pruebas.md#corrección-de-seguridad-authmodel--2026-11-14-resultado-vigente).

**Recomendación técnica actual: OPCIÓN A — APTA PARA CIERRE DE LISTA 01**, condicionada a la revisión y aceptación expresa de deudas por el responsable; no equivale al cierre formal. Los hallazgos de puertos, scopes, concurrencia Kanban y suites no ejecutadas conservan controles por módulo o antes de despliegue. Las tablas inferiores que describen R1 como pendiente y recomiendan Opción B son historia previa a esta actualización.

## 1. Objetivo y alcance

Consolidar la evidencia de la auditoría de TaskView Community y separar condiciones para desarrollo sintético en laboratorio, cambios de módulos concretos y despliegue. Se priorizan las actualizaciones más recientes de [07](07-informe-pruebas.md), [08](08-recomendaciones-arquitectura.md), [09](09-resumen-ejecutivo.md), [12 — seguridad](12-seguridad-deuda-tecnica.md) y [12 — inventario PostgreSQL](12-inventario-postgresql.md) sobre estados históricos que figuran en esos mismos archivos. Esta acta no acepta deuda ni autoriza despliegue.

## 2. Línea base técnica y actividades completadas

| Elemento | Línea base comprobada |
|---|---|
| Código | Rama `chore/l01-auditoria-taskview`, HEAD `b5a7e6598d927fe2e8a5936150093390c31ed13c` (TaskView 1.58.2); cambios L01 aún sin commit. |
| Herramientas | Node 24.22.2 portable, pnpm 10.28.1, dependencias instaladas con lockfile congelado; `@eslint/js` 9.39.3 declarado después como dependencia directa web, sin versiones nuevas. |
| Arquitectura | Vue 3/Vite/Pinia, API Express/TypeScript, PostgreSQL 17/Drizzle y migraciones SQL propias; esquema del laboratorio 1.74.0. Ver [01](01-arquitectura-actual.md) y [03](03-modelo-datos-permisos.md). |
| Laboratorio | Compose `taskview-l01-b5a7e65`: web/API/DB/Mailpit sintéticos en loopback; scratch PostgreSQL separado; recovery y copia BR07 con red interna y volúmenes propios. [Procedimiento](04-entorno-desarrollo.md). |
| Integridad | Última comprobación registrada: original con IDs, imágenes y tiempos de inicio intactos; bases activa, recovery y BR07 con `2 usuarios | 4 proyectos totales | 18 tareas | 1 archivo | 20 entradas de historial`; hashes de adjuntos sintéticos coincidentes. `docker ps` en esta consolidación confirmó servicios en ejecución y bindings esperados; no se repitieron consultas ni hashes. |

Se completaron inventario funcional y de datos, laboratorio aislado, PF01–PF12, respaldo y restauración sintéticos BR01–BR08, pruebas unitarias y PostgreSQL compatibles, revisión de seguridad, regresión focal de autenticación y Kanban. No se midió cobertura porcentual. [Inventario funcional](02-inventario-funcional.md), [brechas](06-matriz-brechas-scrum.md), [respaldo](05-respaldo-versionamiento.md).

## 3. Matriz única de resultados

| Área | Resultado vigente | Alcance y límite |
|---|---|---|
| TypeScript API y web | PASS | Typecheck de ambos tras las correcciones. |
| Compilación API y web | PASS | Bundle API local y artefacto web; imagen web corregida desplegada solo en laboratorio. La imagen API activa del laboratorio no incorpora aún el cambio Kanban. |
| Lint API | FAIL: 18 errores | Además 11 warnings y 9 infos; detalle abajo. No invalida los typechecks/builds aprobados. |
| Lint web | FAIL: 48 errores | Errores de formato/estilo; la ejecución ya es reproducible con dependencia directa. |
| PF01–PF12 | 12/12 PASS | Cuenta y datos sintéticos; incluye autenticación, proyectos/tareas, jerarquía, Kanban, sprints, roles, aislamiento entre proyectos, archivos e historial. |
| BR01–BR08 | 8/8 PASS | BR07 comprobó contenido por API autenticada en una **copia desechable** del respaldo, no en la instancia recovery conservada. |
| Unitarias/API con dobles + MCP unitario | 54 suites completas PASS, 512 tests PASS, 0 FAIL | 40 suites API/367 tests y 14 MCP/145 tests. Sin suites unitarias Vue descubiertas. |
| Integración PostgreSQL | 79 suites identificadas; 59 PASS completas, 0 FAIL, 20 BLOCKED; 1048 tests PASS, 0 FAIL | En 60 suites hubo tests ejecutados. Una es `Files.integration.spec.ts`: 12 casos locales PASS y 16 S3 sin ejecutar; se cuenta **parcial/BLOCKED**, no PASS completo. Las otras 19 bloqueadas son SDK. |
| Seguridad y autenticación focal | PASS con alcance limitado | Login, refresh tras 401 y logout de cuenta sintética en la nueva imagen web; 0 patrones sensibles en consola del probe. No sustituye E2E ni prueba de todos los caminos de autenticación. |
| Kanban focal | 6/6 PASS después de corrección | Suite nueva con repositorio en memoria: movimiento interno, entre columnas, extremos, consecutivos y vecinos obsoletos invertidos. Antes: 5 PASS/1 FAIL por doble rebalanceo. No hubo carrera real entre procesos ni prueba PostgreSQL de esta corrección. |
| Roles, permisos y scopes | PF07/PF08/PF09 PASS; guard de token 5/5 PASS en regresión puntual | Dos roles y revocación, 403 entre proyectos/archivos; `api-tokens` y `token-scope-organization` SDK PASS. Sesión, colaboración y scopes `start*` siguen insuficientemente probados. |
| Otras suites pendientes | 1 S3 API, 12 MCP integración y 8 E2E sin ejecutar | Requieren destinos sintéticos y configuraciones adicionales. |

**Regla de cómputo:** el inventario inicial tiene 154 archivos de suite: 54 unitarias completas, 79 PostgreSQL y 21 restantes (1 S3 API, 12 MCP integración, 8 E2E). PostgreSQL es un subconjunto del inventario inicial, no una fila adicional que se sume a 154. Los **512** y **1048** tests PASS pertenecen a corridas distintas y no se duplican; las regresiones posteriores de 6 Kanban y 5 de guard de token se presentan aparte. Los reintentos históricos, el FAIL previo de `default-roles` y los 16 S3 omitidos no se suman como fallos actuales ni como PASS.

## 4. Correcciones aplicadas y verificadas

1. Frontend: retirados logs de token, refresh y objetos Axios potencialmente sensibles; guardias ante error sin `config`/`response`. Typecheck/build y login–refresh–logout PASS sobre imagen web nueva `taskview-l01-web:security-20261114`, usada solo por `web` del laboratorio. El original no se sustituyó.
2. Kanban: eliminada una rama redundante de rebalanceo; prueba que fallaba antes ahora da 6/6 PASS. El cambio reside en fuente y bundle API local, **sin desplegar** en la API activa del laboratorio ni en el original.
3. PostgreSQL scratch: restaurada solo en ese clúster la función vigente de permisos predeterminados 1.73.0 tras detectar que fixtures antiguos la sobrescribían; regresión `default-roles` 2/2 PASS. Fixtures de cuatro suites omiten DDL antiguo exclusivamente bajo guardia L01; no se alteró la política de permisos productiva.
4. Reproducibilidad: `@eslint/js` 9.39.3 pasó de transitiva a devDependency directa web; `pnpm-lock.yaml` añadió únicamente tres líneas al importador `web`, sin paquete ni versión nuevos. Dockerfiles normalizan finales de línea de scripts para construir imágenes del laboratorio. El migrador usa `Proxy.apply`; por inspección conserva texto, parámetros y orden SQL, sin migración adicional de esta actividad.

## 5. Riesgos abiertos y tratamiento obligatorio

| ID | Hallazgo y evidencia | Naturaleza / severidad | Puerta de control |
|---|---|---|---|
| R1 | Históricamente, `AuthModel.getUserByLogin` registraba `SELECT *` y dos handlers registraban códigos. | **Corregido en fuente y verificado** con marcadores sintéticos, 6 pruebas de logs y 36 pruebas PostgreSQL de auth; no se inspeccionaron logs antiguos ni se certifica la API activa sin desplegar la nueva imagen. | Mantener la lista de campos permitidos y la regresión de logs; para despliegue autorizado, usar la imagen corregida y comprobar runtime/logs sintéticos. |
| R2 | Original API/web publicados en `0.0.0.0` y `[::]` en 1725/8888; listeners Windows observados; perfiles Domain/Private/Public informaron desactivados. Consulta detallada de reglas fue denegada. | **Riesgo potencial alto de alcance de red**; acceso desde otra máquina no demostrado. | Infraestructura debe evaluar consumidores, alcance efectivo y mitigación aprobada antes de despliegue/exposición. Posibles controles: bind a loopback, proxy y firewall explícito. No modificar instalación original sin autorización. |
| R3 | Petición de orden Kanban sin versión esperada; `columnVersion` solo en respuesta. | Riesgo potencial medio de orden obsoleto bajo concurrencia real; el doble rebalanceo sí quedó corregido. | Antes de modificar orden/planificación concurrente: reproducir carrera sobre scratch, definir contrato de versión/conflicto y transacción si el requisito lo exige. |
| R4 | Scopes de sesión, colaboración y tokens API no cubiertos en todas las rutas; permisos vacíos de token significan acceso irrestricto según diseño actual. | Verificación pendiente, severidad media para nuevas rutas. | Antes de cada ruta Scrum: autorización servidor por proyecto, rol efectivo y scope de token; casos de propietario, rol limitado, dos roles, proyecto ajeno y token limitado; respuesta 403/404 sin escritura. [Matriz detallada](12-seguridad-deuda-tecnica.md#t05--matriz-de-permisos-existentes-para-pruebas-futuras). |
| R5 | Migrador incluye `pg_terminate_backend` limitado por `DB_NAME`; logging de SQL lento podría contener literales. | Riesgo potencial alto si se apunta a destino equivocado. | Guardia de identidad física, revisión de SQL y autorización operativa antes de **cualquier** migración futura; nunca reutilizar bases protegidas para ensayos. |
| R6 | Lab/API y scratch permiten egreso ordinario limitado por bridge sin masquerading; Mailpit local no tiene autenticación propia. | Riesgo potencial medio/bajo según uso. | Conservar datos y correo sintéticos; no tratar la opción de red como firewall completo ni habilitar proveedores reales sin control de egreso. |

La corrección de logs del navegador y R1 son rutas distintas, ambas corregidas en fuente. La verificación anterior de patrones en las últimas líneas de logs fue acotada y no acredita la ausencia de datos sensibles en artefactos históricos. La imagen API corregida aún no sustituye el contenedor activo.

## 6. Deudas propuestas para aceptación, con condiciones

| Pendiente | Tratamiento propuesto | ¿Impide comenzar desarrollo sintético en laboratorio? |
|---|---|---|
| 18 errores lint API | 9 imports/variables sin uso: revisar al editar cada archivo. 5 callbacks/thenable: 2 en producción (`GoalPermissionsFetcher`, `all-events`) requieren regresión puntual al cambiar permisos/eventos; 3 en fixtures. 3 regex de control de Jira DC: justificar y probar al modificar importación. 1 asignación en expresión Kanban: claridad, distinta del rebalanceo corregido. No hay fallo funcional demostrado por esos diagnósticos. | No por sí solos; el gate lint completo sigue FAIL y exige aceptación explícita o plan de corrección antes de CI estricto. |
| 48 errores lint web | Formato, indentación, atributos y comas en siete archivos; corregir por archivo al editar la vista con verificación local, sin autofix masivo. | No por sí solos; gate lint completo sigue FAIL. |
| 19 SDK PostgreSQL bloqueadas | 8 sesión por código, 5 correo, 2 receptor HTTP, 1 receptor+sesión, 2 SSO y 1 Pocket ID. Proveer solo dobles/servicios sintéticos cuando el flujo entre en alcance. Priorizar `start*`, `kanban-columns-order` y `collaboration-roles-token-scope` antes de cambiar esas rutas. | No para módulos no relacionados; sí como gate del flujo afectado. |
| Files parcial: 16 casos S3 y suite S3 separada | Almacenamiento local sí tiene PF09, BR07 y 12 casos Files. Probar S3 con servicio sintético antes de habilitar S3 o migración local↔S3. | No si se declara alcance local sin S3. |
| 12 MCP integración | Requieren API/DB scratch, token sintético y guardia de URL/cluster. | No si MCP queda fuera del alcance; sí antes de ofrecer MCP como interfaz para rutas nuevas. |
| 8 E2E | `auth`, `projects`, `project-dashboard`, `calendar`, `task-date-picker`, `subtasks-duplication`, `inbox`, `sso-oidc`; puertos, fixtures y reutilización heredados impiden ejecución segura actual. Priorizar flujos de pantallas que se modifiquen, con URLs y limpieza exclusivamente scratch. | No para diseño en laboratorio; sí como verificación antes de afirmar completitud de cambios de UI relacionados. |
| Concurrencia Kanban real | Prueba entre procesos/transacciones y decisión de contrato aún pendientes. | No para trabajo ajeno al orden Kanban; sí antes de prometer movimientos concurrentes fiables. |

La aceptación de estas deudas corresponde al responsable. R1 se corrigió y no se propone como deuda aceptable. Ningún PASS parcial equivale a cobertura total de módulo.

## 7. Restricciones para desarrollo futuro y despliegue

**Laboratorio / eventual Lista 02, solo después de decisión formal:** conservar destinos scratch y guardias; datos sintéticos; validar permisos y scopes de toda ruta nueva; regresiones de tareas, jerarquía, sprints, Kanban y UI según módulo tocado; no reutilizar `conf.private.ts`, bases activa/recovery ni cuentas institucionales. La matriz de endpoints/permisos existente está en [12 — seguridad](12-seguridad-deuda-tecnica.md#t05--matriz-de-permisos-existentes-para-pruebas-futuras). No se crearon roles, scopes o endpoints Scrum en Lista 01.

**Despliegue / exposición:** desarrollo autorizado en laboratorio no implica autorización de producción ni acceso LAN. R1 está corregido en imagen nueva **no desplegada**; el overlay reutiliza la imagen base del laboratorio y no sustituye un build limpio de despliegue. Cualquier uso con usuarios reales exige construir/desplegar mediante proceso autorizado y comprobar logs/función con datos sintéticos. R2 requiere decisión de infraestructura sobre publicación, firewall y consumidores; migraciones exigen guardia de destino y aprobación; S3/MCP/SSO/GitLab requieren pruebas y autorizaciones independientes si se habilitan. La API Kanban corregida también está en la imagen nueva, no en el contenedor activo.

## 8. Relación exacta de cambios pendientes de revisión/versionamiento

`git status --short` y `git ls-files --others --exclude-standard` del corte actual muestran **24 archivos rastreados modificados** y los archivos nuevos siguientes. `git diff --check` pasa. No se ejecutó commit, push ni merge.

| Grupo | Archivos rastreados modificados | Motivo de revisión |
|---|---|---|
| API y Docker | `api/postgresql/dockerfile`; `api/src/core/Email.ts`; `api/src/middlewares/app-user-middleware.ts`; `api/src/migrations/migrate.ts`; `api/src/modules/logget.ts`; `api/src/tv-modules/auth/AuthController.ts`; `api/src/tv-modules/auth/AuthModel.ts`; `api/src/tv-modules/collaboration/CollaborationManager.ts`; `api/src/tv-modules/kanban/KanbanManager.ts`; `api/src/tv-modules/recurrence/RecurrenceGenerator.ts`; `api/src/utils/api.ts` | Entrypoint CRLF, migrador, saneamiento R1, tipo, rebalanceo y logging. |
| Fixtures API | `api/src/tv-modules/auth/__tests__/Auth.spec.ts`; `api/src/tv-modules/files/__tests__/Files.integration.spec.ts`; `api/src/tv-modules/files/__tests__/FilesQuota.integration.spec.ts`; `api/src/tv-modules/import/__tests__/Import.integration.spec.ts`; `api/src/tv-modules/tasks/__tests__/TaskMove.integration.spec.ts`; `api/src/tv-modules/webhooks/__tests__/WebhooksFiles.integration.spec.ts` | Aserción HTTP, aislamiento DDL scratch y fechas sintéticas. |
| SDK | `taskview-packages/taskview-api/src/api/__tests__/db-credentials.ts` | Destino scratch bajo guardia L01. |
| Web y dependencias | `web/dockerfile`; `web/package.json`; `web/src/composables/useLogout.ts`; `web/src/pages/login.vue`; `web/src/plugins/axios.ts`; `pnpm-lock.yaml` | Entrypoint CRLF, dependencia ESLint directa, logs sensibles retirados; lockfile solo tres líneas del importador web. |
| Nuevos de prueba | `api/src/modules/log-redaction.ts`; `api/src/tv-modules/auth/__tests__/AuthLogging.lista01.spec.ts`; `api/src/tv-modules/kanban/__tests__/KanbanOrder.lista01.spec.ts`; `api/vitest.lista01.auth-logging.config.ts`; `api/vitest.lista01.config.ts`; `api/vitest.lista01.kanban.config.ts`; `api/vitest.lista01.pg.config.ts`; `api/vitest.lista01.pg.guard.ts`; `api/vitest.lista01.pg.restore-default-role.mjs`; `taskview-packages/taskview-api/vitest.lista01.pg.config.ts`; `taskview-packages/taskview-api/vitest.lista01.pg.setup.ts`; `web/scripts/l01-auth-regression.mjs` | Redacción, suites, guardias, restauración limitada a scratch y probes sintéticos. |
| Nuevos informes | `docs/auditoria-taskview/01-arquitectura-actual.md`, `02-inventario-funcional.md`, `03-modelo-datos-permisos.md`, `04-entorno-desarrollo.md`, `05-respaldo-versionamiento.md`, `06-matriz-brechas-scrum.md`, `07-informe-pruebas.md`, `08-recomendaciones-arquitectura.md`, `09-resumen-ejecutivo.md`, `10-punto-continuacion.md`, `11-pruebas-unitarias-integracion.md`, `12-inventario-postgresql.md`, `12-seguridad-deuda-tecnica.md`, `13-acta-propuesta-cierre-lista01.md` | La carpeta completa sigue sin seguimiento; secciones históricas se leen con prioridad temporal. |
| Nueva configuración de laboratorio | `docs/auditoria-taskview/entorno/.env.example`, `.gitignore`, `compose.yaml`, `test-db.compose.yaml`, `recovery.compose.yaml`, `br07.compose.yaml`, `web-security.compose.yaml`, `api-authlog.Dockerfile`, `br07-probe.mjs` | Redes, volúmenes, puertos, imagen API nueva y verificación sintética. |

**Exclusiones:** `docs/auditoria-taskview/entorno/.env` y `api/.test-data/lista01-pg-files` están ignorados; credenciales DPAPI, contraseñas, tokens, dumps y adjuntos privados quedan fuera de Git. Antes de preparar un commit futuro, revisar individualmente archivos nuevos y ejecutar un escaneo de secretos sin emitir valores. En esta consolidación no se imprimieron secretos ni se inspeccionaron registros que pudieran contenerlos.

## 9. Criterios para recomendar el inicio de Lista 02

| Criterio del encargo | Evaluación |
|---|---|
| 1. Laboratorio independiente | Cumplido; Compose L01 y destinos separados, sin instalación original. |
| 2. Pruebas funcionales principales | Cumplido con alcance PF01–PF12; quedan suites específicas pendientes. |
| 3. Respaldo/recuperación sintéticos | Cumplido BR01–BR08, incluida lectura funcional en copia desechable. |
| 4. Seguridad incorporada en artefacto del laboratorio | Cumplido en frontend activo y en **imagen API nueva no desplegada**; R1 tiene prueba de logs en memoria y regresión auth scratch. |
| 5. Sin defectos críticos/altos sin controlar en módulos a modificar | Cumplido para el riesgo R1 en fuente; R2 queda contenido para laboratorio y es puerta obligatoria de despliegue/exposición. |
| 6. Deuda no bloqueante identificada/tratada | Clasificada aquí; aceptación formal pendiente. |
| 7. Permisos documentados | Cumplido como matriz de controles; pruebas de scopes por rutas nuevas siguen siendo obligatorias. |
| 8. Original intacto | Cumplido según último inventario de metadatos, sin mutaciones en esta consolidación. |
| 9. Cambios revisables/reproducibles | Inventario exacto, diff limpio, Dockerfile API reproducible sin red y regresiones focales; aún sin commit. |
| 10. Desarrollo ≠ despliegue/exposición | Separación expresa en esta acta; R2 requiere autorización operativa aparte. |

## 10. Recomendación técnica

**OPCIÓN A — APTA PARA CIERRE DE LISTA 01, como recomendación técnica.** R1 quedó corregido en fuente, verificado con marcadores y regresiones, e incorporado en una imagen API nueva del laboratorio; las pruebas principales y el aislamiento sostienen la recomendación. La publicación del original es una decisión operativa separada y una puerta obligatoria antes de exponer servicios; no se ha demostrado acceso remoto. Las deudas de lint, S3, MCP, E2E y concurrencia Kanban tienen tratamiento condicionado al módulo y no constituyen por sí mismas evidencia de fallo funcional general.

La aceptación explícita de las deudas temporales y el cierre formal corresponden al responsable. La imagen API corregida no está desplegada en la API activa y cualquier despliegue requiere verificación propia. Ninguna recomendación de esta acta inicia Lista 02 ni aprueba despliegue.

## 11. Decisión del responsable del proyecto — **PENDIENTE**

| Campo | Decisión por registrar |
|---|---|
| Corrección obligatoria R1 y nueva evidencia | Técnicamente verificada; aceptación del responsable pendiente |
| Aceptación o rechazo de deudas técnicas de §6 | Pendiente |
| Plan y responsable de evaluación operativa R2 | Pendiente |
| Autorización de cierre formal de Lista 01 | Pendiente |
| Autorización separada para Lista 02 o despliegue | No solicitada ni concedida por esta acta |

**No se declara aprobada ni cerrada Lista 01.**
