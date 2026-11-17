# Lista 08 — Sprint Review, retrospectiva y cierre

## Funcionalidades reutilizadas

- Sprint Planning existente para comprometer tareas e historias.
- `ScrumController.getSprintReviewSummary` y aceptación funcional 1.77.0.
- `SprintReviewDialog` con outcomes explícitos (`accepted`, `carried-over`, `dropped`).
- Cierre transaccional existente: sprint `active → review → completed`, resultados por tarea y traslado a backlog/otro sprint.
- Retrospectiva textual existente (`wentWell`, `wentBad`, `actionItems`).

## Cambios implementados

- Migración incremental 1.78.0 con `tasks.sprint_retro_actions`.
- Acciones retrospectivas con descripción, responsable y estado (`planned`, `in_progress`, `done`).
- Endpoints:
  - `GET /module/sprints/sprint/:sprintId/retro-actions`
  - `POST /module/sprints/sprint/:sprintId/retro-actions`
  - `PATCH /module/sprints/sprint/:sprintId/retro-actions/:actionId`
- `GET /module/sprints/sprint/:sprintId` devuelve también las acciones retrospectivas.
- Se impide modificar texto o acciones de una retrospectiva cuando el sprint está `completed`.
- El cierre no exige que todas las historias estén terminadas: cada elemento incompleto requiere decisión explícita en Review y queda registrado como `carried-over`, `dropped` o `incomplete`.

## Pruebas ejecutadas

| Escenario | Resultado | Evidencia |
|---|---|---|
| Crear sprint y activar | PASS | Sprint sintético 3: `draft → active` |
| Entrar a Review | PASS | Sprint 3: `active → review` |
| Registrar acción retrospectiva | PASS | Acción creada, responsable 9 y estado `planned` |
| Consultar acciones | PASS | `GET` devolvió 1 acción |
| Cerrar sprint incompleto | PASS | Sprint 3 cerrado con `goalAchieved=false`, sin forzar historias terminadas |
| Bloqueo post-cierre | PASS | Crear acción posterior devuelve HTTP 400 |
| Usuario lector | PASS | Crear acción devuelve HTTP 403 |
| Persistencia tras consulta | PASS | Detalle del sprint cerrado conserva la acción retrospectiva |
| Regresión Playwright Listas 03–06 | PASS | Lista 03: 4/4; Lista 06: 1/1 |
| TypeScript/build/lint | PASS | API, web y lint dirigido sin errores |

## Seguridad y recuperación

La migración se aplicó solamente al laboratorio L04 después del respaldo:
`C:\Users\jvega\AppData\Local\Temp\taskview-l08-backup-20261116-144753\taskview_l04_pre.dump`.
L02, producción y las bases protegidas no recibieron escrituras.

## Riesgos pendientes

Las acciones retrospectivas no crean automáticamente tareas: pueden vincularse manualmente con el módulo de tareas existente cuando el equipo lo decida. El cierre conserva los elementos incompletos en el sprint cerrado o los traslada según la decisión explícita; no los marca como terminados.

## Resultado

Lista 08 queda PASS: el equipo puede planificar, ejecutar, revisar, registrar retrospectiva y cerrar un sprint con trazabilidad, permisos y preservación del trabajo pendiente.
