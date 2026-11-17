# API Scrum — Lista 02

La ruta base es `/module/scrum`. Todas las rutas requieren `IsLoggedIn` y permisos del proyecto. Se mantienen los contratos existentes de `/module/tasks`.

## Endpoints

| Método y ruta | Operación |
|---|---|
| `GET /goals/:goalId/epics` | Listar épicas del proyecto. |
| `POST /goals/:goalId/epics` | Crear con `{title, details?}`. |
| `GET /epics/:epicId` | Consultar épica. |
| `PATCH /epics/:epicId` | Editar `title` y/o `details`. |
| `DELETE /epics/:epicId` | Archivar lógicamente. |
| `GET /epics/:epicId/stories` | Consultar historias asociadas. |
| `GET /goals/:goalId/items?type=story|task|bug&epicId=none&parentId=none&limit=&offset=` | Listar y filtrar elementos. |
| `POST /goals/:goalId/items` | Crear historia, tarea o bug. `type` omitido equivale a `task`. |
| `GET /items/:taskId` | Consultar elemento. |
| `PATCH /items/:taskId` | Editar contenido, prioridad, responsable, estado, estimación, sprint o relaciones. `epicId:null` y `relatedTaskId:null` desasocian. |
| `GET /items/:taskId/subtasks` | Consultar hijos directos. |

Para elementos, `description` es el título y `note` el detalle. Se conservan campos y formas de respuesta históricas; las épicas responden aliases camelCase y las tareas conservan la fila histórica saneada según permisos. `issueKey` queda disponible en las respuestas. Las claves de proyecto son `P<goalId>-<n>`.

## Seguridad

Lectura requiere `COMPONENT_CAN_WATCH_CONTENT`; crear requiere `COMPONENT_CAN_ADD_TASKS`; editar y archivar requieren `COMPONENT_CAN_EDIT` o `COMPONENT_CAN_EDIT_ALL_TASKS`. Cambios de responsable y asignación a sprint aplican permisos existentes. El acceso se calcula mediante `GoalPermissionsFetcher`, que conserva la combinación de roles, colaboración/sesión y scopes de tokens actuales. No se agregan scopes.

La prueba HTTP usa tokens limitados: el scope de lectura permite GET, bloquea creación y no concede acceso a otro proyecto. La falta de autenticación devuelve 401. El cuerpo de respuestas de errores de proyecto usa categorías genéricas para no revelar recursos ajenos.

## Integridad, concurrencia y movimiento

Las FK/constraints de 1.75.0 impiden asociaciones de otro proyecto y tipos incompatibles; 1.76.0 añade claves legibles únicas. La API revalida relaciones dentro de transacciones antes de escribir. Historias solo se enlazan a épicas del mismo proyecto no archivadas. Bugs pueden enlazar historias o tareas del proyecto y existir sin relación.

`parent_id` usa un advisory lock transaccional común en las rutas legacy, Scrum, importación, restauración y movimientos. Bajo ese lock se valida recursivamente el proyecto de cada ancestro y se detectan ciclos. Los conflictos se devuelven como 409 en la ruta legacy y 400 `invalid_parent` al crear por Scrum. Estado/Kanban y asignación inicial de orden también calculan el siguiente orden bajo el mismo protocolo.

El movimiento de una raíz que dejaría subtareas atrás o que cruza vínculos incompatibles de épica/bug se rechaza con error de dominio genérico. No borra relaciones y no deja escrituras parciales. Un movimiento compatible transfiere el subárbol completo autorizado en una transacción y actualiza las claves de proyecto; no deja hijos atrás.

## Sprints y compatibilidad

Épicas están en una tabla separada y no aparecen en planificación. Historias, tareas y bugs raíz pueden asignarse con la ruta de sprint actual; las subtareas no se planifican directamente. Las consultas legacy `/module/tasks`, el historial existente y campos de estado, prioridad, responsable y estimación se conservan. No se modificaron Review, Retrospectiva ni el diseño visual.

## Restricciones

`acceptanceCriteria` se guarda en el campo de texto `acceptance_criteria`. La API no interpreta criterios estructurados. El prefijo de clave legible no es configurable; usa `P<goalId>`. El listado está paginado mediante `limit` y `offset`, con máximo 500 por página. No existe borrado físico de épicas desde el API Scrum.
