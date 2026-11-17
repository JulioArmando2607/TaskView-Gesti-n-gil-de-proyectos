# 11 — Suites unitarias e integración, Lista 01

> **Actualización PostgreSQL posterior (2026-11-14):** las 79 suites que esta ejecución dejó BLOCKED se revisaron individualmente. Se ejecutaron 56 con tests sobre scratch exclusivo: 55 suites PASS, 1 FAIL, 23 BLOCKED; 1016 tests PASS, 1 FAIL. El inventario actualizado y los motivos por archivo están en [12 — Inventario PostgreSQL](12-inventario-postgresql.md). Los 512 PASS unitarios de este documento no se repitieron. La tabla histórica de abajo corresponde a la ejecución anterior.

Fecha: 2026-11-14. Esta actualización prevalece sobre los estados históricos `NOT RUN` de 07. Alcance exclusivo: inventario, configuración segura y ejecución de suites existentes. PF01–PF12 y BR01–BR06/BR08 conservan sus resultados previos; BR07 permanece BLOCKED y no se intervino.

## Inventario y clasificación

Se contaron archivos ejecutables `*.spec.ts` y `*.test.ts`; se excluyeron `*.types.ts`, helpers y setups. Total: **154 suites**. Las categorías de integración PostgreSQL y almacenamiento son subconjuntos de API/SDK, no filas adicionales que deban sumarse.

| Área y rutas | Suites | Clasificación, requisitos y riesgo | Resultado |
|---|---:|---|---|
| API `api/src/**/__tests__` | 64 | 40 unitarias o integración con dependencias simuladas: DB con `vi.mock`, HTTP con `nock`/`fetch` simulado, servidor HTTP efímero solo en loopback y archivos temporales de cada test. 4 suites de auth sin sufijo integration y 19 con `*.integration.spec.ts` requieren PostgreSQL/escritura. Una `S3FileStorage.integration.spec.ts` requiere SeaweedFS/S3. | 40 PASS; 24 BLOCKED |
| SDK `taskview-packages/taskview-api/src/api/__tests__/*.test.ts` | 56 | Integración HTTP y PostgreSQL. `vitest.config.ts` ejecuta siempre `setup-db.ts`, que hace `DELETE` y `TRUNCATE ... CASCADE` antes y después; `.env.for-test` apunta a localhost:15432, puerto de la DB activa del laboratorio. | 56 BLOCKED |
| MCP `taskview-packages/taskview-mcp/src/__tests__/*.test.ts` | 14 | Unitarias con dobles de API; el setup global no actúa sin `TASKVIEW_URL`. | 14 PASS |
| MCP `taskview-packages/taskview-mcp/src/__tests__/integration/*.integration.test.ts` | 12 | Integración HTTP contra API real; `.env.test` apunta a 127.0.0.1:11401 y credenciales semilla, y el setup puede crear/revocar un token. Requiere API y DB scratch exclusivas. | 12 BLOCKED |
| Frontend `web/src` | 0 | No se encontró suite unitaria Vitest de Vue. | Sin tests |
| E2E `web/e2e/*.spec.ts` | 8 | Playwright Chromium; requiere frontend, API, DB, navegador instalado y cuentas/datos propios. | 8 BLOCKED |

En la API, las cuatro suites PostgreSQL sin nombre integration son `Auth.spec.ts`, `AuthModel.spec.ts`, `JwtStorage.spec.ts` y `LoginByProvider.spec.ts`: instancian modelo/DB y crean o eliminan usuarios. Las 19 `*.integration.spec.ts` restantes incluyen tareas, jerarquía/movimiento, permisos, sprints mediante servicios asociados, archivos, OAuth/SSO, automatizaciones, tiempo real, facturas e importación. La suite S3 es la vigésima con ese sufijo. Las rutas exactas de las 40 suites autorizadas están fijadas en `api/vitest.lista01.config.ts`; las 14 MCP son las del directorio `src/__tests__` fuera de `integration`.

## Configuración y controles

- Se creó `api/vitest.lista01.config.ts`. Importa únicamente `vitest/config`, selecciona las 40 suites revisadas y elimina la dependencia de `conf.private.ts` sin tocar `api/vitest.config.ts`. Su DB de guardia apunta a `127.0.0.1:1`/`taskview_l01_unreachable`, y su URL de app también al puerto 1; claves y rutas son sintéticas. No es una configuración para suites con DB.
- La ejecución MCP eliminó `TASKVIEW_URL`, `TASKVIEW_LOGIN`, `TASKVIEW_PASSWORD` y `TASKVIEW_TOKEN` del proceso para impedir el login y la creación de tokens del `globalSetup`. No se cargó `.env.test`.
- Las suites API con proveedores externos usan respuestas simuladas; las de GitHub/GitLab/Gitea deshabilitan conexiones netas mediante `nock.disableNetConnect()`. Las de almacenamiento local crean directorios temporales propios. La suite SSRF abre solo un listener efímero en `127.0.0.1` y simula DNS/`fetch` para destinos públicos.
- No se creó ni migró base scratch. Ejecutar el setup SDK habría limpiado la base activa por su `.env.for-test`; tampoco se usó la base recuperada. Para habilitar integración PostgreSQL se necesita una base nueva, inicializada y validada exclusivamente para pruebas, un setup con guardia que compruebe nombre/ID de destino antes de cualquier `TRUNCATE`, y una API de pruebas conectada solo a ella. El puerto 15432 y las bases `taskview_l01`/`taskview_l01_recovery` deben quedar rechazados expresamente.
- No se modificaron reglas de negocio, lockfile, contenedores ni Compose. No se calculó cobertura: no hay ejecución completa ni instrumento de cobertura preparado, por lo que no se atribuye porcentaje.

