# 10 — Punto de continuación de Lista 01

**Estado: detenido por instrucción expresa del usuario.** Corte de verificación: 2026-11-13, 22:07 -05:00 (America/Lima). Este documento permite continuar con otro modelo de Codex sin repetir la auditoría ni suponer que el laboratorio ya funciona. No ejecutar los pasos pendientes hasta que el usuario reanude el trabajo.

## 1. Objetivo que se conserva

Finalizar exclusivamente Lista 01: instalación congelada de dependencias, compilación, laboratorio Docker aislado, pruebas funcionales/seguridad y respaldo/restauración sintéticos. No implementar Scrum ni iniciar Lista 02. La auditoría está en documentos 01–09 y la configuración inicial en `entorno/compose.yaml`.

La interrupción se produjo **después de preparar Node y pnpm, antes de `pnpm install --frozen-lockfile`**. No hay una instalación del monorepositorio a medio completar ni una migración en curso.

## 2. Línea base y archivos

| Dato | Valor verificado |
|---|---|
| Checkout | `C:\Users\jvega\Documents\proyectos\Gestion-proyectos\taskview-community` |
| Rama | `chore/l01-auditoria-taskview` |
| Commit | `b5a7e6598d927fe2e8a5936150093390c31ed13c` |
| Describe | `v1.58.2-5-gb5a7e65` |
| Git al corte | Solo `?? docs/auditoria-taskview/`; diff de archivos rastreados vacío |
| Documentación previa | Nueve documentos y tres auxiliares conservados |
| Dependencias del checkout | No existe `node_modules` |
| Artefactos | No existen `api/dist` ni `web/dist` |
| Secretos locales | No existe `docs/auditoria-taskview/entorno/.env` |

La carpeta de auditoría **continúa sin rastrear por Git**; `git diff` no muestra sus cambios. Preservarla completa. No ejecutar clean/reset, no cambiar de rama, no hacer commit/push/merge. No se modificaron código de aplicación, migraciones, manifiestos ni lockfile.

En este punto de continuación se actualizaron:

- `04-entorno-desarrollo.md`: herramientas preparadas, activación por sesión y pasos no ejecutados.
- `05-respaldo-versionamiento.md`: respaldo/restauración aún no ejecutados; alcance exclusivamente sintético y segundo destino dentro del mismo proyecto Compose.
- `07-informe-pruebas.md`: resultados verificados y distinción entre evidencia histórica y nueva.
- `08-recomendaciones-arquitectura.md`: resuelto el prerrequisito de herramientas, pendiente build/regresión.
- `09-resumen-ejecutivo.md`: estado detenido y decisión técnica actual.
- `10-punto-continuacion.md`: archivo nuevo de entrega al siguiente modelo.

Los documentos 01, 02, 03, 06 y los tres archivos de `entorno/` no cambiaron durante esta continuación. No se crearon todavía scripts de pruebas ni configuraciones nuevas de Vitest/Playwright.

## 3. Actividades completadas

| Actividad | Resultado |
|---|---|
| Lectura de auditoría y configuración | Realizada, preservando conclusiones previas |
| Verificación Git | Rama y SHA coinciden; sin cambios rastreados |
| Inventario Docker inicial | Originales running, puertos API 1725/web 8888; red y montajes esperados |
| Recursos de laboratorio | Consultas de contenedores/volúmenes/red por etiqueta de proyecto sin resultados |
| Herramientas iniciales | Host Node 20.19.5; pnpm/Bun ausentes en PATH global; Docker 29.9.3, Compose 5.7.0 |
| Espacio | Aproximadamente 796 GB libres en C: al preparar herramientas; volver a comprobar si es necesario |
| Node portable | Descarga oficial 24.22.2, comparación SHA-256 del ZIP con manifiesto oficial, extracción y ejecución verificadas |
| pnpm local | Instalación exclusiva 10.28.1 con Node portable; versión y exit 0 comprobados |
| Revisión inicial de pruebas | Se leyeron Vitest y Playwright; persisten los hallazgos sobre archivo privado, destinos y puertos |

