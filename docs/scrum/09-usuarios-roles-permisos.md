# Lista 09 — Usuarios, roles y permisos avanzados Scrum

Fecha de validación: 2026-11-16  
Entorno: laboratorio funcional aislado L04 (`taskview-l01-b5a7e65`), proyecto sintético 5. No se escribieron L02, producción ni bases protegidas.

## Resultado

El modelo de autorización existente es suficiente para Scrum: los permisos se resuelven por proyecto mediante colaboración y roles, se combinan (OR) entre varios roles y se intersectan con los scopes del token API. No fue necesario crear usuarios, tablas ni migraciones nuevas.

Se corrigió una brecha puntual en `api/src/tv-modules/collaboration/middlewares/CanToggleRolesCollaboration.ts`: un gestor de colaboración podía enviar el `PATCH /module/collaboration` sobre sí mismo. Los gestores siguen pudiendo administrar a otros miembros; la auto-modificación queda restringida al propietario del proyecto.

## Modelo reutilizado

- Usuarios y pertenencia: `collaboration.users`, `collaboration.users_to_goals`.
- Roles por proyecto: `collaboration.roles` y `collaboration.users_to_roles`.
- Permisos de rol: `collaboration.permissions_to_role` y `tv_auth.permissions`.
- Resolución efectiva: `GoalPermissionsFetcher` + `GoalPermissionsChecker`.
- Scopes API: la resolución efectiva intersecta los permisos del proyecto con los permisos y objetivos autorizados por el token.
- Gestión de integrantes: `/module/collaboration`.
- Gestión de roles/permisos: `/module/collaborationroles`.
- Trazabilidad: el sistema emite `collaboration.rolesChanged` y conserva la gestión existente; no se creó una tabla de auditoría de permisos en esta lista.

No se duplicó el sistema de autenticación ni se introdujeron roles globales Scrum.

## Matriz funcional

| Perfil Scrum | Implementación actual y alcance |
|---|---|
| Administrador | Propietario del proyecto; puede administrar integrantes, roles y permisos del proyecto. No implica privilegios globales fuera del proyecto. |
| Product Owner | Debe mapearse a un rol de proyecto con `component_can_watch_content`, `component_can_edit`, permisos de backlog y la capacidad de aceptación funcional existente. |
| Scrum Master | Rol de proyecto con `sprint_can_view`, `sprint_can_manage`, `sprint_can_assign_tasks` y permisos de seguimiento/Kanban necesarios. |
| Desarrollador | Rol `executor` o equivalente: lectura de trabajo, asignación permitida por el rol y capacidades de ejecución concedidas por permisos concretos. |
| QA | No existe un rol global QA separado; el flujo QA existente usa los permisos de edición/lectura del proyecto. Puede representarse con un rol de proyecto dedicado sin cambiar el backend. |
| Lector | Rol `l04-reader`/`reader`: lectura de contenido e historial permitido, sin creación ni modificación. |

Las capacidades son permisos, no nombres de rol. Un usuario multirrol recibe la unión de permisos de sus roles dentro del mismo proyecto, nunca privilegios de otro proyecto.

## Evidencia L04

Roles observados en el proyecto 5: `l04-editor`, `l04-executor`, `l04-reader`.

Usuarios sintéticos: `l04-owner`, `l04-editor`, `l04-multi`, `l04-reader` y `l04-noaccess`.

La consulta de base confirmó:

- `l04-editor`: permisos de edición, backlog, Kanban, sprints y administración de usuarios del proyecto.
- `l04-multi`: unión de `l04-editor` y `l04-executor`.
- `l04-reader`: permisos de lectura, sin permisos de escritura.

## Escenarios de seguridad

| Escenario | Resultado | Evidencia |
|---|---|---|
| Editor consulta épicas | PASS | `GET /module/scrum/goals/5/epics` exitoso |
| Lector consulta épicas | PASS | lectura permitida |
| Sin acceso consulta épicas | PASS | HTTP 403 |
| Lector crea épica | PASS | HTTP 403 |
| Editor crea tarea Scrum | PASS | creación autorizada |
| Multirrol crea tarea Scrum | PASS | creación autorizada por permisos combinados |
| Lector modifica roles | PASS | HTTP 403 |
| Editor crea rol de proyecto | PASS | HTTP 403; la creación de roles queda restringida al propietario |
| Editor se asigna roles a sí mismo | PASS | HTTP 403 después de la corrección |
| Editor administra a otro miembro | PASS | endpoint existente conserva la capacidad proyecto‑alcance |
| Token API con scope de lectura | PASS | E2E Lista 03: GET permitido y POST rechazado |
| Token API con scope insuficiente/otro proyecto | PASS | E2E Lista 03: HTTP 403 |

La suite Playwright de permisos existente (`scrum.lista03.flow.spec.ts`) terminó 4/4 PASS, incluyendo lector, editor, multirrol, sin acceso y scopes API.

## Validación técnica

- API typecheck: PASS.
- API build: PASS (`pnpm --dir api run build:docker`, con advertencias no bloqueantes de Vite).
- Unitarias Lista 01/02: PASS, 24/24.
- Web typecheck: PASS.
- Web build: PASS.
- Lint dirigido del middleware modificado: PASS.
- Regresión E2E Scrum/permisos: PASS, 4/4.

No se modificó ninguna migración ni se ejecutaron escrituras SQL directas durante esta lista. El build local de la API se cargó únicamente en el contenedor L04 aislado para probar la regla de auto‑escalamiento.

## Compatibilidad y riesgos

- `/module/tasks`, Sprint Planning, Kanban, QA, Sprint Review, retrospectiva e historial mantienen sus rutas y permisos existentes.
- No existe una taxonomía persistida de nombres `Product Owner`, `Scrum Master`, `QA` o `Developer`; se administran mediante roles de proyecto y permisos. Esto evita duplicar el sistema original, pero deja pendiente una UX de plantillas de roles si se desea en una etapa futura.
- La administración de roles usa permisos de colaboración existentes; únicamente la autoasignación no autorizada fue bloqueada.
- La trazabilidad persistente detallada de cada cambio de rol sigue dependiendo del mecanismo/evento de colaboración existente; una bitácora específica de permisos queda fuera de alcance.
- Las advertencias heredadas de lint/build no relacionadas con este cambio permanecen como deuda previa y no afectan la autorización validada.

## Cierre

Lista 09: **PASS** para autorización efectiva, múltiples roles, scopes API y separación por proyecto en el alcance probado. No requiere migración. La siguiente etapa puede abordar, si se solicita, plantillas visuales de roles Scrum sin reemplazar el modelo de permisos actual.
