# Lista 10 — Integración GitLab FOVIPOL

Fecha: 2026-11-16  
Entorno: laboratorio L04 aislado (`taskview-l01-b5a7e65`). No se modificaron L02, producción ni repositorios GitLab.

## Resultado ejecutivo

La arquitectura existente de integraciones ya soporta GitLab mediante OAuth, almacenamiento cifrado de tokens, asociación por proyecto y consulta de repositorios. Se implementaron controles mínimos para operar contra una instancia institucional en modo solo lectura:

- `GITLAB_BASE_URL`: URL raíz HTTPS de GitLab.
- `GITLAB_ALLOWED_HOSTS`: lista explícita de hosts permitidos, separada por comas.
- `GITLAB_API_URL`: opcional; debe usar HTTPS y el mismo host configurado.
- `GITLAB_READ_ONLY=true`: solicita scope OAuth `read_api`, bloquea webhooks y actualizaciones de incidencias remotas.

No se añadió migración: `tasks.integrations` ya conserva proveedor, proyecto, repositorio, token cifrado y metadatos públicos.

## Arquitectura reutilizada

- Rutas: `/module/integrations`.
- Autorización: `INTEGRATIONS_CAN_VIEW` y `INTEGRATIONS_CAN_MANAGE`, resueltos por proyecto.
- Proveedor: `api/src/tv-modules/integrations/providers/gitlab.provider.ts`.
- Orquestación: `IntegrationsManager`.
- Persistencia: `IntegrationsRepository` y `tasks.integrations`.
- Cliente frontend existente: `TvIntegrationsApi`, `integrations.store.ts` y página de integraciones.
- Asociaciones de incidencias: `tasks.integration_task_map`.

Los tokens OAuth continúan cifrándose con el mecanismo existente (`encrypt`/`decrypt`) y nunca forman parte de `IntegrationPublic`, respuestas HTTP ni listados frontend.

## Controles de seguridad incorporados

1. La URL GitLab debe ser HTTPS, sin credenciales embebidas, ruta/query/hash no permitidos y host incluido explícitamente en `GITLAB_ALLOWED_HOSTS`.
2. La URL de API debe usar HTTPS y coincidir con el host GitLab configurado; una URL arbitraria no puede activar SSRF.
3. `GITLAB_READ_ONLY=true` utiliza `read_api` en OAuth y rechaza creación de webhooks y cambios de estado de issues.
4. Las comprobaciones de permisos siguen resolviéndose contra el proyecto TaskView; el acceso GitLab no amplía permisos Scrum.
5. Los errores del proveedor se convierten en respuestas controladas y no exponen tokens.

Configuración prevista para FOVIPOL (valores de ejemplo, sin secretos):

```text
GITLAB_BASE_URL=https://repositorio.fovipol.gob.pe
GITLAB_ALLOWED_HOSTS=repositorio.fovipol.gob.pe
GITLAB_API_URL=https://repositorio.fovipol.gob.pe/api/v4
GITLAB_READ_ONLY=true
```

La instancia OAuth también requiere `GITLAB_INTEGRATION_CLIENT_ID`, `GITLAB_INTEGRATION_CLIENT_SECRET` y `GITLAB_INTEGRATION_CALLBACK_URL` gestionados por secretos del entorno. No se registraron valores reales.

## Evidencia de conectividad L04

- DNS desde el contenedor API: `repositorio.fovipol.gob.pe` resolvió a `192.168.10.39`.
- HTTPS/TLS: `curl` desde el contenedor recibió HTTP 302 hacia `/users/sign_in`; no se desactivó la validación TLS.
- `/api/v4/version` sin autenticación: HTTP 401, comportamiento esperado para una instancia protegida.

## Pruebas ejecutadas

| Prueba | Resultado | Evidencia |
|---|---|---|
| URL institucional HTTPS permitida | PASS | Prueba unitaria del proveedor |
| Scope OAuth de solo lectura | PASS | `read_api` cuando `GITLAB_READ_ONLY=true` |
| Host no permitido | PASS | Importación/configuración rechazada fail-closed |
| Escritura remota en modo readonly | PASS | Webhook y actualización de issue rechazados |
| Permisos TaskView de integración | PASS | Lector sin permiso: HTTP 403 en `/module/integrations` |
| Proyecto sin acceso | PASS | Aislamiento de permisos existente; cubierto por pruebas de acceso de integraciones |
| API typecheck | PASS | `pnpm --dir api run type-check` |
| API build | PASS | `pnpm --dir api run build:docker` |
| Unitarias regresión Lista 01/02 | PASS | 24/24 |
| Unitarias Lista 10 | PASS | 3/3 (`gitlab.provider.lista10.spec.ts`) |
| Web typecheck | PASS | `pnpm --dir web run typecheck` |
| Suite SDK PostgreSQL `integrations-access` | BLOCKED | Guard de pruebas exige `L01_TEST_DB_*` y scratch autorizado; no se usó una base protegida |
| Listado real de repositorios FOVIPOL | BLOCKED | No existe token/cliente OAuth institucional autorizado en este entorno |
| Asociación real a repositorio FOVIPOL | BLOCKED | Requiere repositorio de prueba y credencial de solo lectura expresamente autorizados |

El endpoint de integración existente mantiene el control de escritura: el usuario sintético lector recibió HTTP 403. El editor sintético tampoco tiene `integrations_can_manage` asignado en el proyecto L04, por lo que no se alteraron permisos del laboratorio para forzar una aprobación artificial.

## Compatibilidad

- No se modificaron `/module/tasks`, Scrum, QA, Kanban, Sprint Planning ni Sprint Review.
- No se cambió el esquema 1.78.0 ni se creó migración.
- Las funciones históricas de sincronización GitLab siguen disponibles cuando `GITLAB_READ_ONLY` no está activo; el modo readonly evita únicamente escrituras remotas.
- Los identificadores Scrum y las relaciones existentes no se modifican al retirar una integración.

## Riesgos y pendientes

- La integración institucional no puede declararse funcional de extremo a extremo hasta disponer de un repositorio de prueba autorizado y un token/cliente OAuth con alcance mínimo.
- El flujo actual de autenticación GitLab es OAuth; no se añadió un endpoint para aceptar PAT arbitrarios, evitando introducir una nueva superficie de almacenamiento de secretos.
- La prueba SDK PostgreSQL requiere su scratch guardado y variables privadas; se dejó bloqueada deliberadamente para no tocar bases protegidas.

## Cierre

**Estado de Lista 10: BLOCKED para PASS integral.** Los controles de configuración, SSRF, modo readonly, cifrado y permisos están implementados y probados. Falta únicamente ejecutar con autorización institucional real el listado y la asociación de un repositorio GitLab de prueba; no se debe simular ese resultado como PASS.
