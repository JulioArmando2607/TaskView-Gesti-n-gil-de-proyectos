# Pruebas del modelo Scrum — Lista 02

## Ejecución final (2026-11-15)

La suite de integración ejecutable `api/src/tv-modules/scrum/__tests__/scrum-api.integration.mjs` se ejecutó dentro del contenedor API temporal, conectado a la red interna exclusiva de Lista 02. Antes de cada corrida final se comprobó `taskview_l02_final2_20261115`, rol `l02synthetic`, PostgreSQL `170012`, system identifier `7708388125454340134` y `app.version=1.76.0`. La API apuntó solamente a esa base.

| Control | Resultado | Evidencia |
|---|---|---|
| CRUD de épicas, archivo y persistencia de historias | PASS | Creación/lectura/edición, historias enlazadas, archivo lógico y desasociación sin borrar historia. |
| Autenticación y scopes | PASS | Anónimo 401; token de lectura permite GET, bloquea escritura y no accede a otro proyecto. |
| Stories, tasks y bugs | PASS | Crear, editar, filtrar por tipo, enlazar/desenlazar bug y rechazar relación entre proyectos. |
| Compatibilidad histórica y legacy | PASS | Crear y leer vía `/module/tasks`, tipo task por defecto, título/detalle e historial. |
| Subtareas y ciclos | PASS | Subtarea válida, autorreferencia y proyectos distintos rechazados; dos enlaces concurrentes opuestos producen solo un enlace confirmado y conflicto para el otro. |
| Claves de negocio concurrentes y no reutilización | PASS | Altas concurrentes entre épicas/bugs son únicas; se eliminó una tarea sintética y la clave siguiente avanzó sin reutilizarla. |
| Sprint, estado y orden Kanban | PASS | Story, task y bug raíz aparecen en planificación; estados concurrentes conservan órdenes únicos. |
| Movimiento entre proyectos | PASS | Referencias entrantes y épica vinculada bloquean sin escrituras parciales; movimiento simple y subárbol completo actualizan proyecto y claves. |

Resultado de las corridas finales: **9 grupos PASS, 0 FAIL por corrida**. Se descartó una corrida ejecutada mientras seguía activo un proceso API anterior al build vigente; las corridas repetidas con el bundle actual pasaron, incluida la asignación concurrente de claves. El error SQL genérico ya no se transforma en un falso `invalid_parent`: la API devuelve 500 sanitizado para fallos internos y 409 para conflictos de integridad. Las bases solo de Lista 02 recibieron las escrituras de estas pruebas.

## Regresiones unitarias

- Configuración focal `api/vitest.lista02.unit.config.ts`: **4 archivos PASS, 24 tests PASS** (planner de movimiento, permisos combinados desde múltiples roles, guardas de actualización y orden Kanban).
- Suite local previamente aprobada `api/vitest.lista01.config.ts`: **40 archivos PASS, 367 tests PASS** después de ajustar las expectativas del planner a la regla de rechazo de subtareas huérfanas y el mock transaccional. Incluye pruebas heredadas y no usa las bases protegidas.
- Lint acotado de archivos backend y pruebas tocadas: PASS, sin diagnósticos.
- Typecheck API: PASS. Build API: PASS; permanecen los warnings existentes del bundle protobuf (`eval`) y axios (imports estático/dinámico).

## Migraciones

1.75.0 se conserva sin cambios y su validación PostgreSQL 17.12 está registrada en [02-migracion-modelo.md](02-migracion-modelo.md). 1.76.0 añadió claves legibles y su prueba final se hizo en `taskview_l02_final2_20261115`, clonada desde el entorno L02 1.75.0. Se aplicó el archivo en una transacción `psql -1` con guardia positiva previa, se comprobaron columnas, defaults, constraints, índices, función, orden de triggers y versión. Una inserción SQL sintética verificó la derivación histórica del proyecto desde `goal_list_id`; el CRUD y las restantes operaciones se probaron vía HTTP ejecutable. No se ejecutó el migrador general porque su implementación puede terminar otras conexiones; ninguna base protegida estuvo conectada al runner.

## Cobertura pendiente y límites

- La suite HTTP cubre acceso anónimo y scopes de API, pero no crea cuentas distintas para probar cada combinación de rol de sesión o colaboración. La combinación de múltiples roles sigue dependiendo del mecanismo ya existente de `GoalPermissionsFetcher`.
- Las pruebas PostgreSQL directas de integración están contenidas en la suite HTTP/API y en las validaciones previas del esquema; el antiguo config `vitest.lista02.pg.config.ts` requiere un port-forward que la red Docker interna deliberadamente no ofrece, por lo que no se declara ejecutado.
- Review y Retrospectiva no se modificaron; su suite completa no se ejecutó en esta validación enfocada.
- La migración 1.76.0 no se aplicó al laboratorio funcional. La lista no se puede promover a ningún entorno hasta revisar y aplicar esas migraciones por separado.
