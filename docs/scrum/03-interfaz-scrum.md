# Lista 03 — Interfaz Scrum

## Implementación

- Se añadió la ruta de proyecto `/:orgSlug/:projectId/scrum` y accesos en la barra lateral y la navegación móvil, condicionados al permiso de lectura de tareas.
- La API TypeScript `scrum` implementa los contratos existentes de `/module/scrum`; no se agregaron endpoints ni migraciones.
- Backlog con épicas expandibles, historias relacionadas, subtareas, historias sin épica, tareas y bugs. Incluye búsqueda, filtro por tipo, claves legibles, detalle editable, responsable, prioridad, estado, estimación, criterios de aceptación en texto y relación opcional de bug.
- El historial se abre en el detalle histórico existente. Archivar una épica usa `DELETE /module/scrum/epics/:epicId` y confirma que las historias se conservan.
- Sprint Planning selecciona elementos raíz y usa `sprints.setTaskSprint`; respeta `SPRINT_CAN_VIEW` y `SPRINT_CAN_ASSIGN_TASKS`. La cifra mostrada suma las estimaciones de la selección; la carga total y capacidad permanecen en la planificación de sprints existente.
- La pestaña Kanban reutiliza `KanbanBoard`, sus columnas, reglas, permisos y persistencia de orden. No se replica ni modifica la lógica drag & drop.
- No se incorpora un estado QA artificial. Se presentan estados existentes y bugs tipados; la validación QA sigue dependiendo de los flujos ya soportados por el proyecto.
- Se corrigió el modal conservando `UModal`: los valores vacíos de `USelect` se sustituyeron por un sentinel interno no vacío. Reka UI reserva `''` para limpiar la selección; usarlo en `SelectItem` generaba excepciones y dejaba un árbol Vue incompleto durante el cierre.
- El guardado ignora reenvíos mientras hay una operación en curso, cierra el modal después del 201 y espera la recarga del backlog. La prueba usa doble clic sobre Guardar y confirma una sola tarea persistida.
- La integración embebida de Kanban conserva columnas ya cargadas para el mismo proyecto y carga sus tarjetas cuando el tablero se monta después de obtener los estados.

## Seguridad de interfaz

Los controles se muestran según permisos efectivos del proyecto. La edición acepta `COMPONENT_CAN_EDIT` o el permiso legado `COMPONENT_CAN_EDIT_ALL_TASKS`; asignar responsable requiere `TASK_CAN_ASSIGN_USERS`; sprint planning requiere los permisos existentes de sprints. Cuando el usuario no puede cambiar responsable, el campo también se omite del payload de edición. La API sigue siendo la autoridad final.

La ruta carga el proyecto mediante consultas protegidas existentes; las rutas y respuestas legacy permanecen intactas. El historial se deja al módulo de tareas existente.

## Validación

| Control | Resultado | Evidencia |
|---|---|---|
| Typecheck web | PASS | `pnpm --filter web-nuxt-ui typecheck` |
| Build web | PASS | `pnpm --filter web-nuxt-ui build-only`; Vite produjo el chunk lazy `scrum`. Persiste el aviso heredado sobre imports dinámicos/estáticos de Axios y tamaño de chunk. |
| Lint dirigido | PASS | ESLint sobre página Scrum, `KanbanBoard` y suite E2E. |
| Entorno aislado | PASS | API temporal `127.0.0.1:14103` conectada a la copia nueva `taskview_l03_e2e_20261116`. La referencia `taskview_l02_final2_20261115` solo se leyó mediante `pg_dump`. PostgreSQL 17.12, system identifier `7708388125454340134`, red privada y volumen desechable sin puerto PostgreSQL publicado. |
| Backlog, navegación y filtros | PASS | Jerarquía visible, búsqueda, filtro por tipo y recarga con persistencia. |
| Épicas | PASS | Crear, consultar, editar y archivar. La historia vinculada permanece visible tras archivar. |
| Historias | PASS | Crear, editar título y criterios, asociar a épica, planificar en sprint y verificar persistencia por API. El modal cierra sin `pageerror`. |
| Tareas y bugs | PASS | Tarea independiente creada y editada con protección ante doble envío; bug creado, relacionado a la historia, editado y verificado por API. |
| Subtareas | PASS | Crear, mostrar bajo la historia, editar y comprobar `parent_id` persistido. |
| Sprint Planning | PASS | Seleccionar historia raíz, asignarla al sprint sintético y comprobar el resultado visible. |
| Kanban | PASS | Tarjeta raíz cargada, arrastrada con puntero de TODO a In Progress, estado comprobado por API y órdenes raíz sin duplicados. |
| Historial | PASS | El detalle editable abre la ruta histórica existente del elemento y conserva su identificador. |
| Permisos | PASS | Navegador: solo lectura sin controles de creación; editor y multirrol con creación visible. Backend: lectura rechaza escritura, editor y multirrol reciben 201, usuario sin acceso recibe 403. |
| Scopes API | PASS | Token limitado a lectura/proyecto: GET 200 y POST 403. Token limitado a otro proyecto: GET 403. |
| Playwright Lista 03 | PASS | 4 escenarios independientes, 4 PASS, 0 FAIL, 0 NOT RUN; ejecución final 42.3 s en Edge local. |
| Regresión movimiento | PASS | `TaskMovePlanner.spec.ts`: 11/11 PASS. |

Node 24.22.2 y pnpm 10.28.1 se usaron desde la instalación portable bajo `%TEMP%`. Las credenciales sintéticas se inyectaron solo al proceso de prueba y no se registran en este documento. El laboratorio funcional, las bases protegidas y la instalación original no se usaron ni modificaron. Los registros generados permanecen únicamente en la copia L03 para conservar evidencia reproducible.

## Pendientes no bloqueantes

- La interfaz mantiene criterios de aceptación como texto y usa los estados configurados del proyecto; no se añadieron estados QA ni endpoints que el backend no soporte.
- Permanecen los avisos históricos del build sobre imports estáticos/dinámicos de Axios y tamaño de chunks.

Lista 03 queda técnicamente validada y lista para preparar Lista 04. Esto no autoriza desplegar en el laboratorio funcional; la integración debe conservar su propia revisión y guardias de destino.