No se instalaron dependencias del monorepositorio. No se ejecutaron tipos, lint, build, suites, migraciones, creación de cuentas, carga de archivos, dumps ni restauraciones durante esta continuación. Los intentos fallidos de tipos por pnpm ausente en 07 pertenecen a la auditoría anterior.

## 4. Toolchain disponible

Directorio base: `Join-Path $env:TEMP 'taskview-l01-toolchain'`.

| Contenido | Ruta relativa al directorio base |
|---|---|
| Node ejecutable | `node-v24.22.2-win-x64/node.exe` |
| npm de esa distribución | `node-v24.22.2-win-x64/npm.cmd` |
| pnpm ejecutable | `pnpm/node_modules/.bin/pnpm.cmd` |
| Caché npm exclusiva | `npm-cache/` |
| ZIP y manifiesto | `node.zip`, `SHASUMS256.txt` |

Orígenes: `https://nodejs.org/dist/v24.22.2/node-v24.22.2-win-x64.zip`, `https://nodejs.org/dist/v24.22.2/SHASUMS256.txt`; pnpm 10.28.1 instalado mediante npm con `--prefix` temporal. No se sustituyó Node global ni se editó PATH persistente. No se usó NVM ni se instaló Bun. No aceptar el aviso de npm de actualizar a versión mayor como parte de esta tarea.

El comando de instalación de pnpm ya finalizó con exit 0. La descarga/extracción de Node también finalizó con exit 0. En el cierre no se observaron procesos Node/npm/pnpm cuyo ejecutable estuviera bajo esa carpeta. Una celda de herramientas que también contenía una lectura de fuentes quedó interrumpida y ya no pudo consultarse; no tomar esa lectura como evidencia recibida. No hay compilación/migración pendiente de recuperar.

## 5. Docker al detener

No se creó ningún recurso de `taskview-l01-b5a7e65`. No se generaron imágenes de laboratorio. El Compose existente continúa siendo una preparación estática; sus puertos previstos son localhost 11725/18888/15432. Hay que volver a comprobar colisiones inmediatamente antes de iniciar servicios.

Originales: mismos contenedores, imágenes y fechas de arranque al inicio y al corte. Todos siguen `running`.

| Contenedor | ID | Imagen | StartedAt UTC |
|---|---|---|---|
| taskview-taskview-api-server-1 | `aa6cc8daa2b516d83f0a4eeb047b2d411b02085cdd855bc7d9e63637c72f5efc` | `sha256:bf154c5888fd346b54e3557f21af80c8e8de664662d53553cdeaba413f20dc0c` | 2026-11-13T20:25:01.439578433Z |
| taskview-taskview-webapp-1 | `1c1338f2d3dce45627b79d77b6d5707259267d63bc369e00e7e2aff2439d9417` | `sha256:75a2075562f46bc63caff057f2cf5bd8655d621ea723070bde0f49305c0fbb2c` | 2026-11-13T20:24:55.107263083Z |
| taskview-db-1 | `b6d4f66ebfc195b1893ced03763dce848dbf9ca78a4c976a9faaa25d34389dd5` | `sha256:846a7ddaa67a4b354ae1d21087b683901aa6113a4ed626d3787cfbf6c85e3e07` | 2026-11-13T20:24:55.2220635Z |

Red original `taskview_default`; DB en `taskview_pgdata`; API con bind mounts en destinos `/usr/src/app/data/files` y `/usr/src/app/logs`. No copiar ni reutilizar sus rutas fuente. No se consultaron datos de negocio en esta continuación. La comparación de metadatos no constituye una comprobación de integridad bit a bit de datos; no hubo ninguna operación de escritura dirigida a esos recursos.

## 6. Próximos comandos, solo tras reanudación

### Preparar la sesión

Leer primero este punto, 04, 05, 07 y 09, y consultar los restantes documentos según la tarea. Revisar Git y procesos pendientes sin alterar originales. Activar herramientas únicamente en el proceso PowerShell actual:

