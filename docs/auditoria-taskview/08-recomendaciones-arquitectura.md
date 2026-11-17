# 08 — Recomendaciones de arquitectura

## Saneamiento de logs de autenticación verificado — 2026-11-14

La observación R1 de [acta 13](13-acta-propuesta-cierre-lista01.md) quedó corregida en fuente: `AuthModel` ya no serializa filas completas, códigos, login/correo ni excepciones crudas; `AuthController`, envío SMTP y middleware de identidad registran solo operación y resultado en las rutas detectadas. Pino incorpora redacción de campos estructurados como defensa adicional, sin usarla para justificar cadenas sensibles. Prueba nueva en memoria **6/6 PASS** con marcadores sintéticos ausentes de logs; regresiones scratch de AuthModel **13/13** y API auth **23/23 PASS**; 8 unitarias relacionadas PASS, typecheck y build API PASS. Una imagen API nueva, exclusiva del laboratorio, incorpora el bundle; no se sustituyó la API activa ni la instalación original. [Evidencia detallada](12-seguridad-deuda-tecnica.md#corrección-de-seguridad-authmodel--2026-11-14).

**Recomendación técnica actual: APTA PARA CIERRE DE LISTA 01, sujeta a aceptación formal del responsable de las deudas condicionadas y de las restricciones de despliegue.** R1 ya no es un bloqueante de fuente; los logs históricos no se inspeccionaron y no se certifica el runtime de la API activa del laboratorio. Puertos originales en múltiples interfaces, firewall observado desactivado y alcance remoto no comprobado siguen exigiendo decisión operativa antes de exponer servicios. Los 18 errores lint API, 48 web, suites pendientes, scopes y concurrencia Kanban conservan las puertas de control por módulo. El acta y la Lista 01 continúan sin aprobación formal; Lista 02 no empezó.

## Correcciones obligatorias verificadas — 2026-11-14

La imagen web nueva `taskview-l01-web:security-20261114` ya se usa **solo** en el laboratorio autorizado; el probe puntual comprobó login, refresh y logout sin tokens en consola. El problema de doble rebalanceo Kanban fue reproducido (2 escrituras y 2 versiones para vecinos invertidos) y corregido al eliminar una rama duplicada; 6/6 tests sintéticos pasan. Estos resultados sustituyen las notas históricas inferiores que pedían construir la imagen o reproducir Kanban. La corrección API está en fuente y bundle local, no desplegada en las API activas. [Evidencia](12-seguridad-deuda-tecnica.md).

La dependencia directa `@eslint/js` 9.39.3 permite ejecutar ESLint web de forma reproducible con lockfile congelado. El diff del lockfile se limita a tres líneas de su importador. Los 48 errores web son de estilo y no bloquean funcionalmente Lista 02; los 18 API requieren revisión por archivo, sin autofix ni supresión. Para CI estricto, acordar tratamiento de los 66 diagnósticos o un gate acotado explícito, sin presentarlos como PASS.

El original conserva API/web en `0.0.0.0` y `[::]`; listeners Windows y firewall desactivado se verificaron, pero no hubo prueba desde otra máquina ni inspección de reglas detalladas por `Access denied`. El responsable de infraestructura debe evaluar consumidores, controles de red externos y una mitigación autorizada (loopback o proxy/firewall explícito) antes de usarlo como servicio expuesto. No se alteró esa instalación. La matriz de permisos existente para tareas, jerarquía, Kanban, sprint, responsables, roles, scopes, archivos y cierre está en 12; exigir pruebas de scopes al ampliar cada flujo. El contrato Kanban no envía versión esperada, por lo que resolver concurrencia real requeriría diseño de contrato y transacción, fuera de esta corrección mínima. **Recomendación: APTA CON CORRECCIONES OBLIGATORIAS**, sin cierre automático de Lista 01.

## Actualización de seguridad y deuda — 2026-11-14

La recomendación técnica actual es **APTA CON CORRECCIONES OBLIGATORIAS**, sin cierre automático de Lista 01. El informe [12 — Seguridad y deuda técnica](12-seguridad-deuda-tecnica.md) contiene evidencia, clasificación de los 66 errores lint, suites pendientes y matriz de riesgos. Esta actualización prevalece sobre recomendaciones históricas de la tabla siguiente que dicen que no había dependencias instaladas, builds o pruebas, o que el log de tokens queda para una actividad futura.

Se retiró el log de tokens y respuesta de refresh en fuente web, junto con dos rutas de log de errores que podían contener configuración Axios o códigos de acceso. Typecheck y build web PASS; la imagen en uso todavía no incorpora la corrección. Antes de uso real, reconstruir y comprobar artefacto en un procedimiento autorizado. El original conserva 1725/8888 publicados en todas las interfaces; infraestructura debe evaluar exposición/firewall y aplicar control autorizado. No se modificó la instalación original. La red del laboratorio con masquerading deshabilitado reduce egreso ordinario, pero no sustituye firewall. Mailpit queda limitado a sintéticos en loopback.

El `Proxy` actual del migrador conserva por inspección argumentos, SQL, retorno y receptor de `client.query`; no se ejecutó migración. El `pg_terminate_backend` filtrado por `DB_NAME` puede afectar una base protegida si el destino se configura mal. Exigir guardia de identidad física y aprobación de destino antes de cualquier migración Scrum, además de revisar SQL con literales potencialmente sensibles en diagnósticos. Las 48 faltas web son de estilo; los 18 errores API se clasifican en 12. La falta de dependencia directa `@eslint/js` impide reproducir el gate de ESLint web sin workaround de proceso; su arreglo con lockfile corresponde a actividad autorizada posterior.

Para trabajo Scrum, priorizar pruebas acotadas de scopes de token, `start*`, roles, orden Kanban, auth/proyectos/subtareas/dashboard en un laboratorio exclusivo antes de editar esas superficies. Hay una posible doble solicitud de rebalanceo en `KanbanManager` cuando el orden recibido es adverso; requiere un test reproductor antes de cambiar lógica. S3 puede diferirse únicamente si el despliegue se mantiene en almacenamiento local; MCP si no es interfaz del alcance. Los proveedores de correo, SSO y webhooks requieren dobles sintéticos cuando se activen. Ninguna suite pendiente se ejecutó en esta revisión.

## Hallazgos y prioridad

| Prioridad | Hallazgo sustentado | Consecuencia / acción recomendada |
|---|---|---|
| Crítica si se dirige a la instancia activa | `api/src/migrations/migrate.ts:disconnectOthers` usa `pg_terminate_backend`; el Compose original invoca migración al arrancar | Mantener esta operación exclusivamente en base nueva. Prohibir reutilizar Compose/volúmenes activos para pruebas; configuración separada entregada. No se ejecutó el migrador. |
| Alta | `web/src/plugins/axios.ts` imprime token y respuesta de refresh en console | Posible exposición en herramientas de navegador/capturas. Retirar logs sensibles en cambio posterior expresamente dedicado y verificar manejo de errores sin response. No se capturaron tokens reales. |
| Alta | El árbol solicitado es posible, pero `SprintsRepository` filtra raíces en planificación y suma; burndown incluye todas las tareas del sprint | Épicas como tareas pueden ocultar historias y duplicar puntos. Resolver estrategia de jerarquía y métricas antes del primer cambio de esquema. |
| Alta | Imágenes `latest` sin revisión OCI; manifiesto runtime 1.17.0 distinto de paquetes 1.58.2, esquema 1.74.0 | No inferir compatibilidad por una única versión. Fijar digest, registrar SHA en futuras imágenes, reconstruir/validar en laboratorio. |
| Alta | Host Node 20; Node 24.22.2 portable y pnpm 10.28.1 ya verificados en la continuación. Aún sin node_modules; pruebas usan configuración privada/puertos heredados | El bloqueo de herramientas se resolvió, pero no hay evidencia de build/regresión: el usuario pausó antes de instalar dependencias. Resolver pruebas y ejecución antes de aprobar implementación Lista 02. |
| Alta | `SprintsRepository.applyClose` acepta tareas completas; `SprintsManager.deleteSprint` permite eliminar completados | Cierre no demuestra QA; historial Scrum puede desaparecer por cascadas. Definir conservación y requisitos de evidencia. |
| Media | `SprintsManager.getBurndown` calcula desde estado/estimación actuales y fecha de terminación | Cambios de alcance o estimación alteran pasado; evaluar snapshots/eventos históricos al ampliar analítica. |
| Media | `api/src/migrations/migrate.ts` captura errores individuales y registra mensajes; usa callbacks async no esperados en descripciones | No confiar solo en exit code; revisar logs, versión, objetos y transacción al ensayar. Proponer mejoras del ejecutor en cambio independiente, sin ejecutarlo aquí. |
| Media | `integrations/providers/gitlab.provider.ts` usa scope OAuth `api` y registra hooks de issues; `IntegrationsManager` sincroniza estados | La conexión puede escribir en GitLab. Revisar scopes, callbacks, permisos y reintentos; no conectar a institución en Lista 01. |
| Media | `integrations/IntegrationsController.ts` inicia OAuth con token en query y hay instrumentación `debugLog.ts` | Evaluar filtrado de logs/accesos y retiro de instrumentación temporal antes de integración institucional. No se publican valores. |
| Media | Constraints/triggers SQL y Drizzle no son equivalentes; muchas reglas fuera de ORM | Extensiones requieren revisar SQL, SDK, validadores, permisos e importación/movimiento conjuntamente. |
| Media | Adjuntos fuera de PostgreSQL y configuración cifrada separada | Respaldo DB solo es incompleto; probar recuperación conjunta según 05. |

No se verificaron vulnerabilidades explotables ni se hizo escaneo de CVE; los puntos de seguridad son hallazgos de código y configuración con su alcance indicado. El acceso a puertos actuales está publicado por Docker en todas las interfaces según `docker ps`; revisar exposición de red/firewall en una etapa de despliegue autorizada, sin cambiarlo aquí.

## Arquitectura evolutiva recomendada

Conservar monolito modular Express y SPA Vue. Para dos programadores, separar microservicios ahora añadiría coordinación operativa sin una necesidad demostrada. Reutilizar módulos de tareas, sprints, Kanban, archivos, colaboración e integraciones. Mantener el flujo Routes/Controller/Manager/Repository y middleware de permisos; introducir límites explícitos dentro de esos módulos cuando la funcionalidad lo requiera.

En Lista 02 redactar una decisión comparando tarea tipada frente a épica separada. Criterios: visibilidad de historias en planificación, conservación de IDs, filtros de jerarquía, agregación de estimaciones, traslado de tareas y sincronización de issues. No definir aún una migración concreta. La preferencia técnica es extender tareas para conservar relaciones existentes, pero depende de pruebas de los filtros indicados en 03.

Aplicar cambios aditivos con compatibilidad para tareas antiguas y clientes SDK; valores por defecto y backfill explícito ensayado. Alinear esquema Drizzle, SQL, DTO/ArkType/Zod, SDK `taskview-api`, stores y UI; preservar API actual. No reemplazar `goals` por una tabla nueva de proyectos ni crear permisos paralelos.

Separar responsabilidades Scrum de permisos: reutilizar N:M de colaboración; definir matriz de acciones por proyecto, accesos API y QA. Las reglas de relaciones y transiciones deben ejecutarse en servidor, con pruebas de acceso cruzado, ciclos y operaciones concurrentes.

Para GitLab, aprovechar `GITLAB_BASE_URL`/`GITLAB_API_URL` configurables y mapeos actuales. El servidor institucional no fue contactado. Son pendientes su versión, certificados, conectividad, scopes, callback alcanzable, política de tokens, proyecto de ensayo y comportamiento de webhooks/reintentos. Futuras ramas/commits/MR/pipelines deben correlacionar IDs estables y ser idempotentes, con control de permisos y retención; no basta guardar una URL en notas.

## Modularidad y actualizaciones upstream

Preferir componentes nuevos pequeños sobre `web/src/extensions/` cuando sus puntos de extensión alcancen; verificar sus contratos, sin asumir extensibilidad equivalente de backend. Evitar editar `web__old`. Mantener migraciones personalizadas ordenadas y diferenciadas, sin renumerar las del proveedor; verificar cómo coexistirán con `app.version` antes de escoger convención. No asumir que versión de producto y de esquema coinciden.

Registrar en cada entrega los contratos públicos modificados y pruebas de compatibilidad; actualizar imágenes propias con SHA y digest sin sustituir etiquetas originales. Revisar cambios upstream mediante diff y ensayar migraciones en copia restaurable. Mantener licencia/copyright y una identidad de producto conforme a 05.

## Dependencias de próximas listas

No se recibió el detalle de listas posteriores a Lista 02; el siguiente orden es una recomendación, no una redefinición de sus requisitos:

1. Resolver herramientas y pruebas/aislamiento pendientes de Lista 01.
2. Lista 02: decisión de modelo jerárquico, semántica de tareas/bugs, reglas y compatibilidad; plan de migración con reversibilidad por restauración verificada.
3. Vistas de backlog y planificación dependen de tipos/jerarquía y política de estimación.
4. QA, DoD y criterios dependen de estados, permisos y auditoría definidos.
5. Métricas dependen de reglas de cierre, alcance e historia fiables.
6. Trazabilidad GitLab avanzada depende de IDs, contratos/eventos y un proyecto de integración sintético.

No se comenzó ninguna de estas implementaciones.
