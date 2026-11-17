# Lista 07 — Definition of Done y cierre controlado

## Auditoría

Lista 05 ya disponía de revisiones QA (`pending`, `observed`, `approved`), observaciones, bugs vinculados y aceptación funcional de Sprint Review. Lista 06 mostraba el estado QA en Kanban. La brecha era que el endpoint legacy `PATCH /module/tasks` podía marcar una historia como completa sin comprobar esas condiciones.

## Regla DoD implementada

La validación se centraliza en `TasksRepository.validateDefinitionOfDone()` y se ejecuta desde `TasksManager.updateTask()` cuando `complete=true`:

- Solo se aplica automáticamente a elementos `story`; tareas, bugs, subtareas y registros históricos conservan compatibilidad.
- La historia debe tener criterios de aceptación no vacíos.
- La última revisión QA debe ser `approved`.
- No puede haber bugs abiertos vinculados (`related_task_id`).
- Si la historia pertenece a un sprint, debe existir aceptación funcional `accepted`.

La API devuelve HTTP 409 con `error: definition_of_done` y una lista de condiciones (`qa_not_approved`, `qa_observations_pending`, `blocking_bugs_open`, `functional_acceptance_missing`, etc.). Los permisos se evalúan antes, por lo que un usuario sin edición recibe HTTP 403.

No se añadió migración ni se alteró el esquema 1.77.0.

## Evidencia ejecutada

| Escenario | Resultado | Evidencia |
|---|---|---|
| Historia sin QA | PASS | HTTP 409; razones QA y aceptación funcional presentes |
| Historia observada | PASS | HTTP 409 con `qa_observations_pending` |
| QA aprobado sin Sprint Review | PASS | HTTP 409 con `functional_acceptance_missing` |
| Historia conforme al DoD | PASS | QA aprobado + aceptación funcional + sin bugs; cierre persistido |
| Bug bloqueante abierto | PASS | HTTP 409 con `blocking_bugs_open` |
| Bug resuelto y cierre posterior | PASS | Bug e historia quedaron completos |
| Usuario solo lectura | PASS | HTTP 403 al intentar cerrar |
| Historial | PASS | Historia cerrada conserva 3 entradas de historial |
| Regresión Playwright Listas 03–06 | PASS | 4/4 escenarios base; Kanban 1/1; filtros Lista 06 1/1 |
| Unitarias | PASS | 24/24 |
| TypeScript/build/lint | PASS | `tsc`, build API/web y lint dirigido sin errores |

## Seguridad y compatibilidad

La validación se ejecutó solamente sobre L04 (`taskview-l01-b5a7e65`). No se modificó L02 ni producción. Las operaciones de tareas históricas no Scrum siguen usando la misma ruta y permisos existentes. No se cerró automáticamente ningún sprint ni se mezcló la aceptación funcional con QA.

## Riesgos pendientes

La satisfacción semántica de los criterios de aceptación sigue siendo responsabilidad de QA; el backend exige que estén documentados y que QA apruebe. La regla de aceptación funcional se exige únicamente para historias planificadas en sprint. Advertencias heredadas de dependencias y Vite permanecen no bloqueantes.

## Cierre

Lista 07 queda PASS: el cierre de historias es controlado, auditable, autorizado y compatible con tareas históricas, QA, Sprint Review y Kanban.
