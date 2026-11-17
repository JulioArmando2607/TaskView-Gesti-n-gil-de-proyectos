# Lista 13 — Consolidación final y preparación para uso real

## 1. Alcance y resultado

La validación se ejecutó exclusivamente en el laboratorio aislado L04, contra la API `127.0.0.1:11725`, la web `127.0.0.1:18888` y el proyecto sintético L04 de identificador `5`. No se ejecutaron migraciones, no se modificaron bases protegidas, no se hicieron commits, push ni cambios de rama, y no se realizó despliegue productivo.

Resultado: **PASS técnico de consolidación en L04**. La imagen web reconstruida funciona y las suites críticas ejecutadas contra ella están aprobadas.

No se declara PASS integral del escenario nominal SGAF–Cobranzas: el proyecto literal no está presente en L04. Para no alterar datos reales ni inventar evidencia, se ejecutó el flujo equivalente con datos sintéticos controlados del proyecto L04. La puesta en servicio queda condicionada a repetir ese flujo sobre el proyecto destino autorizado.

## 2. Reconstrucción Docker L04

Servicio reconstruido: `web`.

| Elemento | Resultado |
|---|---|
| Imagen anterior | `taskview-l08-web:20261116`, respaldo `taskview-l01-b5a7e65-web-previous-lista13`, detenido |
| Imagen nueva | `taskview-l04-web:lista13-20261116` |
| Contenedor activo | `taskview-l01-b5a7e65-web-1` |
| Estado | `running` |
| Publicación | `127.0.0.1:18888 -> 80/tcp` |
| Volúmenes | `[]`; no se tocaron volúmenes ni la base de datos |
| API configurada | `http://localhost:11725` |
| Smoke HTTP | `/` y `/config.js` respondieron `200` |

La imagen se construyó desde `web/dockerfile` con `docker build --pull=false`. Solo se recreó el contenedor frontend; API y PostgreSQL permanecieron activos. El contenedor anterior conserva la reversión: detener y retirar el nuevo contenedor, renombrar el respaldo a `taskview-l01-b5a7e65-web-1` y arrancarlo. No se usaron comandos destructivos de volúmenes.

## 3. Matriz de pruebas finales

| Suite o control | Resultado real |
|---|---:|
| Playwright Lista 12 autenticada, incluida preparación `storageState` | **7/7 PASS** |
| Playwright Scrum Lista 03 | **4/4 PASS** |
| Playwright Kanban Lista 06 | **1/1 PASS** |
| Casos E2E funcionales únicos en la ejecución final | **11/11 PASS** |
| Setup de autenticación Playwright | **1/1 PASS** |
| Unitarias focalizadas Lista 01/02 | **24/24 PASS** |
| Pruebas GitLab unitarias Lista 10 | **3/3 PASS** |
| API typecheck | **PASS** |
| Web typecheck | **PASS** |
| API build | **PASS** |
| Web build | **PASS** |

No hubo casos `SKIPPED` en las suites autenticadas finales. El primer intento de la regresión Lista 03 se ejecutó con nombres de variables de entorno incorrectos; produjo dos fallos de parametrización, no de producto. Al repetir con los nombres L04 correctos (`SCRUM_TEST_SPRINT_NAME`, `SCRUM_TEST_TODO_STATUS_ID` y `SCRUM_TEST_IN_PROGRESS_STATUS_ID`), los 4/4 casos pasaron.

## 4. Funcionalidades consolidadas

Las pruebas cubrieron creación y edición de épicas, historias, tareas, subtareas y bugs; relaciones jerárquicas; backlog, filtros, responsables y Story Points; planificación e inicio de sprint; Kanban y persistencia de estados/orden; QA, observaciones, devolución y aprobación; Review y retrospectiva; dashboard; reportes; CSV/XLSX; historial y trazabilidad.

La suite de reportes verificó la pantalla de reportes, filtros por tipo, respuesta API, CSV no vacío y XLSX válido. Dashboard, ciclo de sprint, QA y retrospectiva pasaron contra el contenedor web reconstruido.

## 5. Escenario SGAF–Cobranzas

