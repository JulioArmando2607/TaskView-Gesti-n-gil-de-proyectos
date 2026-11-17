# Lista 11 — Reportes y seguimiento Scrum

## Alcance y entorno

Se implementó la sección de reportes Scrum reutilizando el módulo de analítica existente, los datos de sprints, QA, Sprint Review, retrospectivas y el modelo de tareas. La validación se realizó exclusivamente contra el laboratorio aislado L04 (`taskview_l01`, proyecto sintético 5); no se aplicaron migraciones ni escrituras en L02, producción o bases protegidas.

No se añadió una migración de esquema: los reportes son consultas agregadas sobre el modelo 1.78.0 existente.

## Funcionalidad implementada

- `GET /module/scrum/reports/:goalId/overview`: resumen, filas paginadas y agregados por sprint, responsable, QA, bugs y retrospectiva.
- `GET /module/scrum/reports/:goalId/export?format=csv|xlsx`: exportación de las filas filtradas.
- Filtros combinables por sprint, responsable, tipo, estado, prioridad y fechas (`from`/`to`); paginación limitada a 200 filas por consulta.
- Página web `/:projectId/reports`, accesible desde la navegación Scrum, con KPIs, tablas y botones CSV/XLSX.

Las historias y tareas se cuentan como elementos raíz para la planificación; las subtareas no duplican los conteos de compromiso. “Terminada” procede del estado de completado de la tarea y “aceptada” de la decisión de Sprint Review, por lo que ambas métricas se muestran separadas. El avance es `historias terminadas / historias comprometidas * 100`; si no hay comprometidas, el porcentaje es 0. El trabajo pendiente/trasladado se toma de los resultados de cierre del sprint. Los conteos por responsable son seguimiento operativo y no una evaluación automática de rendimiento.

La exportación CSV escapa campos y antepone una comilla simple a valores que podrían interpretarse como fórmulas (`=`, `+`, `-`, `@`). XLSX se genera como archivo ZIP válido con hoja de datos y conserva UTF-8.

## Seguridad

El controlador exige `SPRINT_CAN_VIEW_ANALYTICS` o `ANALYTICS_CAN_VIEW`, aplica autorización del proyecto mediante el mecanismo existente y parametriza todas las consultas. En L04, el editor autorizado obtuvo 200; el lector sin scope y el usuario sin acceso obtuvieron 403. No se exponen tokens ni credenciales.

## Archivos modificados

- `api/src/tv-modules/scrum-reports/ScrumReportsController.ts`
- `api/src/tv-modules/scrum-reports/ScrumReportsExport.ts`
- `api/src/tv-modules/scrum/ScrumRoutes.ts`
- `taskview-packages/taskview-api/src/api/scrum-reports.ts`
- `taskview-packages/taskview-api/src/api/scrum-reports.types.ts`
- `taskview-packages/taskview-api/src/tv.ts`
- `taskview-packages/taskview-api/src/index.ts`
- `web/src/pages/user/scrum-reports.vue`
- `web/src/bootstrap.ts`
- `web/src/components/sidebars/dashboard-second/SidebarTools.vue`
- `web/scripts/validate-lista11-reports.mjs`

## Evidencia de pruebas

| Control | Resultado | Evidencia |
|---|---|---|
| Datos y avance por sprint | PASS | Sprint sintético 2: BD y API coinciden: 16 comprometidas, 2 terminadas, 3 aceptadas, 14 pendientes, 12.5 %. |
| Seguimiento por responsable | PASS | Agregado `assignees` incluido en la respuesta y filtrable por `ownerId`. |
| Reporte QA y bugs | PASS | Respuesta incluye estados QA, revisiones y bugs; inventario total: 129 elementos (87 task, 30 story, 12 bug). |
| Filtros por tipo | PASS | Filtro story devuelve 30/30 historias; bug devuelve 12/12 bugs. |
| CSV | PASS | Exportación HTTP 200, archivo no vacío (17 376 bytes en L04). |
| XLSX | PASS | Exportación HTTP 200, archivo no vacío (8 526 bytes) y firma ZIP `PK`. |
| Permisos | PASS | Editor 200; lector y usuario sin acceso 403 para overview. |
| Integración API reproducible | PASS | `web/scripts/validate-lista11-reports.mjs` ejecutado contra L04: `Lista 11 reports PASS`. |
| Regresión unitarias | PASS | Vitest Lista 02: 24/24 pruebas. |
| Lint dirigido | PASS | Biome: 3 archivos revisados, sin cambios ni diagnósticos. |
| Typecheck/build API | PASS | `api` type-check y build Docker; `taskview-api` build satisfactorio. |
| Typecheck/build web | PASS | `vue-tsc` y `pnpm --dir web run build` satisfactorios; solo advertencias Vite heredadas. |
| Playwright existente | PASS | Regresión Scrum Lista 03 registrada previamente: 4/4; no se modificó ese flujo. |

La página nueva se compiló correctamente. No se declara una nueva suite Playwright específica de la página de reportes como evidencia adicional; la validación funcional de esta lista se basa en la prueba ejecutable API/exportación y en el build web. La cobertura visual específica queda como riesgo menor para la siguiente iteración si se exige una captura E2E dedicada.

## Riesgos y pendientes

- Los porcentajes dependen de los estados y decisiones registrados por los módulos existentes; no se crean estados nuevos.
- No se genera PDF, conforme al alcance.
- La integración GitLab de Lista 10 permanece independiente y no es requerida para estos reportes.
- Las advertencias históricas de Vite/lint global no fueron modificadas.

## Resultado

La funcionalidad de reportes Scrum queda disponible para datos reales del laboratorio aislado, con filtros, exportaciones y autorización de proyecto. No se realizaron commits, push, cambios de rama ni migraciones.
