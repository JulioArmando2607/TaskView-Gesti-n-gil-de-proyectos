# 05 — Respaldo y versionamiento

## Actualización más reciente — BR07 funcional sobre copia desechable (2026-11-14)

**BR07 PASS en una copia funcional independiente del respaldo sintético validado.** No se conectó una API a `taskview_l01_recovery`, ni se repitió el backup. El mismo dump privado de 331,854 bytes se verificó de nuevo por SHA-256 `14ce4ce875af38229f06f9280bdd9e3ee618846a46319779264b327469550578`; el adjunto privado de 38 bytes por SHA-256 `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`. Solo después se copiaron a los volúmenes nuevos BR07 y se ejecutó `pg_restore --exit-on-error --single-transaction --no-owner --no-acl` exclusivamente en `taskview_l01_br07_20261114`, sin `--clean` ni migraciones. Resultado exit 0.

La configuración [br07.compose.yaml](entorno/br07.compose.yaml), proyecto explícito `taskview-l01-b5a7e65`, creó `br07-db` PostgreSQL 17.12 y `br07-api` con imagen de laboratorio existente `taskview-l01-api:b5a7e65`. Red `taskview-l01-b5a7e65_br07_20261114_net` con `internal=true`, solo esos dos miembros y **sin puertos publicados**. Volúmenes exclusivos: `_br07_20261114_pgdata`, `_br07_20261114_files`, `_br07_20261114_logs`; ningún montaje apunta a original, base activa, recuperación o scratch. DB/usuario nuevos `taskview_l01_br07_20261114`/`taskview_l01_br07`, clúster físico `7708138440718164006`. Las tres claves aleatorias propias se guardaron fuera del repositorio en `%TEMP%\taskview-l01-br07-20261114\br07.env`, ACL de un solo usuario. No se configuraron SMTP, S3, GitLab, OAuth, SSO, Firebase ni proveedores institucionales. El backup contenía 0 integraciones, 0 webhooks y 0 jobs pendientes; PgBoss y sus workers pueden escribir únicamente en la copia BR07. El API no tiene red hacia las bases protegidas.

Antes del arranque API: base nueva vacía (0 tablas), luego versión 1.74.0, 89 tablas, 21 triggers, 2 usuarios sintéticos, proyectos 3/4, 18 tareas, 2 subtareas, sprint 1, 1 archivo y 20 filas de historial. El volumen BR07 conservó el SHA-256 del adjunto. Tras iniciar API, `GET /module/auth/login-options` devolvió 200 dentro del contenedor; no bastó para PASS. Con la cuenta sintética recuperada y contraseña DPAPI leída solo en memoria, [br07-probe.mjs](entorno/br07-probe.mjs) ejecutó login autenticado 200 y comprobó:

| Lectura autorizada | Esperado y obtenido |
|---|---|
| Proyectos | GET 200; IDs 3 y 4, nombres sintéticos `L01-*` |
| Tareas y subtareas | GET lista proyecto 3 200 con 13 tareas incompletas; tareas 3 y 4 con padres 2 y 3 respectivamente |
| Sprint y retrospectiva | GET sprint 1 200, proyecto 3, estado `completed`, campos `wentWell`, `wentBad`, `actionItems` presentes |
| Roles | GET 200, roles sintéticos 9 y 10 presentes |
| Historial | GET tarea 13 200, dos entradas |
| Adjunto | GET lista/metadatos 200, ID esperado, 38 bytes; URL autorizada 200, descarga 200 y SHA-256 exacto |

La lista de 13 corresponde al filtro HTTP `showCompleted=0`; el manifiesto SQL conserva 18 tareas totales. El primer intento exploratorio de lista omitió parámetros obligatorios y devolvió 400; se usó luego la consulta documentada con `componentId=-1401`, `page=0`, `showCompleted=0` y `firstNew=0`. No se interpretó ese 400 como pérdida de datos. El probe final terminó `BR07_FUNCTIONAL_ASSERTIONS_PASS`, sin imprimir contraseña, JWT, URL firmada ni bytes del adjunto.

