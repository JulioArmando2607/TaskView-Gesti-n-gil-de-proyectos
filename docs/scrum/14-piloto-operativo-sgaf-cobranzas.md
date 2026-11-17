# Lista 14 — Piloto operativo Scrum SGAF–Cobranzas

## 1. Resultado ejecutivo

**PASS del piloto sintético en L04.** Se creó y utilizó exclusivamente el proyecto aislado `SGAF-Cobranzas - PILOTO L04` (ID `6`, nombre normalizado por TaskView), dentro de la organización sintética `L04 Synthetic Organization`. No se usó información institucional, no se modificaron proyectos existentes, no se ejecutaron migraciones, no se hicieron commits/push/cambios de rama y no se desplegó en producción.

El PASS acredita la operación del producto con datos sintéticos; no constituye validación del proyecto real SGAF–Cobranzas ni autorización productiva.

## 2. Configuración del proyecto y roles

| Responsabilidad | Cuenta sintética | Configuración |
|---|---|---|
| Product Owner | `l04-owner@example.invalid` | Owner del proyecto; permisos completos por propiedad |
| Programador Backend | `l04-editor@example.invalid` | Rol piloto `Programador Backend` |
| Programador Frontend | `l04-multi@example.invalid` | Rol piloto `Programador Frontend` |
| Responsable QA | `l04-multi@example.invalid` | Segundo rol simultáneo `Responsable QA` |
| Usuario lector | `l04-reader@example.invalid` | Rol piloto `Usuario lector` |
| Sin acceso | `l04-noaccess@example.invalid` | Invitado sintético sin rol, usado como control |

Se comprobó la asignación multirrol del usuario `l04-multi`. El usuario editor no pudo crear el proyecto y recibió `403`; la creación se efectuó con el owner, confirmando la protección de escritura.

## 3. Datos funcionales ejecutados

Se creó la épica **Gestión de cartera de cobranza** y una HU-01 sintética con el objetivo de cargar y actualizar una cartera por periodo. La historia conservó criterios de aceptación verificables, estimación de **8 Story Points** y responsable. Se crearon las tareas:

1. Implementación backend.
2. Desarrollo frontend.
3. Integración de servicios.
4. Pruebas funcionales.
5. Validación y aprobación QA.

Se registró un bug vinculado a HU-01, con prioridad alta, responsable y seguimiento independiente del sprint. El flujo se ejecutó con identificadores `L04-PILOTO-*` para distinguirlo de cualquier dato previo.

## 4. Sprint, Kanban y QA

La suite E2E del piloto creó un sprint, incorporó la historia y sus tareas, lo inició y ejecutó el recorrido:

`BACKLOG → SPRINT → DESARROLLO → REVISIÓN → QA → APROBACIÓN → TERMINADO`

Se actualizaron estados Kanban, se registró una primera revisión QA observada, una observación, la corrección en la historia, una nueva revisión aprobada y la aceptación en Sprint Review. Después se registró la retrospectiva. Se verificó el historial de la historia mediante `/module/tasks/:id/history`.

El bug permaneció fuera del sprint para comprobar el seguimiento independiente y se cerró con estado terminado. La relación `bug.related_task_id = HU-01` y el estado final se comprobaron por API.

## 5. Indicadores, reportes y exportaciones

El E2E contrastó el reporte filtrado por sprint con la historia comprometida y el reporte global con el bug independiente. También verificó que el reporte tuviera filas por responsable y que el sprint registrara trabajo comprometido. Dashboard y pantalla de reportes cargaron correctamente desde la imagen Docker L04 reconstruida.

| Control | Resultado |
|---|---|
| Historias comprometidas y terminadas | PASS, contrastado contra registros creados |
| Pendientes/avance del sprint | PASS, reporte filtrado por sprint respondió correctamente |
| Trabajo por responsable | PASS, reporte devolvió filas de responsables |
| QA observado y aprobado | PASS, dos revisiones y observación persistidas |
| Bug abierto/cerrado y relación | PASS, verificado en reporte global y API |
| CSV | PASS, HTTP 200 y cuerpo no vacío |
| XLSX | PASS, HTTP 200 y contenido válido mayor a 100 bytes |

