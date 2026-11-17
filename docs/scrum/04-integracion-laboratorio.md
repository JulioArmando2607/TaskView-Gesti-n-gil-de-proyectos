# Lista 04 — Integración segura al laboratorio funcional

Fecha de cierre: 2026-11-16. Trabajo local, sin commit, push, merge ni conexión remota.

## Entorno y protección

Se intervino únicamente el proyecto Docker `taskview-l01-b5a7e65`:

- API: `127.0.0.1:11725`, contenedor `taskview-l01-b5a7e65-api-1`.
- Web: `127.0.0.1:18888`, contenedor `taskview-l01-b5a7e65-web-1`.
- PostgreSQL 17.12: contenedor `taskview-l01-b5a7e65-db-1`, base `taskview_l01`, volumen `taskview-l01-b5a7e65_pgdata` y red Compose privada.
- Imágenes desplegadas: `taskview-l04-api:20261116` (`sha256:07d2bfbc...`), `taskview-l04-web:20261116` (`sha256:750c8207...`).

No se tocaron los contenedores BR07, test, recovery, la instalación original ni las bases L02. La referencia `taskview_l02_final2_20261115` se comprobó al cierre: usuario 990001 presente, organización 990001 presente y 33 tareas.

Antes de escribir se creó el respaldo lógico personalizado:

```text
C:\Users\jvega\AppData\Local\Temp\taskview-l04-backup-20261116-081055\taskview_l04_pre.dump
SHA-256: 36A4A0BBB6A9B466EEE5CB263117E5B3899B476734FC7E018D711AE781878D2E
TOC: 776 entradas; formato CUSTOM; PostgreSQL 17
```

La configuración Compose y el `docker inspect` de los tres contenedores se conservaron en la misma carpeta temporal. No se registraron valores de secretos.

## Línea base y migración

La línea base funcional era versión 1.74.0, con 2 organizaciones, 2 usuarios, 4 proyectos, 18 tareas y 1 sprint. Las comprobaciones previas no encontraron padres huérfanos, `goal_id` nulos ni relaciones padre-hijo entre proyectos.

Se ejecutaron 1.75.0 y 1.76.0 con código de salida 0. La base quedó en 1.76.0 con 8 constraints Scrum, 5 índices Scrum, 2 triggers de claves, 18 tareas históricas de tipo `task`, 18 claves únicas y 0 épicas iniciales.

El primer backfill de 1.76.0 activó los triggers históricos existentes y produjo 18 cambios artificiales de `edit_date` y 18 entradas de historial. Se detectó mediante comparación con la restauración, se reparó en una transacción acotada usando el respaldo y se volvió a comparar: las filas históricas 1–18, proyectos, organizaciones, usuarios y sprint coinciden por hash; las 18 entradas artificiales fueron eliminadas y las 20 entradas históricas originales se conservaron.

Para evitar que vuelva a ocurrir, el SQL 1.76.0 local fue corregido para suspender temporalmente triggers de usuario durante el backfill. La versión segura se construyó como `taskview-l04-migration:20261116-safe` (`sha256:98e538a7...`) y se configuró en `docs/auditoria-taskview/entorno/l04.compose.yaml`. Se probó en un PostgreSQL L04 nuevo restaurado desde el respaldo: historial 20, claves 18/18 únicas y hash de `edit_date` idéntico al preestado.

## Datos sintéticos de integración

Se creó en el laboratorio un proyecto aislado `L04 Synthetic Scrum Project` dentro de `l04-synthetic-org`, con estados TODO/In Progress/Done, sprint `L04 Synthetic Sprint` y cinco cuentas sintéticas (owner, reader, editor, multirrol y no-access). No se copiaron datos institucionales.

## Validación ejecutada

| Control | Resultado | Evidencia |
|---|---|---|
| Backup y restauración | PASS | `pg_restore --list` (776 entradas) y restauración completa en `taskview-l04-recovery-db-20261116`; versión 1.74.0, 2 organizaciones, 4 proyectos, 18 tareas, 1 sprint. |
| Migración 1.75/1.76 | PASS | Exit 0; versión 1.76.0; constraints, índices, FKs, defaults y triggers presentes. |
| Migración segura futura | PASS | Base `taskview-l04-migration-check-db-20261116`, imagen `20261116-safe`; historial 20, hash `edit_date` igual al preestado. |
| E2E Scrum integrado | PASS | 4/4 en la primera ejecución y 4/4 tras la reparación (18,5 s): CRUD/archivo, relaciones/subtareas/sprint, filtros/recarga/historial, Kanban y permisos/scopes. |
| Regresión unitaria | PASS | 24/24: `TaskMovePlanner` 11/11, permisos combinados 2/2, mass assignment 5/5, Kanban 6/6. |
| `/module/tasks` histórico | PASS | Login sintético y consulta con proyecto/lista válidos: HTTP 200. |
| Conservación histórica | PASS | Hashes iguales para organizaciones 1–2, usuarios 1–2, proyectos 1–4, sprint 1 y tareas 1–18; todas conservan `work_item_type=task`. |
| L02 de referencia | PASS | Usuario 990001, organización 990001 y 33 tareas sin cambios. |
| Typecheck | PASS | API `tsc --noEmit` y web `vue-tsc` sin diagnósticos. |
| Lint dirigido | PASS | Biome API y ESLint web sobre archivos afectados sin diagnósticos. |
| Build | PASS | Build API/migrador y `build:webapp` completados; solo advertencias heredadas de chunks grandes/import dinámico. |
| HTTP 500 / estabilidad | PASS | API, web y DB activos; 0 coincidencias de 500/error en logs recientes posteriores a E2E. |
| Integración PG L02 existente | NOT RUN | La guardia exigió el destino/puerto L02 protegido y rechazó la ejecución; no se relajó la guardia ni se apuntó al laboratorio. |

## Recuperación reproducible

1. Detener solo API/web del proyecto `taskview-l01-b5a7e65` si fuera necesario; no usar `down -v`.
2. Crear un PostgreSQL nuevo con red y volumen nuevos, como `taskview-l04-recovery-db-20261116`.
3. Copiar el dump desde la carpeta temporal y ejecutar `pg_restore --exit-on-error --clean --if-exists --no-owner` con credenciales sintéticas.
4. Verificar identidad de base, versión, conteos y hashes antes de cualquier prueba.
5. Para una reversión del laboratorio, restaurar el dump en una base/volumen nuevo y cambiar el destino Compose explícitamente; no sobrescribir el volumen protegido original.

## Riesgos y pendientes

- La guardia de integración PostgreSQL L02 quedó NOT RUN por diseño; no es un fallo de la integración L04.
- El lint global conserva diagnósticos históricos de Lista 01; el lint dirigido de archivos intervenidos pasa.
- La corrección del backfill debe mantenerse en cualquier imagen de migración posterior a 1.76.0; no se ejecutó una nueva migración sobre el laboratorio porque ya estaba en 1.76.0.

## Cierre

Lista 04 queda **PASS** en el laboratorio funcional aislado: migración aplicada, API/web integradas, datos históricos conservados, E2E y regresiones críticas satisfactorias y recuperación verificada. No se inicia Lista 05.
