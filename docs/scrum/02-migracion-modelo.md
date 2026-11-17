# Migraciones del modelo Scrum — Lista 02

## 1.75.0 — modelo inicial

`api/src/migrations/taskview/sql/1.75.0/0.scrum-model.sql` crea `tasks.scrum_epics` y agrega a `tasks.tasks` el tipo, la asociación opcional a épica, criterios de aceptación y referencia de elemento afectado. Conserva IDs y contenido previos; el default asigna `task` a registros existentes. Constraints y claves foráneas compuestas preservan proyecto, tipo y relaciones. El archivo histórico no se modificó en esta etapa.

La migración 1.75.0 ya fue probada en dos destinos desechables PostgreSQL 17.12 de Lista 02, desde esquema 1.74.0 con datos sintéticos. Se verificaron identidad, ledger, versión, tipos, relaciones, constraints, índices y triggers históricos. La ejecución detallada precedente queda registrada en los artefactos y evidencias de Lista 02.

## 1.76.0 — claves legibles

Archivo: `api/src/migrations/taskview/sql/1.76.0/0.scrum-issue-keys.sql`; registro en `api/src/migrations/taskview/migrate.json`.

- Agrega `issue_key` a tareas y épicas sin cambiar IDs técnicos.
- Crea `tasks.scrum_issue_sequences`, contador transaccional compartido por proyecto.
- Backfill determinista `P<goalId>-<n>` para filas existentes; no cambia contenido ni referencias.
- Agrega `NOT NULL`, formato y unicidad por tabla/proyecto.
- Triggers `BEFORE INSERT OR UPDATE OF goal_id` asignan la siguiente clave al crear o mover. El trigger de tareas usa prefijo `zz_` para ejecutarse después de `before_insert_set_goal_id_for_task`; así, inserciones legacy que derivan el proyecto desde `goal_list_id` reciben la clave del proyecto ya asignado. El contador no decrece al archivar o eliminar; las claves no se reutilizan.

La validación final se hizo sobre `taskview_l02_final2_20261115`, clon de la base L02 1.75.0, con PostgreSQL 17.12, rol `l02synthetic`, red interna exclusiva y volumen dedicado. Antes de escribir se verificaron la base, servidor, system identifier `7708388125454340134` y versión inicial 1.75.0. La migración se aplicó con `psql -1` en una única transacción; se revisaron columnas, defaults, constraints, índices, función, orden de triggers, ledger y `app.version=1.76.0`. Un `INSERT` sintético omitió `goal_id` y usó una lista existente: el trigger histórico derivó `goal_id=880001` antes de asignar `P880001-6`. No se usó el migrador general porque su código ejecuta terminación de conexiones; no había conexiones ajenas en el destino, pero se eligió el camino transaccional acotado.

## Guardas y límites

El destino de prueba es exclusivamente `taskview_l02_final2_20261115` en `taskview-l02-scrum-db-20261115`. La red L02 es interna, la API de prueba solo se conectó a ese nombre de servicio y el contenedor API no montó volúmenes ni publicó puertos. El preflight positivo precedió las escrituras. No se tocaron la base original, laboratorio funcional, `taskview_l01`, recovery, BR07 ni scratch de Lista 01.

Antes de migrar una instancia posterior, ejecutar el preflight de padres de distinto proyecto documentado en el acta del modelo 1.75.0 y validar que no existan claves duplicadas o relaciones inconsistentes. `ALTER TABLE` y creación de índices pueden bloquear escrituras en bases grandes; esta base sintética no estima duración de locks para producción. La base de prueba es desechable, no una plantilla de despliegue.