Al cierre, las bases activa, recuperada y BR07 tienen por separado los conteos L01 `2|2|18|1|20`; los tres adjuntos conservan el mismo hash. Original, API/web/DB del laboratorio y recovery-db mantuvieron metadatos y estado. El volumen y los contenedores BR07 quedan conservados para reproducción; no ejecutar `down -v`. BR07 prueba lectura funcional de **una nueva restauración del artefacto validado**, no una API conectada a la instancia de recuperación conservada. BR01–BR06 y BR08 mantienen sus PASS previos.

## Estado en la pausa del 2026-11-13

No se ejecutó respaldo ni restauración. El laboratorio todavía no tiene contenedores, volúmenes, base sintética, cuentas ni adjuntos. La preparación se detuvo a petición del usuario después de verificar Node portable y pnpm. Ver [punto de continuación](10-punto-continuacion.md).

Para la continuación autorizada de Lista 01, **solo se permite respaldar datos sintéticos**. Los ejemplos de la auditoría inicial que mencionan contenedores originales son procedimientos documentados para una autorización futura distinta: no ejecutarlos en esta Lista 01. Las versiones de PostgreSQL/esquema de la instalación original registradas abajo proceden de la auditoría inicial; en esta continuación solo se consultaron metadatos Docker.

La instrucción más reciente exige usar exclusivamente el proyecto Compose `taskview-l01-b5a7e65`. Por tanto, el segundo destino de recuperación deberá ser un servicio de restauración separado dentro de ese mismo proyecto, con base y volumen nuevos, sin sobrescribir la DB sintética activa. Ese servicio aún no está configurado. Esta precisión sustituye la propuesta inicial de crear otro proyecto Compose para el ensayo.

## Línea base observada

| Elemento | Resultado |
|---|---|
| Git inicial | Rama `main`, árbol limpio, sin cambios no confirmados |
| HEAD | `b5a7e6598d927fe2e8a5936150093390c31ed13c` |
| Tag cercano | `v1.58.2-5-gb5a7e65`; HEAD está cinco commits después, no exactamente en el tag |
| Rama creada | `chore/l01-auditoria-taskview`, partiendo del árbol limpio; no existía |
| Paquetes raíz / API / web | 1.58.2 |
| Paquetes compartidos | SDK 1.48.3, esquemas 1.17.0 según sus manifiestos; no asumir numeración uniforme |
| API en Docker | Node 24.22.2; `package.json` de runtime declara 1.17.0 |
| Explicación del runtime | `api/production.package.json` también declara 1.17.0 y se copia en el build; no permite fechar el código desplegado |
| DB activa | PostgreSQL 17.12; `app.version` = 1.74.0; coincide con último nivel del manifiesto de migraciones local |
| Correspondencia exacta código/imagen | NO VERIFICADA; imágenes sin etiquetas OCI revision/version. La coincidencia de esquema no demuestra igualdad de código. |

Digests observados, sin pull ni retag:

| Imagen en uso | Digest inmutable |
|---|---|
| `gimanhead/taskview-ce-api-server:latest` | `sha256:bf154c5888fd346b54e3557f21af80c8e8de664662d53553cdeaba413f20dc0c` |
| `gimanhead/taskview-ce-webapp:latest` | `sha256:75a2075562f46bc63caff057f2cf5bd8655d621ea723070bde0f49305c0fbb2c` |
| `postgres:17` | `sha256:846a7ddaa67a4b354ae1d21087b683901aa6113a4ed626d3787cfbf6c85e3e07` |

API y web fueron creadas 2026-11-13; PostgreSQL, 2026-11-12. Los contenedores observados son `taskview-taskview-api-server-1`, `taskview-taskview-webapp-1`, `taskview-db-1`. Red `taskview_default`, datos en volumen `taskview_pgdata`; API monta archivos en `/usr/src/app/data/files` y logs en `/usr/src/app/logs`. Las rutas host privadas no se publican.

## Política de ramas