```powershell
Set-Location -LiteralPath 'C:\Users\jvega\Documents\proyectos\Gestion-proyectos\taskview-community'
git status --short
git branch --show-current
git rev-parse HEAD
$l01Tools = Join-Path $env:TEMP 'taskview-l01-toolchain'
$l01NodeDir = Join-Path $l01Tools 'node-v24.22.2-win-x64'
$l01PnpmDir = Join-Path $l01Tools 'pnpm/node_modules/.bin'
if (-not (Test-Path (Join-Path $l01NodeDir 'node.exe'))) { throw 'No está disponible Node portable' }
if (-not (Test-Path (Join-Path $l01PnpmDir 'pnpm.cmd'))) { throw 'No está disponible pnpm local' }
$env:PATH = $l01NodeDir + ';' + $l01PnpmDir + ';' + $env:PATH
node --version
pnpm.cmd --version
```

Si cambió SHA/rama o aparecieron cambios de usuario, conservarlos y analizar antes de continuar. Si Windows eliminó herramientas temporales, reconstruir solo esa toolchain mediante el procedimiento de 04. Cada invocación del ejecutor puede usar un proceso nuevo: activar PATH en la misma sesión que ejecutará los comandos, sin editar PATH de usuario/máquina.

### Instalar y verificar

Primer paso real pendiente: `pnpm.cmd install --frozen-lockfile`. Comprobar hash del lockfile antes/después, espacio y destino. Capturar resultados y tiempos por comando, sin volcados de secretos. Detener cada secuencia dependiente al primer error; seguir tareas independientes seguras.

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd run build:packages
pnpm.cmd --filter capacitor-widget-bridge build
pnpm.cmd --filter taskview-ce-api-server type-check
pnpm.cmd --filter web-nuxt-ui typecheck
pnpm.cmd --filter taskview-ce-api-server lint
pnpm.cmd --filter web-nuxt-ui lint
pnpm.cmd --dir api run build:docker
pnpm.cmd --dir api run build:migration
pnpm.cmd run build:webapp
```

No resolver fallos preexistentes cambiando dependencias, lockfile o semántica de negocio. La compilación web también ejecuta tipos; no confundir `build-only` con un build completo. Tras builds exitosos, copiar recursos de runtime/migración según 04; los Dockerfiles esperan artefactos ya compilados.

### Laboratorio

Generar secretos nuevos, únicamente para las tres variables de `.env.example`, en `entorno/.env` excluido de Git; no imprimirlos. Validar configuración efectiva en memoria sin publicar environment. Asegurar volúmenes nuevos, DB_HOST=db, DB/user sintéticos, red propia y puertos localhost. Solo después:

```powershell
$l01Compose = 'docs/auditoria-taskview/entorno/compose.yaml'
$l01Env = 'docs/auditoria-taskview/entorno/.env'
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env --profile app --profile maintenance config --quiet
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env --profile app --profile maintenance build api web migration
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env up -d db
```

**No ejecutar automáticamente la siguiente etapa:** comprobar identidad del contenedor DB vía proyecto Compose, volumen vacío exclusivo, base/usuario `taskview_l01`, ausencia de red original y destino real del migrador. Este usa `pg_terminate_backend`. Tras superar los controles, ejecutar la migración exclusivamente del laboratorio y validar logs saneados, versión de esquema y objetos; luego iniciar API/web:

```powershell
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env --profile maintenance run --rm migration
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env --profile app up -d api web
docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env ps
```

Todos estos comandos están pendientes, no son evidencia de ejecución. No asumir que nombre de servicio y contenedor coinciden. No reutilizar contenedores ni etiquetas originales.

### Pruebas, seguridad y recuperación

1. Inspeccionar las suites existentes y crear configuraciones de laboratorio, sin `conf.private` ni conexiones originales. No ejecutar `pnpm test` global. Playwright debe usar un navegador/contexto separado, URL de laboratorio y no reutilizar servidores cotidianos.
2. Crear dos usuarios de desarrollo sintéticos y administrador de prueba si es necesario. Ejecutar PF01–PF12: autenticación, proyectos, tareas/subtareas, ciclos y referencias cruzadas, Kanban/orden, sprints, roles múltiples, denegaciones entre proyectos, adjuntos, historial, Review/retro y analítica. Incluir pruebas de tokens con scope y autorización de archivos.
3. Revisar logs de refresh antes de capturar navegador: `web/src/plugins/axios.ts` puede imprimir tokens. No guardar trazas/capturas/logs con secretos. Proponer una tarea separada de corrección, salvo cambio mínimo imprescindible para ejecutar el laboratorio con seguridad, permitido por el usuario.
4. Verificar red interna, puertos localhost, volúmenes propios, ausencia de socket Docker y de servicios institucionales configurados.
5. Respaldar únicamente DB/adjuntos/configuración sintéticos a carpeta privada fuera del repo. Usar pg_dump -Fc sin transformación de texto PowerShell, hash SHA-256 y pg_restore --list. Crear segundo servicio/destino de recuperación **en el mismo proyecto Compose autorizado**, con otro volumen y base; aún debe configurarse. No sobrescribir la DB activa del laboratorio, no usar --clean. Verificar restauración, relaciones, permisos, archivos y lectura funcional.
6. Comparar metadatos originales, revisar Git y archivos nuevos, actualizar 04/05/07/08/09. Solo declarar cierre si hay evidencia de los criterios esenciales; de lo contrario registrar FAIL/BLOCKED/NOT RUN según corresponda.

Para parar servicios de laboratorio en una futura sesión sin destruir volúmenes, el comando específico será `docker compose -p taskview-l01-b5a7e65 -f $l01Compose --env-file $l01Env --profile app stop api web db`. No se ejecutó porque no hay servicios creados. Si se añaden servicios de recuperación, incluir sus nombres explícitos. No ejecutar down -v ni limpiezas globales.

## 7. Bloqueos y riesgos que quedan

- La pausa del usuario es el motivo de detener el avance; no es un fallo de instalación de Node/pnpm.
- Dependencias y artefactos ausentes: bloquean build y ejecución; instalación aún no intentada.
- `api/vitest.config.ts` importa `conf.private.ts` ausente y contiene destinos de prueba heredados. No copiar credenciales de ejemplo ni conectar a DB real.
- Playwright configura 5173 y reuseExistingServer; Vite usa 5174. Preparar configuración de laboratorio coherente.
- El sandbox de ejecución falló intermitentemente con `helper_sandbox_lock_failed`/acceso denegado. Las operaciones necesarias se reintentaron mediante el mecanismo de aprobación; no requirió sustituir Node global ni elevación administrativa del sistema.
- Tras interrupción, la celda 27 ya no existe. Conservar las salidas recibidas (pnpm exit 0), no inventar resultados de la lectura posterior.
- Sin pruebas no se sabe si existen errores de tipos, lint, build o migraciones. No asumir que fallan ni que pasarán.
- Persisten los riesgos de tokens en consola, migrador que desconecta sesiones y versión exacta de imágenes originales no demostrada; no tocar originales para resolverlos.

## 8. Texto para iniciar la siguiente sesión

> Reanuda exclusivamente la finalización de Lista 01 de TaskView Community. Lee primero `docs/auditoria-taskview/10-punto-continuacion.md` y los informes que referencia. Conserva rama `chore/l01-auditoria-taskview`, commit b5a7e6598d927fe2e8a5936150093390c31ed13c y toda la carpeta de auditoría aún no rastreada. Node 24.22.2 portable y pnpm 10.28.1 ya están instalados en `$env:TEMP/taskview-l01-toolchain`; activa ambos solo en la sesión. El primer paso pendiente es instalar dependencias con `--frozen-lockfile`. No hay recursos Docker del laboratorio, `.env` ni builds. Completa compilación, laboratorio, PF01–PF12, seguridad y recuperación sintética según el prompt de finalización, documentando resultados reales. Usa siempre `-p taskview-l01-b5a7e65` y el Compose correcto; el segundo destino de restauración debe pertenecer al mismo proyecto y usar datos/volumen nuevos. Prohibido modificar instalación original, acceder a servicios institucionales, hacer commits/push/merge o comenzar Lista 02.

La decisión al corte sigue siendo **APTA SOLO PARA DISEÑO DE LISTA 02**, con Lista 01 pendiente. Ese estado no autoriza iniciar Lista 02: la siguiente sesión debe terminar primero esta Lista 01.