## Comandos y resultados reales

Toolchain por proceso: `%TEMP%\taskview-l01-toolchain\node-v24.22.2-win-x64\node.exe` v24.22.2; dependencias ya instaladas con pnpm 10.28.1 y lockfile congelado.

```powershell
# En api/, con Node 24 portable en PATH
node .\node_modules\vitest\vitest.mjs run --config vitest.lista01.config.ts --reporter=default
# En taskview-packages/taskview-mcp/, tras retirar TASKVIEW_* del entorno del proceso
node .\node_modules\vitest\vitest.mjs run --exclude 'src/__tests__/integration/**' --reporter=default
```

La última corrida API terminó con código 0: **40 suites PASS, 367 tests PASS, 0 FAIL**, duración Vitest 2.47 s. MCP terminó con código 0: **14 suites PASS, 145 tests PASS, 0 FAIL**, duración 1.45 s. Total único: **54 suites ejecutadas, 54 PASS, 0 FAIL, 100 BLOCKED; 512 tests ejecutados, 512 PASS, 0 FAIL**. No se ejecutó `pnpm test` global. Hubo una advertencia de Vite sobre API CJS deprecada, sin excepción ni dependencia faltante; no se alteró configuración funcional por ella. Las corridas API previas de 19, 21, 33 y 38 suites fueron ampliaciones de selección; sus tests son subconjuntos del resultado final y no se suman de nuevo.

## E2E y pendientes

`web/playwright.config.ts` usa `localhost:5173` por defecto, inicia `pnpm dev`, permite `reuseExistingServer` fuera de CI y solo configura Chromium. `web/e2e/test-helpers.ts` fija la API a `localhost:1401`; `inbox.spec.ts` y `sso-oidc.spec.ts` admiten `E2E_API_URL`, pero los demás helpers no. `web/e2e/fixtures/auth.ts` contiene credenciales semilla y otras cuentas destinadas a un fixture SQL propio. El laboratorio autorizado usa web 18888/API 11725, mientras que `web/e2e/docker-compose.yml` describe otro stack. No se confirmó navegador Chromium instalado ni que todos los tests y sus limpiezas usen exclusivamente un destino scratch; por ello no se lanzó Playwright ni se permitió reutilizar servidores.

Riesgos de regresión aún abiertos: persistencia PostgreSQL, contratos API–DB, servicios de tareas/sprints con escrituras, permisos sobre datos reales de prueba, S3 y flujos de navegador. Los tests con mocks verifican lógica y contratos locales, no garantizan esquema ni comportamiento extremo a extremo. El frontend Vue no tiene pruebas unitarias descubiertas. Dentro de `api/src/tv-modules`, no se encontró archivo de test local en `analytics`, `api-tokens`, `billing`, `collaboration-roles`, `goals`, `graph`, `kanban`, `messaging`, `notifications`, `recurrence`, `sessions`, `sprints`, `tags`, `time-tracking` ni `ui-preferences`; algunas rutas correspondientes tienen pruebas HTTP del SDK, bloqueadas en esta actividad. Se mantienen los 66 errores de lint ya registrados (18 API, 48 web). La seguridad restante y BR07 corresponden a actividades posteriores; Lista 01 no se declara cerrada.

## Integridad final

`docker ps` y `docker inspect` de solo lectura confirmaron API/Web/DB/Mailpit del laboratorio `running`, DB y Mailpit `healthy`, y `recovery-db` `healthy` sin puerto publicado. Los contenedores originales API `aa6cc8…`, web `1c1338…` y DB `b6d4f6…` conservaron IDs, image IDs, `StartedAt` y estado `running` frente al inventario de 07. Ninguna suite seleccionada apuntó a sus puertos 1725/8888.

Conteos SQL de solo lectura, tanto en DB activa como recuperada: usuarios 2, proyectos 4, tareas 18, archivos 1 e historial 20, iguales a la línea base BR08. El adjunto activo sintético conservó SHA-256 `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`. No se repitió el hash del volumen recuperado; ninguna suite se conectó a él. `pnpm-lock.yaml` mantiene SHA-256 `2D0FA9B63C3438A1A707AD12D7D00509F97BAD96F5FBDE94A3959D74844BE494`. Evidencias de este informe contienen rutas, conteos y hashes, sin tokens ni secretos. Estado Git: persisten siete modificaciones de código/Docker previas a esta actividad; nuevo `api/vitest.lista01.config.ts` y documentos de auditoría sin seguimiento. No hubo commit, push, merge, backup, restauración ni migración.
