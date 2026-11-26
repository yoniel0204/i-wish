# I Wish 2.0 · Entrega 2 configurada

**Versión de revisión** `2.0.0-alpha.2`. **Base** `2.0.0-alpha.1`, SHA-256 del ZIP `5927eb10ab961bc280e3375b06044815844cf85956da720260711d9b03f293a3`.

## Para el chat revisor

| Archivo | Cambio |
| --- | --- |
| `iwish-web/planner-store.js` | Coordina escrituras de todas las pestañas con Web Locks. Dentro del bloqueo relee los datos vigentes y aplica solo la mutación solicitada. El tema es una mutación independiente. La sincronización tiene su propio bloqueo y conserva las ediciones hechas durante la solicitud. |
| `iwish-web/app.js` y `index.html` | Compara el registro vigente con el que se abrió antes de guardar. Ante edición o borrado concurrente, mantiene el formulario y ofrece descargar los campos en JSON. El cierre y la confirmación suceden después de guardar. |
| `iwish-web/planner.js` y `routine-ui.js` | Esperan la confirmación asíncrona del almacén compartido. |
| `iwish-web/config.js`, `journal.js` y `sw.js` | Configuración del nuevo proyecto de Supabase, claves locales por proyecto y usuario y nueva versión de caché. La sincronización remota de esta entrega se limita a tareas y eventos de Agenda. Rutinas, deseos, economía y diario quedan locales. |
| `supabase/001-agenda.sql` | Crea una tabla con RLS y un RPC que compara la versión de base antes de escribir. Usa el propietario autenticado, conserva los borrados y admite el reintento de una escritura ya aplicada. |
| `tests/` | Contiene regresiones simuladas, pruebas en navegador y pruebas del esquema en PostgreSQL local. |

**Decisión de arranque.** La cuenta de destino empieza vacía. La versión nueva usa el prefijo `iwish_e2` con el origen del proyecto y el ID del usuario. Las versiones anteriores siguen usando sus claves originales. Si vuelves a una versión anterior, las tareas creadas en E2 quedan disponibles al regresar a E2. Un cambio remoto que todavía no llegó al navegador se detecta por comparación de versiones al sincronizar. El guardado requiere un navegador con Web Locks en un contexto seguro.

## Evidencia

| Caso | Esperado y observado | Entorno |
| --- | --- | --- |
| F01. Crear tareas distintas en dos pestañas sin conexión, cambiar el tema y recargar | Persisten ambas tareas, el deseo de prueba y el tema. La recarga funciona sin conexión. | Chromium 153 |
| E1-01. Otra pestaña edita o borra una tarea con el formulario abierto | Se conserva la versión reciente o el borrado y se puede descargar el borrador rechazado. | Chromium 153 |
| Crear, editar, completar, borrar y recargar | Los cambios confirmados se conservan. | Chromium 153 |
| Fallo de cuota y reintento | El diálogo conserva el contenido. El reintento guarda una sola vez. | Chromium 153 con fallo inyectado y regresiones simuladas |
| E1-02. Abrir los almacenes anteriores sobre el mismo navegador | E1 conserva el importe 25. La base auditada recupera 10 al incorporar su copia vieja. Los datos E2 quedan intactos y visibles tras recargar E2. | Chromium 153, almacenes de ambas versiones anteriores y datos de prueba |
| Esquema, escrituras repetidas, conflictos y permisos | La cuenta B no lee ni actualiza registros de A. Un intento de insertar como A falla. El rol anónimo no puede leer ni ejecutar el RPC. | PostgreSQL local en PGlite, identidad de Supabase simulada |

Desde la carpeta raíz, ejecuta `node --test tests/guardado-local.cjs`. Pasaron **8 de 8** casos. Para repetir las demás pruebas instala Playwright con Chromium y `@electric-sql/pglite` en el entorno de revisión. Ejecuta `node tests/navegador.cjs` y `node tests/supabase-sql.cjs`. Para el caso de vuelta atrás en navegador, indica las rutas a las carpetas `iwish-web` de las versiones anteriores en `IWISH_E1_DIR` y `IWISH_AUDIT_DIR`.

## Configuración de destino y publicación

- El archivo `iwish-web/config.js` contiene la URL y la clave publicable del proyecto nuevo. La cuenta empieza vacía. El propietario confirmó que ejecutó `supabase/001-agenda.sql` correctamente.
- **Comprobación directa en Supabase alojado.** Auth aceptó la clave publicable y devolvió HTTP 200 en `/auth/v1/settings`. Sin sesión, la tabla de Agenda y la función de sincronización rechazaron el acceso con HTTP 401 y código PostgreSQL `42501`.
- Para un despliegue manual se publica la carpeta `iwish-web`, que contiene `index.html`. [Guía de Netlify](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/)

**Pendiente en el sitio de prueba.** Configurar la URL en Supabase Auth, probar registro o inicio de sesión, crear y editar una tarea, comprobar los cambios desde otro dispositivo, verificar que una segunda cuenta no ve los datos de la primera y repetir con completar y borrar. El sitio principal de Netlify queda pendiente de esas comprobaciones.
