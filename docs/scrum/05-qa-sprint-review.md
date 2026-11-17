# Lista 05 — QA funcional y Sprint Review

## Entorno y alcance

La validación se ejecutó únicamente en el laboratorio aislado L04 (`taskview-l01-b5a7e65`): PostgreSQL 17.12 en el volumen `taskview-l01-b5a7e65_pgdata`, API `127.0.0.1:11725` y web `127.0.0.1:18888`. La base de referencia L02 no recibió escrituras. Antes de la migración se creó el respaldo `C:\Users\jvega\AppData\Local\Temp\taskview-l05-backup-20261116-133444\taskview_l05_pre.dump` (SHA-256 `84B518A29838CA866E9E9DC327D11B09E886754E2C75D43CE312083E034FB8F8`).

## Cambios implementados

- Migración incremental 1.77.0 con `tasks.qa_reviews`, `tasks.qa_observations` y `tasks.sprint_review_acceptances`.
- API Scrum para revisiones QA, observaciones, bugs vinculados y resumen/aceptación de Sprint Review.
- Panel QA en el detalle Scrum y aceptación funcional independiente en `SprintReviewDialog`.
- Se preservan `/module/tasks`, estados Kanban, planificación de sprints, historial y permisos existentes.
- Se corrigió el tipo explícito del parámetro SQL de estado QA (`$3::varchar`), que provocaba una promesa rechazada al crear revisiones pendientes.

## Contratos validados

`GET/POST /module/scrum/items/:taskId/qa`, `POST /module/scrum/items/:taskId/qa/observations`, `GET /module/scrum/sprints/:sprintId/review-summary` y `PUT /module/scrum/sprints/:sprintId/review-items/:taskId`.

Una historia sintética fue creada en el sprint 2, pasó por `pending → observed → approved`, recibió una observación, apareció en el resumen de Sprint Review y fue aceptada funcionalmente. Un usuario de solo lectura recibió 403 al intentar registrar QA.

## Pruebas y resultados

| Control | Resultado | Evidencia |
|---|---|---|
| Migración 1.77.0 | PASS | Migrador informó éxito; tablas QA y aceptación presentes en L04 |
| Flujo API Historia → QA → Review | PASS | 1 historia, 3 revisiones, 1 observación y 1 aceptación persistidas |
| Permisos de escritura/lectura | PASS | Editor autorizado; lector rechazado con HTTP 403 |
| Playwright regresión Lista 03 | PASS | 4/4 escenarios: backlog, relaciones, Kanban y roles/scopes |
| Regresión unitaria Lista 02/01 | PASS | 24/24 pruebas Vitest |
| TypeScript | PASS | `api tsc --noEmit`, `web vue-tsc` |
| Lint dirigido | PASS | Biome API y ESLint de los dos componentes modificados |
| Build web/API | PASS | Build API completo y `web build-only` |
| Bases protegidas | PASS | Sin escrituras; L02 se consultó solo lectura y mantiene 33 tareas según evidencia de Lista 04 |

## Riesgos y pendientes

Persisten advertencias heredadas de Vite/dependencias y suites PostgreSQL protegidas que deliberadamente no se ejecutan contra L02. La aceptación de Sprint Review requiere el permiso existente `SPRINT_CAN_MANAGE`; QA utiliza el permiso de edición del proyecto. No se añadieron estados nuevos ni se cerraron sprints automáticamente.

## Recomendación

Lista 05 queda técnicamente validada en el laboratorio aislado y lista para preparar la siguiente etapa, manteniendo el procedimiento de restauración mediante el dump verificado. No se desplegó ninguna migración fuera de L04.