El nombre `SGAF–Cobranzas` no fue encontrado como proyecto disponible en el laboratorio L04. Por seguridad se utilizó el proyecto sintético L04, sin duplicar historias reales. En ese alcance se ejecutó el recorrido equivalente:

`BACKLOG → SPRINT → DESARROLLO → REVISIÓN → QA → APROBACIÓN → TERMINADO`

Se verificaron relaciones, asignación, estados, observación, aprobación, review, retrospectiva, dashboard, reportes y persistencia por API/UI. El caso literal sobre el proyecto SGAF–Cobranzas queda `BLOCKED/NOT RUN` por ausencia del dato autorizado en L04, no por un defecto reproducible.

## 6. Permisos y seguridad

Se reutilizaron cuentas sintéticas L04 de owner, editor, reader, multirrol y no-access mediante variables de entorno; no se imprimieron contraseñas ni tokens. Se verificó que reader y no-access recibieran `403` para operaciones fuera de alcance, que editor/multirrol pudieran realizar operaciones permitidas, que las operaciones de escritura estuvieran protegidas y que los tokens con alcance de proyecto no accedieran a otro proyecto. No se validó ni simuló una asociación GitLab institucional.

## 7. Correcciones y compatibilidad

La corrección funcional de Lista 12 cargó correctamente el proyecto al acceder directamente a reportes, evitó el bloqueo prematuro por permisos aún no cargados y mantuvo la decisión final del servidor. En Lista 13 se reconstruyó la imagen web para que esa corrección quedara efectivamente servida por Docker L04.

No fue necesario modificar código fuente adicional durante la consolidación final. Las funcionalidades originales se conservaron; la evidencia de regresión Scrum/Kanban, typecheck, builds y pruebas unitarias permanece aprobada. Las advertencias de bundling de Vite sobre imports dinámicos, chunks grandes y API CJS son no bloqueantes.

## 8. Configuración y procedimiento operativo

Variables necesarias, sin valores secretos: `TASKVIEW_API_URL`; configuración de API para host/puerto/nombre/usuario/contraseña de PostgreSQL; claves de firma y cifrado; tiempos de vida de tokens; y cualquier variable de correo o integraciones definida por el entorno. Los secretos deben inyectarse fuera del repositorio.

Instalación/actualización en un entorno autorizado: respaldar datos y configuración, construir la imagen web con la misma versión de dependencias, recrear únicamente `web`, comprobar `/`, `/config.js`, conexión API, consola y smoke E2E. No ejecutar migraciones como parte de esta Lista.

Reversión: conservar el tag anterior y su configuración, detener el contenedor nuevo, restaurar el tag anterior, iniciar el contenedor y repetir el smoke. La recuperación de datos debe utilizar el respaldo operativo aprobado del laboratorio, sin sobrescribir bases protegidas.

La diferencia relevante entre L04 y un destino futuro es que L04 usa cuentas y proyecto sintéticos, URLs locales, imágenes locales y un API aislado. El destino debe aportar sus propios permisos, secretos, proyecto y configuración de red; no se deben copiar credenciales ni asumir que el proyecto nominal existe.

## 9. Archivos y artefactos

En Lista 13 se generó este informe. La reconstrucción Docker fue un cambio de runtime, no un cambio de rama ni un commit. Se conservaron los cambios previos de Listas 01–12, incluidos la pantalla de reportes, el arnés de autenticación y las suites Playwright. Evidencias Playwright quedaron en `web/test-results/` (capturas y trazas del intento parametrizado fallido, además de resultados finales); ese directorio no contiene credenciales versionadas.

## 10. Riesgos residuales y recomendación

Riesgos: el escenario nominal SGAF–Cobranzas no pudo ejecutarse porque no está disponible en L04; persisten advertencias no bloqueantes del bundler; la autorización OAuth/token de GitLab institucional sigue pendiente y debe mantenerse en modo seguro de solo lectura.

Recomendación: **aprobado para validación técnica en laboratorio L04 y preparado para evaluar un despliegue**, pero no autorizar puesta en producción todavía. Antes de usarlo con SGAF–Cobranzas, disponer el proyecto autorizado en el entorno de destino, repetir el escenario completo y confirmar permisos, respaldos y variables del destino. No iniciar Lista 14 ni ejecutar despliegues adicionales desde este resultado.