Mantener esta rama solo para documentación/configuración. Revisar diff, aprobar y realizar commit/push manualmente; no se hicieron commits, merges ni pushes. Futuras listas: ramas separadas desde una línea base aceptada, mantener remote upstream como referencia, aplicar cambios pequeños y migraciones aditivas versionadas. Evitar reescrituras de historia y cambios masivos de paquetes. Registrar SHA, imagen por digest y versión de esquema en cada entrega; no identificar despliegues por `latest`.

## Procedimiento de respaldo (documentado, no ejecutado)

Destino: carpeta privada fuera del checkout, con ACL limitada, cifrado y espacio suficiente. Conservar una copia fuera del equipo. Manifestar fecha UTC, commit conocido o desconocido, digests, Compose, versión PostgreSQL/esquema, ubicación de archivos y hashes; no incluir secretos en el manifiesto público.

1. Descubrir Compose/env y bind mounts mediante metadatos Docker filtrados. Copiar sus archivos directamente al repositorio privado de respaldos, sin imprimirlos. Incluir claves de cifrado originales: sin ellas no se recuperan tokens cifrados. Respaldar certificados y configuración de almacenamiento si existen.
2. Hacer dump lógico consistente de PostgreSQL con `pg_dump -Fc`, usando cliente 17 del contenedor. No copiar el volumen PostgreSQL mientras está activo como supuesto respaldo consistente.
3. Respaldar archivos locales y, si el proveedor es S3, objetos/versiones y configuración del bucket. DB y adjuntos son dos recursos distintos: una copia en caliente de ambos no garantiza el mismo instante. Coordinar una ventana sin escrituras de aplicación (sin detener contenedores) o snapshots coordinados; en una copia preliminar activa, registrar el intervalo y reconciliar altas/bajas/hashes antes de declararla recuperable.
4. Exportar las imágenes locales por sus IDs con `docker image save` a archivos, o garantizar retención por digest en un registro autorizado. No hacer pull de `latest`.
5. Generar SHA-256 de dumps, archivos, configuración cifrada e imágenes; conservar manifiesto protegido. Validar archivo de dump con `pg_restore --list`. Esto no reemplaza un ensayo de restauración.

Ejemplo PowerShell para un futuro respaldo autorizado. `$respaldo` debe contener una ruta privada nueva y existente; no se asigna una ruta institucional por defecto. El nombre del dump temporal debe ser único. El script utiliza variables ya presentes en el contenedor, sin mostrar sus valores. Se contrastaron nombres y herramientas; el dump no fue ejecutado.

```powershell
if (-not $respaldo -or -not (Test-Path -LiteralPath $respaldo)) { throw 'Definir destino privado de respaldo' }
$dumpFile = 'taskview-' + [guid]::NewGuid().ToString('N') + '.dump'
$dumpScript = 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/' + $dumpFile
$dumpScript | docker exec -i taskview-db-1 sh
if ($LASTEXITCODE -ne 0) { throw 'Fallo de pg_dump' }
docker exec taskview-db-1 pg_restore --list /tmp/$dumpFile
if ($LASTEXITCODE -ne 0) { throw 'Archivo de dump ilegible' }
docker cp "taskview-db-1:/tmp/$dumpFile" (Join-Path $respaldo $dumpFile)
docker cp taskview-taskview-api-server-1:/usr/src/app/data/files (Join-Path $respaldo 'files')
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $respaldo $dumpFile)
```

No redirigir el binario de `pg_dump` con `>` desde Windows PowerShell: puede alterar su codificación. `docker cp` conserva el archivo binario. Guardar también globals/roles si se requiere fidelidad de propietarios: `pg_dump` no los incluye. Un export con `pg_dumpall --globals-only --no-role-passwords` exige recrear credenciales por canal seguro; no guardar hashes de contraseñas en documentos. No se ejecutó ninguno de estos respaldos durante la auditoría.

## Restauración (solo laboratorio nuevo)

