# Lista 12 — Pruebas funcionales integrales y estabilización Scrum

## Resultado

**PASS integral en el alcance ejecutado sobre L04.** No se inició Lista 13.

La validación se ejecutó contra el laboratorio aislado L04 (`taskview-l01-b5a7e65`), proyecto sintético 5, API `127.0.0.1:11725` y web `127.0.0.1:18888`. No se ejecutaron migraciones, no se tocaron bases protegidas, no hubo commits, push ni cambios de rama.

## Autenticación L04

Las cinco cuentas sintéticas ya existían. Se reutilizó el hash del fixture E2E existente para actualizar exclusivamente sus credenciales en L04: owner, editor, reader, multirrol y no-access. No se modificó el esquema ni se imprimieron contraseñas o tokens. Los cinco logins devolvieron HTTP 200.

Se añadió `auth.lista12.setup.ts`, que genera `test-results/.auth/l04-editor.json` con `storageState` usando variables de entorno. El archivo está excluido por `.gitignore` y no se incorpora al repositorio.

## Playwright ejecutado

| Suite | Resultado final |
|---|---|
| Scrum Lista 03 | 4/4 PASS |
| Kanban Lista 06 | 1/1 PASS |
| Reportes/QA/permisos Lista 12-B | 5/5 PASS, incluyendo setup auth |
| Dashboard | 1/1 PASS; 2/2 contando setup auth |
| Sprint Review/retrospectiva | 1/1 PASS; 2/2 contando setup auth |
| **Casos funcionales únicos** | **12/12 PASS** |

La suite de reportes verificó navegación, filtros, CSV, XLSX y permisos. La prueba QA verificó creación de historia, revisión observada, observación, aprobación y persistencia. La prueba de ciclo verificó creación de sprint, activación, Review, resumen, retrospectiva, acción y persistencia. No hubo SKIPPED en las ejecuciones autenticadas finales.

## Matriz funcional

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Épicas: crear, editar, archivar y consultar | PASS | Playwright Scrum 4/4; flujo L04 CRUD y archivo. |
| Historias, tareas, subtareas y bugs | PASS | Flujo Scrum L04 con persistencia y relaciones. |
| Jerarquías, backlog y filtros | PASS | Suite Lista 03: filtros, recarga y relaciones. |
| Sprints, planificación y responsables | PASS | Planning validado en flujo Scrum; ciclo de sprint validado por API autenticada. |
| Story Points y estados/Kanban | PASS | Kanban Lista 06 1/1 y Lista 03 4/4; estados L04 parametrizados 13/14. |
| QA, observaciones y aprobación | PASS | Caso E2E/API específico 1/1. |
| Sprint Review y retrospectiva | PASS | Caso de ciclo L04 1/1; estado `review` y retro persistidos. |
| Historial y trazabilidad | PASS | Suite Lista 03 verifica historial tras edición y recarga. |
| Dashboard Scrum | PASS | Caso Dashboard L04 1/1. |
| Reportes, filtros y exportaciones | PASS | UI/API 3/3: tipo, CSV no vacío, XLSX ZIP válido. |
| Permisos y aislamiento entre proyectos | PASS | Reader/no-access 403; editor/multirrol escriben; scopes API y proyecto externo rechazados. |

## Defectos encontrados y correcciones

1. La prueba Kanban usaba por defecto IDs de estados del laboratorio Lista 03 (`4/5`), incompatibles con L04 (`13/14`). Se corrigió la configuración de ejecución para descubrir y utilizar los estados reales del proyecto L04.
2. La prueba de permisos usaba `l03-multi@example.invalid`; L04 utiliza `l04-multi@example.invalid`. Se corrigió la configuración de perfiles sintéticos.
3. La pantalla de reportes podía iniciar sin proyecto cargado al navegar directamente por URL y quedaba bloqueada antes de cargar el reporte. Se añadió carga directa del proyecto, fallback de estado de ruta y carga diferida de permisos; el servidor mantiene la autorización y devuelve 403 cuando corresponde.
4. La imagen web L04 activa era anterior a la pantalla de reportes. Para la prueba visual se sirvió temporalmente el build local corregido en el puerto L04 permitido por CORS; después se restauró el contenedor web original. El API y la base permanecieron en L04.

No se detectaron defectos críticos abiertos en los escenarios ejecutados.

## Validación técnica

| Control | Resultado |
|---|---|
| API type-check | PASS |
| Web typecheck | PASS |
| DB schemas build | PASS |
| taskview-api package build | PASS |
| API build | PASS |
| Web build | PASS |
| Unitarias focalizadas Lista 01/02 | PASS, 24/24 |
| Pruebas GitLab unitarias Lista 10 | PASS, 3/3 |
| API reportes CSV/XLSX | PASS |
| API permisos de reportes | PASS |
| Estado final L04 API/web/DB | PASS; contenedores activos |

Las advertencias de Vite sobre imports dinámicos, chunks grandes y API CJS son no bloqueantes y preexistentes.

## Archivos modificados en Lista 12-B

- `web/src/pages/user/scrum-reports.vue`
- `web/e2e/auth.lista12.setup.ts`
- `web/e2e/scrum.lista12.reports.spec.ts`
- `web/playwright.lista12.config.ts`
- `docs/scrum/12-pruebas-funcionales-estabilizacion.md`

Los demás cambios del árbol de trabajo pertenecen a Listas anteriores y fueron conservados.

## Riesgos residuales

- La imagen Docker web L04 que estaba desplegada al inicio no contenía la pantalla de reportes; el código corregido está validado en build local contra API L04, pero requiere reconstrucción/despliegue controlado para quedar servido por el contenedor web.
- Persisten advertencias heredadas de bundling; no afectan typecheck, build ni pruebas funcionales.
- No se validó GitLab institucional ni se requirieron sus credenciales.

## Recomendación

Lista 12 queda **PASS integral** en el laboratorio L04 para el código y escenarios ejecutados. No iniciar Lista 13 automáticamente. Antes de cualquier promoción, reconstruir la imagen web L04 con el código corregido y repetir el smoke de reportes contra esa imagen desplegada.