## 6. Prueba E2E focalizada

Suite creada y ejecutada:

- `web/e2e/scrum.lista14.pilot.spec.ts`
- `web/playwright.lista14.config.ts`

Resultado real: **1/1 PASS**, 0 FAIL, 0 SKIPPED. La prueba navegó por Scrum/backlog, dashboard y reportes, además de ejecutar las operaciones API autenticadas que representan el trabajo cotidiano del equipo. Se ejecutó en Chromium contra `http://127.0.0.1:18888` y API L04 `http://127.0.0.1:11725`.

El proyecto piloto conserva evidencia sintética para inspección posterior. Los artefactos Playwright quedan en `web/test-results/`; no contienen credenciales versionadas.

## 7. Problemas detectados y resolución

1. El usuario editor recibió `403` al intentar crear el proyecto. No fue corregido relajando seguridad: se utilizó el owner, como exige el modelo de permisos.
2. El rol backend inicialmente no podía crear/asignar sprints. Se ajustó únicamente el rol sintético del proyecto piloto con permisos de planificación y asignación; no se modificaron roles de proyectos existentes.
3. El primer E2E dejó sprints sintéticos parciales. Se cerró el sprint de prueba incompleto y se eliminaron solo los sprints draft del proyecto piloto; no se afectó ningún otro proyecto ni la base protegida.
4. La primera aserción del reporte esperaba el bug dentro del filtro del sprint, aunque el escenario lo mantuvo independiente. Se corrigió la prueba para verificar historia en el reporte del sprint y bug en el reporte global.

No se identificaron defectos nuevos de producto en el piloto después de esas correcciones de configuración, limpieza aislada y aserciones.

## 8. Guía breve de uso

**Administrador/Product Owner:** crear el proyecto, invitar usuarios sintéticos o autorizados, asignar roles, crear épicas, definir criterios, estimaciones y sprint; revisar Dashboard, Review, retrospectiva y reportes.

**Programadores:** tomar historias del backlog, crear o actualizar tareas, registrar Story Points, asignar responsables, mover tarjetas Kanban, documentar impedimentos y reenviar a QA después de corregir observaciones.

**QA:** revisar criterios de aceptación, crear una revisión `observed` cuando falte evidencia, registrar observaciones, comprobar la corrección y crear una revisión `approved`; después informar la decisión de Sprint Review.

**Lector:** consultar backlog, estados, dashboard y reportes según los permisos concedidos, sin ejecutar operaciones de escritura.

## 9. Checklist para un despliegue institucional autorizado

- Respaldo verificable de base de datos y configuración.
- Prueba de restauración en un entorno separado.
- Imagen versionada y procedimiento de reversión.
- Variables de entorno inyectadas fuera del repositorio; ningún secreto en logs.
- Usuarios, roles, permisos y aislamiento entre proyectos revisados.
- URLs API/Web y CORS ajustados al destino.
- Validación de API, navegador, dashboard, reportes y CSV/XLSX posterior al despliegue.
- Confirmación de observabilidad, logs y alertas.
- GitLab institucional en modo seguro de solo lectura hasta contar con autorización OAuth/token.
- Aprobación formal del responsable antes de cualquier cambio productivo.

## 10. Archivos modificados y riesgos residuales

Archivos agregados en esta lista:

- `web/e2e/scrum.lista14.pilot.spec.ts`
- `web/playwright.lista14.config.ts`
- `docs/scrum/14-piloto-operativo-sgaf-cobranzas.md`

No se modificó código funcional de producción durante el piloto. El riesgo residual principal es que el proyecto real SGAF–Cobranzas, sus usuarios y sus reglas institucionales no fueron usados por la restricción de aislamiento. También permanece pendiente la autorización institucional para GitLab; no es una falla del flujo Scrum sintético validado.

## 11. Recomendación final

El piloto queda **PASS en L04** y demuestra que un equipo con roles diferenciados puede ejecutar el ciclo Scrum, QA, Kanban, reportes y exportaciones con datos sintéticos. Para preparación institucional, conservar esta configuración como referencia y repetir el checklist en un entorno autorizado; no realizar despliegue real desde esta lista.