No restaurar sobre `taskview-db-1`, ni usar `--clean`, ni reutilizar `taskview_pgdata`. Según la instrucción de continuación, crear un servicio de ensayo dentro del proyecto `taskview-l01-b5a7e65`, separado de la DB activa del laboratorio, con PostgreSQL 17, base nueva y volumen vacío propio. Mantener red interna, sin SMTP ni integraciones, para que datos restaurados no disparen mensajes ni sincronizaciones.

1. Validar hashes y `pg_restore --list`; comparar versiones de imagen/esquema con manifiesto.
2. Crear roles requeridos y una base vacía en el destino de ensayo. Para una prueba portable usar `--no-owner --no-acl` y documentar que no reproduce grants originales. Para recuperación fiel, restaurar roles/grants según política.
3. Copiar el dump al contenedor de ensayo y ejecutar `pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U <usuario-ensayo> -d <base-vacia-ensayo> /tmp/respaldo.dump`. Los marcadores deben sustituirse únicamente tras verificar el contenedor; no es un comando ejecutado.
4. Recuperar adjuntos en un volumen nuevo y configuración cifrada bajo custodia. Desactivar/aislar integraciones antes de arrancar la aplicación, aunque se hayan restaurado tokens válidos. No conectar un frontend público al ensayo.
5. Verificar `app.version`, tablas/triggers, conteos agregados, relaciones huérfanas, hashes de adjuntos, login autorizado y consultas básicas. Comparar con manifiesto sin publicar datos de personas.
6. Registrar duración, errores y restauración funcional. Solo entonces declarar un respaldo probado. Las migraciones se ensayan en otra copia, después de recuperar la misma versión; no “arreglar” una restauración aplicando el código más reciente directamente.

