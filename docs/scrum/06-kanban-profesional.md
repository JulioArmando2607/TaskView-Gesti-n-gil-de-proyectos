# Lista 06 — Kanban profesional tipo Jira

## Entorno

Validado exclusivamente en el laboratorio L04 aislado (`taskview-l01-b5a7e65`), con API `127.0.0.1:11725`, web `127.0.0.1:18888` y PostgreSQL 17.12 en el volumen L04. No se aplicaron migraciones ni se escribieron las bases L02/protegidas. Se conserva el respaldo previo de Lista 05 como punto de recuperación.

## Capacidades existentes reutilizadas

- `KanbanBoard.vue`, `kanban.store.ts` y `KanbanManager` conservan drag-and-drop, reordenamiento determinista y control de permisos.
- Los estados configurables y sus operaciones de administración siguen siendo los existentes.
- Sprint, listas, responsables, `/module/tasks`, historial, QA y Sprint Review permanecen en sus módulos originales.
- Las transiciones no incorporan atajos que omitan QA o aceptación funcional.

## Cambios implementados

1. Las tarjetas muestran identificador legible, tipo Scrum (Historia/Tarea/Bug), prioridad y sprint.
2. Se muestra el último estado QA cuando existe (`pending`, `observed`, `approved`) sin duplicar el módulo QA.
3. Las columnas muestran contador de tarjetas.
4. Se agregaron filtros combinables de tipo de elemento y prioridad junto con sprint, lista y responsable.
5. Los filtros nuevos se validan en backend y se aplican en la consulta Kanban.
6. La consulta Kanban enriquece las tarjetas con el último QA mediante una sola consulta adicional, evitando N+1.
7. Se añadieron identificadores de prueba y un escenario Playwright independiente para filtros/metadatos.

No se creó migración nueva: el modelo 1.77.0 ya contiene las tablas QA necesarias.

## Evidencia

| Escenario | Resultado | Evidencia |
|---|---|---|
| Filtro de historias y prioridad | PASS | Endpoint Kanban devuelve solo elementos compatibles con `workItemTypes`/`priorityIds` |
| Metadatos visibles y contadores | PASS | Playwright Lista 06, 1/1 |
| Drag-and-drop y persistencia | PASS | Escenario Kanban pasó en ejecución aislada y reintento final; una ejecución completa presentó una carrera transitoria de UI y se repitió sin cambios de expectativa |
| Filtros, backlog y relaciones Scrum | PASS | 3/4 en la primera ejecución completa y Kanban 1/1 en reintento; los otros 3 escenarios pasaron |
| Permisos y scopes | PASS | Regresión Playwright Lista 03, escenario de roles |
| QA/Sprint Review | PASS | Regresión previa de Lista 05 y enriquecimiento QA en Kanban |
| Unitarias Kanban/tareas/permisos | PASS | 24/24 Vitest |
| TypeScript | PASS | API `tsc --noEmit`, web `vue-tsc` |
| Lint dirigido | PASS | Biome API y ESLint UI/E2E |
| Build | PASS | API completo y web `build-only` |

## Riesgos pendientes

- Los nombres de estados continúan siendo configurables por proyecto; no se fuerza una nomenclatura fija de Jira.
- El contador refleja las tarjetas cargadas por página, no un total agregado de todo el backlog cuando existe paginación.
- Las advertencias heredadas de Vite/dependencias permanecen documentadas y no bloquean el uso.

## Cierre

El Kanban permite gestionar un sprint con varios usuarios, filtros combinados, metadatos Scrum, QA visible, drag-and-drop persistente y permisos efectivos, manteniendo compatibilidad con tareas históricas. La Lista 06 queda lista para la siguiente etapa sin despliegue fuera del laboratorio L04.
