# 09 — Resumen ejecutivo

## API corregida activa en laboratorio — 2026-11-14 (estado vigente)

**Recomendación técnica: APTA PARA CIERRE DE LISTA 01; decisión formal del responsable PENDIENTE.** Se activó exclusivamente en el laboratorio la imagen API corregida `taskview-l01-api:authlog-20261114` (ID `sha256:5e4e6f07e92747b58aae3011dfa7f869c8c4b0e0b116a1965508a0dd7c303f50`). La API nueva pasó login válido e inválido, lectura protegida de proyecto sintético, refresh, logout y rechazo de sesión revocada. En los registros nuevos de Pino y la salida del contenedor no aparecieron credenciales sintéticas ni patrones JWT; se conservó diagnóstico operativo seguro. La web pasó nuevamente login, refresh y logout contra esa API sin registros sensibles en consola. [Evidencia](07-informe-pruebas.md#validación-final-de-runtime-api--2026-11-14-estado-vigente).

Originales, bases activa/recovery/BR07, scratch, adjuntos y lockfile conservan las referencias verificadas. Persisten 18 errores lint API y 48 web como deuda propuesta, suites externas/E2E pendientes, scopes por probar al modificar rutas, y concurrencia Kanban antes de ampliar ese flujo. Los puertos originales y firewall requieren evaluación operativa independiente antes de cualquier exposición. El cierre de Lista 01 **no autoriza despliegue ni Lista 02**; su aceptación corresponde al responsable. Las secciones inferiores conservan estados históricos anteriores a la activación de la API.

## Corrección AuthModel verificada — 2026-11-14 (estado vigente)

**Recomendación técnica: APTA PARA CIERRE DE LISTA 01, pendiente de decisión expresa del responsable; Lista 01 no está cerrada y Lista 02 no comenzó.** El riesgo de logs de autenticación identificado en el acta se corrigió en fuente: AuthModel ya no registra usuarios completos, códigos ni excepciones crudas; AuthController, Email y middleware eliminan entradas equivalentes. Pino redacta campos estructurados sensibles como defensa adicional. Pruebas de logs con marcadores sintéticos **6/6 PASS**; regresión relacionada `AuthModel` **13/13**, API auth **23/23**, unitarias puntuales **8/8 PASS**; TypeScript y build API PASS. Una imagen nueva `taskview-l01-api:authlog-20261114` contiene el bundle verificado, sin sustituir la API activa del laboratorio ni la original. [Detalle](12-seguridad-deuda-tecnica.md#corrección-de-seguridad-authmodel--2026-11-14), [acta actualizada](13-acta-propuesta-cierre-lista01.md).

PF01–PF12, BR01–BR08, 512 unitarios y 1048 PostgreSQL PASS previos conservan sus resultados y **no se incrementan** con estas regresiones. Lint continúa con 18 errores API y 48 web. Puertos originales y firewall requieren evaluación operativa antes de exponer servicios; la accesibilidad desde otro equipo sigue sin comprobarse. Suites SDK/S3/MCP/E2E, scopes y concurrencia Kanban se condicionan al módulo futuro. Las bases protegidas, adjuntos y contenedores originales conservaron sus referencias; lockfile sin cambios en esta actividad. La aceptación de deuda y el cierre formal siguen pendientes.

## Propuesta de cierre técnico de Lista 01 — 2026-11-14

**Recomendación vigente: OPCIÓN B — APTA CON CORRECCIONES OBLIGATORIAS. Lista 01 permanece abierta y Lista 02 no comenzó.** La consolidación confirma typecheck y builds API/web PASS, PF01–PF12 y BR01–BR08 PASS, 54 suites unitarias completas con 512 tests PASS y, de 79 suites PostgreSQL, 59 PASS completas, una parcial (12 casos locales PASS/16 S3 sin ejecutar), 19 SDK sin ejecutar y 1048 tests PASS/0 FAIL. Las regresiones posteriores de autenticación, Kanban (6/6) y guard de token (5/5) se presentan aparte, sin duplicar los totales. Lint continúa FAIL: 18 errores API y 48 web. [Acta y matriz única](13-acta-propuesta-cierre-lista01.md).

La revisión de cambios previa al versionamiento detectó un **bloqueante de seguridad adicional**: `AuthModel.getUserByLogin` registra a nivel `info` el resultado completo de una consulta de usuario, y dos handlers de error estructuran códigos de confirmación/recuperación; Pino no configura redacción y el nivel predeterminado de producción es `info`. La fuente permite registrar material sensible, aunque no se comprobó un incidente ni se leyeron valores reales. Se recomienda retirar esos campos y verificarlo con datos sintéticos **antes de versionar o desplegar la fuente y antes de proponer el cierre técnico**. La corrección del frontend ya está en la imagen del laboratorio; la corrección Kanban está en fuente y bundle API local, todavía no en la imagen API activa.

El original sigue publicado en `0.0.0.0`/`[::]` en 1725/8888 y el firewall Windows informó perfiles desactivados; **no se demostró accesibilidad desde otra máquina**. La evaluación de alcance y eventual mitigación exige decisión operativa separada del responsable de infraestructura, sin modificar la instalación original durante esta auditoría. Lint no bloqueante, suites SDK/S3/MCP/E2E y concurrencia Kanban se tratan por módulo según el acta. El cierre formal y la aceptación de deuda corresponden al responsable del proyecto; el apartado de decisión del acta permanece pendiente.

## Correcciones previas al cierre — 2026-11-14

**Recomendación: APTA CON CORRECCIONES OBLIGATORIAS. Lista 01 sigue abierta; Lista 02 no comenzó.** Se desplegó una imagen web **nueva y exclusiva del laboratorio** con los logs de tokens retirados. Un probe de navegador con cuenta sintética pasó login, refresh tras 401 y logout; no registró patrones sensibles ni errores de página. El doble rebalanceo Kanban se reprodujo con prueba fallida previa, se eliminó la rama redundante y los seis escenarios sintéticos pasaron. Typecheck y builds API/web PASS. [Evidencia y matriz de permisos](12-seguridad-deuda-tecnica.md); [informe](07-informe-pruebas.md).

Lint sigue FAIL: **18 errores API y 48 web**. La herramienta web ya ejecuta normalmente tras declarar `@eslint/js` 9.39.3, existente como transitiva; lockfile cambió solo tres líneas, sin actualizar otras dependencias. Los 48 web son de estilo, no bloqueo funcional demostrado. Original API/web continúan publicados en todas las interfaces y los perfiles de firewall Windows aparecen desactivados; **la accesibilidad desde otra máquina no se comprobó**. El responsable debe aprobar una verificación de red y eventual mitigación operativa por separado. La API Kanban no admite una versión esperada para rechazar movimientos concurrentes obsoletos; ese diseño queda pendiente.

Original, DB activa, recovery, BR07, scratch y adjuntos conservaron su integridad comprobable; los cambios Docker se limitaron al web del laboratorio. PF01–PF12, BR01–BR08, 512 unitarios y 1048 PostgreSQL PASS previos no se repitieron. La aceptación de deuda y el cierre formal corresponden al responsable del proyecto.

## Revisión final de seguridad y deuda — 2026-11-14

**Recomendación: APTA CON CORRECCIONES OBLIGATORIAS.** No se declara cerrada Lista 01 ni se inició Lista 02. PF01–PF12, BR01–BR08, 512 unitarios y 1048 tests PostgreSQL permanecen PASS; no se repitieron. El log de token/refresh en el frontend era un defecto comprobado: se retiró de fuente junto con logs de errores potencialmente sensibles. Typecheck y build web PASS. La imagen web activa sigue siendo la anterior y necesita reconstrucción/verificación autorizada. [Evidencia y matriz de riesgos](12-seguridad-deuda-tecnica.md); [resultados](07-informe-pruebas.md).

Persisten **66 errores lint**: 18 API (9 sin uso, 5 callbacks/thenable, 3 regex, 1 expresión Kanban) y 48 web de estilo. ESLint web necesita una dependencia directa `@eslint/js` para ser reproducible sin workaround; no se cambió el lockfile. Se identificó una posible doble operación de rebalanceo Kanban que requiere prueba antes de modificar planificación. Pendientes: 19 SDK, 16 casos S3 y una suite S3, 12 MCP integración y 8 E2E; los casos de auth, proyectos, tareas, roles y orden tienen prioridad cuando se modifiquen esas áreas. S3/MCP pueden diferirse solo con alcance local declarado. No se ejecutaron suites S3 ni E2E.

Las bases activa, recovery y BR07 conservan `2|4|18|1|20` filas en usuarios|proyectos totales|tareas|archivos|historial; dos de los cuatro proyectos son los sintéticos objetivo. Los adjuntos conservan hash. Scratch, contenedores originales y lockfile permanecen intactos. El original sigue con API/web publicados en todas las interfaces; necesita evaluación de exposición por infraestructura sin alterar esta instalación en la auditoría. La aceptación de deuda y el cierre formal corresponden al responsable del proyecto.

## Actualización más reciente — BR07 (2026-11-14)

**BR07 PASS:** una API nueva, confinada a una red Docker interna sin puertos publicados, leyó funcionalmente una restauración **desechable** del respaldo sintético validado. Se verificaron el hash del dump antes de restaurar y, por API autenticada, proyectos, tareas/subtareas, sprint y retrospectiva, roles, historial y descarga del adjunto con hash exacto. PgBoss solo pudo escribir en esa copia. La base de recuperación conservada no recibió una API ni escrituras de prueba. [Evidencia y límites](05-respaldo-versionamiento.md); [resultado detallado](07-informe-pruebas.md); [entorno reproducible](04-entorno-desarrollo.md).

La regresión puntual confirmó que la función scratch de permisos predeterminados sigue en la versión vigente tras `FilesQuota` y que `default-roles` pasa 2/2. Original, base activa, recuperación, adjuntos y lockfile permanecen íntegros. BR01–BR08 quedan PASS según los alcances documentados. **Lista 01 sigue abierta** por las verificaciones restantes; no se avanzó a seguridad, lint, E2E, S3 ni Lista 02.

Las secciones siguientes conservan resultados previos para trazabilidad.

## Corrección acotada más reciente — 2026-11-14

El único FAIL previo provenía de una función de roles **desactualizada solo en PostgreSQL scratch**: una suite había reaplicado triggers de 1.69.0 sobre el esquema 1.74.0. Tras verificar la identidad de scratch, se restauró la función vigente de 1.73.0; `default-roles` pasó 2/2 sin modificar autorización productiva. Tres de las cuatro suites API pendientes pasaron completas (webhooks de archivos, importación y cuotas). La cuarta pasó 12 tests locales y mantiene 16 casos S3 bloqueados.

Estado PostgreSQL actualizado: **79 suites; 59 PASS completas, 0 FAIL, 20 BLOCKED; 1048 tests PASS y 0 FAIL**. Se ejecutaron tests en 60 suites, incluida la parcial. Las 19 SDK bloqueadas se clasificaron técnicamente sin ejecutarlas. API/SDK typecheck PASS; guardias, bases protegidas, adjuntos, contenedores originales y lockfile verificados intactos. [Detalle de pruebas](07-informe-pruebas.md) e [inventario actualizado](12-inventario-postgresql.md). **Lista 01 sigue abierta** por S3, suites SDK y verificaciones previas; no se inició Lista 02.

La sección siguiente conserva el resultado anterior para trazabilidad.

## Actualización más reciente — integración PostgreSQL (2026-11-14)

Se aisló un PostgreSQL 17 scratch con volumen, red, credenciales y API propios dentro del proyecto Compose de Lista 01. Los guardias de Vitest verificaron identidad física del clúster y esquema antes de ejecutar cada grupo. De **79 suites PostgreSQL**, **56 ejecutaron tests**: **55 PASS, 1 FAIL, 23 BLOCKED**, con **1016 tests PASS y 1 FAIL**. El fallo reproducible está en permisos del rol editor (`timetracking_can_log`); no se alteró negocio. Las bloqueadas requieren revisión de DDL/almacenamiento o dependencias sintéticas de correo, IdP y receptores. [Inventario y diagnósticos](12-inventario-postgresql.md); [procedimiento scratch](04-entorno-desarrollo.md); [resultados](07-informe-pruebas.md).

Las 512 pruebas unitarias PASS de la actividad anterior se conservan sin repetición. Original, DB activa y recuperación permanecen intactos por metadatos, conteos y hashes de adjuntos; lockfile sin cambios. BR07 y los 66 errores lint registrados siguen pendientes, al igual que E2E y seguridad en sus actividades correspondientes. **La integración PostgreSQL está parcialmente verificada y Lista 01 sigue abierta.** No se inició Lista 02.

## Estado previo a suites — 2026-11-14

El resultado más reciente de suites unitarias e integración figura al final de este documento y en [11 — Pruebas unitarias e integración](11-pruebas-unitarias-integracion.md).

El laboratorio Docker ya funciona en `http://localhost:18888` y API responde en `http://localhost:11725`; PostgreSQL 17.12 usa base sintética y esquema 1.74.0. Builds/typecheck PASS; lint conserva 18 errores API y 48 web. Los recursos originales permanecen con sus IDs y tiempos de inicio anteriores. El aislamiento separa red/volúmenes y deshabilita masquerading de egreso; se verificaron CORS y URLs localhost.

Las pruebas funcionales autenticadas PF01–PF12 están aprobadas. El ensayo sintético restauró base y adjuntos a volúmenes/DB independientes: BR01–BR06 y BR08 PASS; BR07 está BLOCKED porque no se inició una API que garantice modo de solo lectura. La Lista 01 sigue pendiente de suites unitarias/integración aislables, verificaciones de seguridad restantes y deuda de lint; no iniciar Lista 02.

El siguiente resultado de continuación es histórico y queda reemplazado por la actualización anterior:

> Dependencias instaladas con lockfile congelado. SDK, esquemas, puente Capacitor y bundles API/migración compilaron; Vite generó el frontend. En aquella ejecución fallaban typecheck/lint y build web, y no había contenedores. Los resultados actualizados constan en el informe 07.

## Decisión técnica

TaskView ofrece una base reutilizable mayor que una simple lista de tareas: proyectos/organizaciones, tareas/subtareas, Kanban, roles múltiples, adjuntos, sprints con objetivo, planificación, Review, retrospectiva, métricas y sincronización de GitLab Issues. La arquitectura modular permite evolución sin una reescritura. Se confirmó Vue 3/Vite/Pinia, Express/TypeScript, PostgreSQL/Drizzle y pnpm.

Las brechas principales son tipos de épica/historia/bug, jerarquía compatible con planificación, criterios de aceptación/DoD y QA estructurados, capacidad individual completa y trazabilidad de ramas/commits/MR/pipelines. El backlog de planificación actual selecciona tareas raíz: no basta añadir un tipo “épica” para que historias anidadas funcionen.

## Instalación y preparación

Código: commit `b5a7e65`, paquetes raíz/API/web 1.58.2. Instalación observada: API 1725, web 8888, PostgreSQL 17.12/esquema 1.74.0. Las imágenes tienen digests registrados pero no revisión OCI; correspondencia exacta con código NO VERIFICADA. El runtime declara 1.17.0 por manifiesto de producción heredado, así que ese dato no prueba antigüedad del binario.

Rama conservada: `chore/l01-auditoria-taskview`, sin commit, push ni merge. El párrafo de estado anterior describía el corte previo a Docker; la actualización superior registra el laboratorio ya ejecutado. Node host 20 permanece sin cambios; Node 24.22.2 y pnpm 10.28.1 se activaron por proceso desde carpeta temporal. Bun ausente, no requerido para los bundles ejecutados.

En el cierre actual se actualizaron 04, 07 y 09; el resto de la carpeta de auditoría se conservó. `pnpm install` creó `node_modules`; los builds generaron artefactos ignorados; las imágenes de laboratorio usan etiquetas propias. El lockfile conserva SHA-256 `2D0FA9B63C3438A1A707AD12D7D00509F97BAD96F5FBDE94A3959D74844BE494`. No se accedió al servidor GitLab institucional.

## Prioridades

1. Iniciar las pruebas funcionales sintéticas PF01–PF12 y las suites unitarias/integración que puedan aislarse, sin usar la DB cotidiana.
2. Validar permisos, roles múltiples, adjuntos, historial, review/retro, analítica y logs en el laboratorio activo.
3. Completar verificación de seguridad efectiva; la red deshabilita masquerading, aunque no se probó conectividad hacia servicios externos.
4. Hacer respaldo/restauración únicamente de DB y adjuntos sintéticos en un destino nuevo del proyecto autorizado.
5. Mantener los 18 errores de lint API y 48 de web como pendientes; no aplicar autofix masivo. No iniciar Lista 02 antes de cerrar criterios esenciales de Lista 01.

La licencia local Source-Available 1.1 permite modificación/autoalojamiento interno bajo sus condiciones y restringe terceros, explotación competitiva y marcas; ver 05. No tratar este proyecto como software bajo licencia permisiva.

## Criterios de aceptación

| Criterio solicitado | Estado / evidencia |
|---|---|
| Arquitectura real identificada | Cumplido documentalmente, 01 |
| Mapa frontend/API/DB | Cumplido documentalmente, 01–03 |
| Módulos relevantes localizados | Cumplido, 02/06 |
| Reutilización identificada | Cumplido por código; ejecución pendiente |
| Riesgos del modelo actual | Cumplido, 03/08 |
| Roles y permisos documentados | Cumplido, 02/03 |
| Integración GitLab revisada | Código revisado; compatibilidad institucional NO VERIFICADA |
| Procedimiento aislado | Laboratorio API/web/DB ejecutándose con puertos/red/volúmenes exclusivos; pruebas funcionales pendientes, 04/07 |
| Dependencias y compilación | Instalación congelada PASS; typecheck API/web PASS; builds API/migración/web PASS; lint API/web FAIL, 07 |
| Procedimiento de respaldo/restauración | Documentado, 05; ejecución de ensayo pendiente |
| Resultados reales registrados | Cumplido, 07: bloqueos explícitos, sin éxitos ficticios |
| Nueve documentos | Generados con archivos auxiliares de entorno |
| Instalación original sin cambios de esta auditoría | IDs de contenedores/imágenes, StartedAt, estado, volúmenes y mounts originales coinciden con el inventario previo |
| Recomendación sustentada para Lista 02 | Laboratorio listo para las pruebas funcionales restantes de Lista 01; no iniciar Lista 02 hasta pruebas y recuperación sintética |

## Índice de entregables

- [01 — Arquitectura](01-arquitectura-actual.md)
- [02 — Inventario funcional](02-inventario-funcional.md)
- [03 — Modelo y permisos](03-modelo-datos-permisos.md)
- [04 — Desarrollo aislado](04-entorno-desarrollo.md)
- [05 — Respaldo y versiones](05-respaldo-versionamiento.md)
- [06 — Brechas Scrum](06-matriz-brechas-scrum.md)
- [07 — Pruebas](07-informe-pruebas.md)
- [08 — Recomendaciones](08-recomendaciones-arquitectura.md)
- [Configuración Compose](entorno/compose.yaml), [variables sin secretos](entorno/.env.example), [exclusiones privadas](entorno/.gitignore)
- [10 — Punto de continuación](10-punto-continuacion.md): estado de la pausa, operaciones verificadas, restricciones y comandos pendientes para otro modelo de Codex.

## Actualización de diagnóstico TypeScript/lint — 2026-11-13

En la ejecución más reciente, API typecheck pasó tras corregir 12 errores puntuales; web typecheck no reprodujo los errores anteriores de composables; y `pnpm.cmd run build:webapp` completó correctamente. Lint sigue fallando con 18 errores API (más 10 advertencias y 9 informativos) y 48 errores de estilo web, todos documentados con archivos y grupos en [07 — Informe de pruebas](07-informe-pruebas.md). El lockfile no cambió y no se inició Docker ni se tocaron los contenedores originales.

Decisión de esta tarea: **compilación/tipos aptos para considerar la siguiente etapa de laboratorio aislado**, con deuda de lint explícita. No se ejecuta Docker en este alcance. La Lista 01 completa permanece pendiente de laboratorio, regresión, aislamiento efectivo y recuperación sintética; no iniciar Lista 02 hasta completar sus verificaciones de seguridad y recuperación.
Comprobación frontend adicional: la aplicación registra el plugin Vite de Nuxt UI 4.4.0 y `web/auto-imports.d.ts` incluye los tres composables investigados; no se necesitaron imports explícitos ni cambios de configuración.

## Actualización — pruebas funcionales PF01–PF12 (2026-11-14)

Se confirmó por metadatos y solicitudes HTTP que el laboratorio `taskview-l01-b5a7e65` permanece disponible en `localhost:18888/11725`, con PostgreSQL sintético en 15432, DB/esquema `taskview_l01`/1.74.0 y volúmenes/red exclusivos. La instalación original continúa `running`, conserva IDs, image IDs y StartedAt, y respondió 200 en su web (`localhost:8888`) y endpoint de opciones (`localhost:1725/module/auth/login-options`). No se ejecutaron migraciones, backup/restore ni cambios en contenedores originales.

Las comprobaciones de rechazo anónimo pasaron: login con identificador ficticio inválido → 400; GET de proyectos, tareas, sprint protegido y catálogo analítico sin sesión → 401. Esto no acredita una sesión válida ni operaciones funcionales autenticadas. La API informa que password login y registro público están habilitados, pero el registro crea al usuario bloqueado y requiere confirmación por correo. El Compose no configura SMTP ni existe un flujo local de confirmación comprobado; para no dejar cuentas bloqueadas ni usar acceso directo a tablas de autenticación, no se crearon cuentas. Por esa dependencia, PF01 queda BLOCKED para login/cierre exitoso y PF02–PF12 quedan BLOCKED; sus detalles están en [07 — Informe de pruebas](07-informe-pruebas.md).

No se usó navegador ni se guardaron respuestas/logs con tokens. Sigue vigente el hallazgo de logging de tokens de refresh en `web/src/plugins/axios.ts`, por lo que las verificaciones de autenticación deben ejecutarse evitando la consola del navegador o saneando la salida. No se modificó código funcional, esquema, Compose ni lockfile. El informe 07 y este resumen son los únicos documentos actualizados en esta ejecución.

**Decisión actual:** Lista 01 sigue pendiente y no está apta para pasar a Lista 02. El laboratorio sí está técnicamente activo, pero antes de continuar las pruebas autenticadas se necesita un mecanismo sintético de registro/confirmación limitado al laboratorio, como un sink SMTP local validado para no habilitar egreso externo, o un procedimiento de inicialización oficial. Después se deben ejecutar PF01–PF12; el ensayo de backup/restauración sintético permanece pendiente y debe ser una actividad separada. No se inició Lista 02.

## Actualización — PF01 desbloqueada (2026-11-14)

La [documentación oficial](https://taskview.tech/docs/getting-started/installation#log-in-with-the-default-user) confirma una cuenta bootstrap y el flujo de reclamación de credenciales dentro de TaskView. Se verificó una sola cuenta semilla habilitada en la DB sintética `taskview_l01`, se inició sesión y se reclamó inmediatamente mediante el endpoint oficial de la aplicación. La sesión bootstrap anterior quedó revocada.

Para la segunda cuenta, se incorporó Mailpit al Compose aislado con imagen oficial fijada por digest, listener SMTP solo interno en `mailpit:25`, sin TLS, autenticación ni relaying externo, y filtro de destinatarios `.invalid`. La UI/API se publica solo en `127.0.0.1:18025`. El código local confirma que `emailjs@4.0.3` usa puerto 25 por defecto y que el wrapper TaskView no pasa `SMTP_PORT`; acepta TLS por flags `SMTP_ENCRYPTION=ssl|tls`, pero en esta prueba se dejó desactivado para coincidir con el sink local sin credenciales. Se recreó solo el contenedor API del laboratorio para añadir SMTP local. Se creó la segunda cuenta por el endpoint de registro y se confirmó usando el correo capturado en Mailpit; no hubo cambios SQL de autenticación.

**PF01 PASS:** las dos cuentas iniciaron sesión, accedieron a un endpoint protegido, cerraron sesión (204) y sus sesiones revocadas recibieron 401; acceso anónimo también recibió 401. La cuenta bootstrap cambió credenciales inmediatamente usando el flujo oficial. Contraseñas guardadas cifradas con DPAPI del usuario Windows en `%TEMP%\taskview-l01-private\synthetic-accounts.json`, fuera del repo; no se imprimieron contraseñas, tokens ni código de confirmación.

La instalación original conserva IDs, image IDs, estado y StartedAt. No se ejecutaron PF02–PF12, migraciones, backup/restore ni Lista 02. Lista 01 sigue pendiente; el laboratorio está preparado para continuar exclusivamente con PF02–PF12. Riesgo local: Mailpit UI no tiene autenticación, aunque está enlazada solo a loopback y el buzón contiene únicamente correo sintético. La conexión de sink va en texto plano dentro de la red de laboratorio; no usar esta configuración para correo real.
## Actualización — PF02–PF12 funcionales — 2026-11-14

Las pruebas funcionales autenticadas restantes se ejecutaron con dos cuentas y datos sintéticos, exclusivamente contra el laboratorio `taskview-l01-b5a7e65` (`localhost:18888`, API `localhost:11725`, base `taskview_l01`). PF02–PF12: **PASS** en los casos realizados. Se comprobó CRUD de proyectos/tareas, asignación, subtareas y rechazo de ciclos/referencias cruzadas, movimiento explícito de tareas, persistencia de Kanban/orden, ciclo de sprint, roles múltiples, denegación entre proyectos, adjuntos con SHA-256 coincidente, historial, retrospectiva y métricas.

El laboratorio quedó ejecutándose; los contenedores originales permanecen `running` con los mismos IDs de contenedor, image IDs y tiempos de inicio del inventario previo. No se ejecutaron migraciones ni se modificaron datos originales. No se realizaron pruebas E2E, backups/restauraciones ni Lista 02.

La analítica del proyecto sintético devolvió 18 secciones sin fallas. La métrica de velocidad dio planned 5 / accepted 0 porque el trabajo de estimación 5 seguía incompleto: el código fuerza que una tarea solo cuente como accepted si `complete=true`. Burndown permaneció en 5 y fue decreciendo solo en la línea ideal. Las propiedades conservan sufijo `Hours` aun cuando el proyecto usa puntos; validar etiquetas y unidades antes de uso institucional.

**Decisión:** el laboratorio está listo para un ensayo sintético aislado de respaldo/restauración. La Lista 01 aún no se cierra: siguen pendientes ese ensayo, las suites unitarias/integración que puedan aislarse y verificaciones de seguridad restantes. Continúa la deuda documentada de lint: 18 errores API y 48 web. No iniciar Lista 02 hasta completar los criterios pendientes de Lista 01.

Evidencia detallada y matriz PF02–PF12: [07 — Informe de pruebas](07-informe-pruebas.md). Se conservaron los registros históricos posteriores; esta actualización es la más reciente y reemplaza sus estados BLOCKED anteriores de PF02–PF12.

## Actualización — respaldo y restauración sintética — 2026-11-14

El respaldo custom de PostgreSQL 17.12 (`pg_dump -Fc`) y su manifiesto se guardaron fuera del repositorio en directorio TEMP privado. Dump 331,854 bytes, SHA-256 `14ce4ce875af38229f06f9280bdd9e3ee618846a46319779264b327469550578`; `pg_restore --list` enumeró 787 entradas. Un adjunto sintético de 38 bytes se respaldó y su SHA-256 coincidió con el checksum de DB.

La restauración se ejecutó sin `--clean` ni migraciones sobre `taskview_l01_recovery`, nueva y vacía, en un PostgreSQL separado con volúmenes nuevos y red Docker `internal=true`, sin puertos ni acceso a la red activa. `pg_restore --exit-on-error --single-transaction --no-owner --no-acl` terminó con código 0. Conteos, relaciones jerárquicas, roles/permisos de aplicación, sprint, outcome, retrospectiva, historial y referencias/bytes del adjunto coincidieron entre origen y destino. `--no-owner --no-acl` significa que propietarios y privilegios PostgreSQL no se reprodujeron; la autorización de TaskView basada en filas sí se restauró.

**BR01–BR06 y BR08 PASS. BR07 BLOCKED:** no se inició una API sobre recuperación porque TaskView inicializa PgBoss y no se comprobó un modo de solo lectura. Las consultas SQL demuestran persistencia, no lectura funcional de la aplicación. Informe completo y limitación en [07 — Informe de pruebas](07-informe-pruebas.md); procedimiento reproducible en [04](04-entorno-desarrollo.md) y [05](05-respaldo-versionamiento.md).

La API del laboratorio se detuvo solo durante la ventana de copia y volvió a iniciarse; API/DB/Web/Mailpit siguen activos. Los contenedores originales conservan IDs, image IDs, StartedAt, red y volúmenes previos. El destino recovery-db y sus volúmenes quedan ejecutándose/conservados para inspección. No se respaldó ni restauró ninguna base institucional.

La Lista 01 aún no está cerrada. Pendientes: suites unitarias/integración aislables, verificaciones de seguridad restantes y resolución o aceptación formal de lint (18 errores API, 48 web). El ensayo sintético DB/adjuntos sí queda validado; no iniciar Lista 02 hasta cerrar los criterios restantes. No se implementaron módulos Scrum.
# Actualización más reciente — pruebas unitarias e integración — 2026-11-14

Se inventariaron **154 suites**: 64 API, 56 SDK, 26 MCP y 8 Playwright. Una configuración Vitest exclusiva de Lista 01 permitió ejecutar 40 suites API sin `conf.private.ts` ni destinos activos; 14 suites MCP corrieron sin conexión a API. Resultado único: **54 suites PASS, 512 tests PASS, 0 FAIL**. Quedan **100 suites BLOCKED** por PostgreSQL, S3, API real o dependencias E2E no aisladas. No se midió cobertura. El detalle y los comandos están en [11 — Pruebas unitarias e integración](11-pruebas-unitarias-integracion.md) y la tabla consolidada en [07 — Informe de pruebas](07-informe-pruebas.md).

La configuración SDK actual ejecutaría `TRUNCATE ... CASCADE` contra el puerto 15432 del laboratorio, por lo que no se lanzó. Playwright conserva puertos y cuentas de otro stack y puede reutilizar un servidor existente; tampoco se lanzó. La base activa y la recuperada conservan sus conteos, el adjunto activo su hash, y los contenedores originales sus IDs/image IDs/StartedAt. El lockfile está intacto. PF01–PF12 y BR01–BR06/BR08 continúan PASS; BR07 continúa BLOCKED. Persisten 66 errores lint (18 API, 48 web) y verificaciones de seguridad. **La Lista 01 sigue abierta**; esta actividad se detiene aquí sin abordar BR07, seguridad ni Lista 02.