El dump de PostgreSQL admite actividad concurrente y formato custom recuperable con pg_restore; globals requieren tratamiento separado. Referencias oficiales: [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore 17](https://www.postgresql.org/docs/17/app-pgrestore.html).

## Licencia

`LICENSE.md` local contiene **TaskView Source-Available License 1.1**, no una licencia permisiva OSI. Sus secciones 2–5 permiten autoalojamiento/modificación para uso interno de empleados y contratistas de la misma entidad. Restringen servicios a terceros, incluso gratuitos, productos competidores y comercialización; filiales son entidades distintas. Distribuir un fork exige respetar restricciones, conservar licencia/copyright y reemplazar marcas; la sección 5 también restringe marcas en derivados. Definir identidad del producto antes de distribuirlo. Uso interno SGAF es técnicamente compatible con el supuesto descrito, condicionado a esos usuarios y límites, no una autorización para ofrecer servicio externo. Fuente contrastada: [licencia oficial](https://raw.githubusercontent.com/Gimanh/taskview-community/main/LICENSE.md). Para el checkout auditado prevalece su copia local; la referencia main puede cambiar. `CLA/` y `CONTRIBUTING.md` regulan contribuciones upstream, no son un paso ejecutado en esta auditoría.
## Ensayo sintético de respaldo y restauración — 2026-11-14

### Alcance y protección de origen

Se verificó `com.docker.compose.project=taskview-l01-b5a7e65` y `service=db` antes de usar `taskview-l01-b5a7e65-db-1` (`455ab9ddd923…`). La base y el usuario son `taskview_l01`; PostgreSQL servidor y cliente `pg_dump` son 17.12. El volumen de origen es exclusivamente `taskview-l01-b5a7e65_pgdata`; el volumen de bytes es `taskview-l01-b5a7e65_files`, montado en API como `/usr/src/app/data/files`. El esquema previo y posterior es 1.74.0.

El API del laboratorio se detuvo con `docker compose -p taskview-l01-b5a7e65 -f docs/auditoria-taskview/entorno/compose.yaml --env-file docs/auditoria-taskview/entorno/.env --profile app stop api` para abrir una ventana sin escrituras de aplicación; DB, Web y contenedores originales siguieron activos. Se copió el volumen de archivos y se hizo el dump sin ejecutar operaciones de escritura en la DB. Al terminar el respaldo, el API del laboratorio se inició de nuevo mediante el mismo proyecto y Compose. No se detuvieron los contenedores originales.

### Manifiesto previo a respaldo

El manifiesto de verificación completo quedó fuera del repositorio, dentro del directorio privado `%TEMP%\taskview-l01-recovery-20261114\artifacts\verification-manifest.json`. Su ACL de directorio está protegida para el usuario Windows actual. El archivo no contiene contraseñas, tokens, correos ni contenido del adjunto. SHA-256 del manifiesto: `4f190ebd6f9cab6d6e68aa9df995b5e2f7bc89f6428c7ec07cfac5e5ce59a9a9`.

| Dato sintético | Conteo/identificador antes del respaldo |
|---|---:|
| Usuarios `@taskview-l01.invalid` en autenticación / colaboración | 2 / 2 |
| Proyectos `L01-*` | IDs 3 y 4 (2) |
| Tareas en esos proyectos / subtareas | 18 / 2 |
| Relaciones padre-hijo | `3>2@3`, `4>3@3`; 0 padres huérfanos y 0 padres de otro proyecto |
| Sprint, outcome y retrospectiva | ID 1, `completed`; 1 outcome `incomplete` con estimación 5.00; 1 retrospectiva |
| Roles/permisos/membresía de prueba | roles 9 y 10; 1 asignación de rol, 2 asignaciones de permisos, 3 vínculos usuario-proyecto |
| Historial de tareas | 20 filas relacionadas con proyectos 3 y 4 |
| Objetos / triggers no internos | 367 / 21 |
| Adjuntos | 1 archivo de 38 bytes, ID `00cf6093-5393-4f04-befc-d040b6157738`, vinculado a tarea 8 del proyecto 3 |
| Hash SHA-256 del adjunto | `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f` |

El checksum de la fila `tv_files.files` coincidió con SHA-256 del archivo físico en el volumen. Su clave de almacenamiento es relativa (`3/<file-id>`); el respaldo preservó esa estructura.

### Respaldo realizado

`pg_dump (PostgreSQL) 17.12 (Debian 17.12-1.pgdg13+1)` produjo el formato custom solicitado con `pg_dump -Fc`. El archivo privado es `taskview-l01-taskview_l01-20261114.dump`, tamaño 331,854 bytes, SHA-256 `14ce4ce875af38229f06f9280bdd9e3ee618846a46319779264b327469550578`. `pg_restore --list` lo pudo leer y enumeró 787 líneas de objetos. Código de salida de `pg_dump` y `pg_restore --list`: 0. El dump se copió con `docker cp`, no con redirección PowerShell. El archivo temporal dentro del contenedor fuente se retiró tras verificar la copia; no se alteró la DB.

La copia de archivos quedó en el subdirectorio privado `artifacts\files`. El único archivo copiado conserva 38 bytes y el hash indicado arriba. SHA-256 y tamaño coinciden antes y después de `docker cp`. La carpeta y su manifiesto están fuera del repositorio; no se versionaron. Espacio disponible observado en C: aproximadamente 793 GB, suficiente para el dump de 332 KB, adjunto de 38 bytes y destino nuevo.

Al copiar DB y archivos, una actividad concurrente podría dejar referencias sin bytes o bytes sin metadatos. Para este ensayo se detuvo solo el API sintético durante la ventana de copia; la DB continuó disponible para `pg_dump`. Las verificaciones antes/después confirmaron la fila, relación y hash. En un entorno real se requiere ventana sin escrituras o snapshots coordinados, y reconciliar conteos/checksums; no extrapolar el procedimiento caliente como garantía de consistencia transversal.

### Destino independiente y restauración

Se añadió `entorno/recovery.compose.yaml`, combinado siempre con el Compose base y proyecto explícito `taskview-l01-b5a7e65`. El perfil `recovery` creó únicamente `recovery-db`, PostgreSQL 17 con el digest fijado del laboratorio. No publicó puertos. Su red exclusiva `taskview-l01-b5a7e65_recovery_20261114_net` tiene `internal=true` y el contenedor solo tiene esa conexión. No comparte red con el API/DB activos ni con `taskview_default`; no tiene integraciones, SMTP ni GitLab. Credenciales aleatorias propias se guardaron fuera del repo en un archivo privado con ACL del usuario actual.

El volumen nuevo `taskview-l01-b5a7e65_recovery_20261114_pgdata` estaba ausente antes de Compose; `taskview_l01_recovery` tenía cero objetos de usuario antes de restaurar. No se reutilizó el volumen de origen ni `taskview_pgdata`. Se agregó un volumen separado `taskview-l01-b5a7e65_recovery_20261114_files` montado en `/recovery-files`. El dump se verificó otra vez por hash y `pg_restore --list`, se copió al contenedor nuevo y se restauró con:

```powershell
docker exec taskview-l01-b5a7e65-recovery-db-1 sh -c 'pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/taskview-l01-taskview_l01-20261114.dump'
```

Código de salida: 0. No se usó `--clean`, no se aplicaron migraciones. `--exit-on-error` hizo fallar el proceso ante un error; `--single-transaction` evita restauraciones parciales; `--no-owner --no-acl` evita depender de los roles y grants de PostgreSQL origen. El dueño de DB/objetos es el usuario sintético de recuperación. Este dump no conserva roles globales ni privilegios ACL de PostgreSQL; los roles/permisos propios de TaskView son filas de sus esquemas y sí se restauraron.

El árbol `files/` se copió al volumen nuevo manteniendo la ruta `3/<uuid>`. SHA-256 calculado dentro del destino: `a07c0707738de32182409f3fddbc9e8f154b6589b90a1a6a4ae6846ac015c80f`, tamaño 38 bytes y un archivo. La metadata restaurada mantiene ID, proyecto, nombre, proveedor `local`, clave de almacenamiento, checksum y el vínculo a tarea 8.

### Comparación de restauración

La misma consulta de solo lectura se ejecutó contra origen y recuperación. Los valores coincidieron: versión 1.74.0; usuarios 2/2; proyectos 2 (IDs 3,4); tareas 18; subtareas 2; sprint ID 1 `completed`; outcome, retro y relaciones; roles 9/10, asignación y permisos; 20 filas de historial; un archivo y un vínculo; 367 objetos; 21 triggers; 0 padres huérfanos y 0 relaciones padre-hijo entre proyectos. Los mapas exactos padre-hijo, user-role, role-permission, usuario-proyecto, outcome y archivo-tarea coinciden con el manifiesto privado.

**Lectura funcional por API (BR07): BLOCKED.** No se levantó una API de recuperación. El overlay mantiene deliberadamente solo PostgreSQL; la API normal inicia `pg-boss` (`api/src/core/JobQueue.ts`, invocado desde `api/src/core/all-events.ts`) y no se encontró un perfil/configuración verificado de solo lectura. Evité iniciar un servicio que pueda crear o consumir jobs y modificar el destino restaurado. Las consultas SQL comprueban integridad de persistencia, pero no se presentan como prueba funcional de TaskView. La limitación queda explícita; sería necesario implementar/configurar un modo seguro de API read-only para validar endpoints sobre el destino.

### Estado de origen y recomendaciones para entornos reales

Al cierre, la DB activa mantiene esquema 1.74.0 y los mismos conteos de dos usuarios sintéticos, dos proyectos, 18 tareas y un archivo; el hash del adjunto del volumen activo sigue idéntico. API, Web, DB y Mailpit del laboratorio están ejecutándose. Los contenedores originales conservan IDs, image IDs, StartedAt, estado `running`, red `taskview_default`, volumen PostgreSQL `taskview_pgdata` y bind mounts previos de API; no se consultaron datos personales.

Para respaldo institucional se necesita una ventana de mantenimiento aprobada, destino cifrado y privado, retención/copias fuera del equipo, respaldo coordinado de DB, archivos, claves de cifrado, configuración y roles globales que correspondan; verificación de hashes, `pg_restore --list`, restauración en un ambiente aislado y prueba funcional antes de declarar recuperación. Este ensayo sintético no autoriza ni ejecutó un dump institucional.
