# I Wish · Nueva bienvenida

Al abrir el enlace o iniciar la aplicación instalada aparece **I Wish**, **Disfruta de tu espacio**, un versículo y el botón **Wishes**.

- Incluye **50 versículos** sobre paz, esperanza, fortaleza, gratitud, sabiduría y amor. Se muestra uno por apertura, en orden aleatorio y sin repetirse hasta completar el ciclo; tampoco repite el último al iniciar el siguiente ciclo cuando el navegador permite guardar la secuencia.
- Texto de **Reina-Valera 1909**, de dominio público, conservando su redacción y ortografía. Se contrastó y extrajo de [eBible.org](https://ebible.org/spaRV1909/). Cada referencia en pantalla enlaza a su capítulo; los enlaces y los textos están en `welcome-verses.js`.
- Los versículos vienen incluidos en la aplicación: no requieren consultas a un servicio externo para mostrarse. El acceso sin conexión sigue dependiendo de haber cargado previamente la app y de disponer de sesión local.
- **Wishes** abre la sección que corresponde: tu espacio cuando hay sesión, o el inicio de sesión cuando no la hay. La bienvenida permanece visible mientras se recupera la sesión.
- Al volver a una app instalada que estaba en segundo plano se muestra nuevamente la bienvenida. Conserva la sección y el borrador que estabas usando. Se evita interrumpir la pantalla de autenticación. Cambiar de pestaña en un navegador normal no vuelve a mostrarla; abrir/recargar el enlace o regresar mediante la caché de navegación sí.
- Conserva temas claro/oscuro y distribución para teléfono/computadora. El sistema del teléfono puede mostrar primero su propia pantalla de arranque antes de cargar la bienvenida web.

**Actualización:** descarga un respaldo, descomprime `I-Wish-Bienvenida-Netlify.zip` y sube su carpeta `iwish-web` a **Deploys** de tu proyecto existente de Netlify. El `index.html` está directamente dentro. Abre con conexión y vuelve a cargar para recibir la caché nueva. No borres los datos del navegador.

**No hay cambios SQL ni de Supabase en esta actualización. No se publicó nada en Netlify.**

Archivos nuevos: `welcome.js` y `welcome-verses.js`. Modificados: `index.html`, `styles.css`, `app.js`, `sw.js` y documentación. Caché de recursos: `iwish-v9-welcome`. Los archivos del Diario, la configuración de conexión, manifiesto e iconos se conservaron byte por byte.

Pruebas de esta actualización: siete comprobaciones automatizadas de bienvenida (incluidas 100 aperturas, ciclos sin repeticiones, uso sin almacenamiento, botón de entrada, reanudación de app instalada y caché de navegación); integración completa con sesión restaurada; visitante sin sesión; y reanudación que conserva el borrador. Pruebas con DOM y eventos simulados. Pendiente la revisión visual y el ciclo real del icono/service worker en tus dispositivos tras actualizar Netlify.

**Resumen para el chat principal:** se añadió una bienvenida antes de entrar a I Wish, con “Disfruta de tu espacio”, 50 versículos RVR1909 aleatorios sin repetición dentro de cada ciclo y el botón “Wishes”. Se integra con la sesión existente, funciona con los recursos locales y conserva el borrador al reabrir la app instalada. Sin cambios de base de datos ni publicación. Entregado ZIP actualizado con una única carpeta iwish-web.

---

# I Wish · Diarios, versión 2

## Qué cambió

Al entrar en **Diario** aparecen dos opciones: **Nuevo diario** y **Continuar diario**.

- **Nuevo diario:** pide nombre y propósito. Al pulsar **Crear y escribir**, abre una página amplia para escribir.
- **Continuar diario:** muestra todos tus diarios, permite buscar por nombre y ordenar por **Última edición**, **Edición más antigua**, **Nombre A–Z** o **Nombre Z–A**.
- Cada diario agrupa sus propias entradas y borradores. Dentro puedes escribir otra entrada, continuar un borrador o abrir y editar una entrada existente.
- Las fechas de las nuevas entradas se asignan automáticamente. Las fechas de entradas importadas o anteriores se conservan. La última edición se calcula con las entradas y borradores del diario; los borradores de otro dispositivo solo aparecen allí donde se escribieron.
- El editor ocupa una vista propia: fecha, título opcional, espacio amplio y botón **Guardar**. El ánimo y la opción de descartar están plegados en **Más opciones**. Guardar mantiene la página abierta para seguir escribiendo.
- Se conservan los párrafos, temas claro/oscuro, privacidad por cuenta, conflictos entre dispositivos y funcionamiento sin conexión.

**Las entradas y borradores de la versión anterior aparecen en “Mi diario”.** No se borraron ni se reasignaron en la base de datos. Esta agrupación aparece cuando existen datos anteriores.

## Actualizar

1. En la aplicación actual, descarga un respaldo desde **Ajustes**.
2. Descomprime **I-Wish-Bienvenida-Netlify.zip**.
3. En tu proyecto existente de Netlify, abre **Deploys** y arrastra la carpeta **iwish-web**. Su `index.html` está directamente dentro; no necesitas compilar.
4. Al finalizar, abre la aplicación con conexión, cierra las pestañas antiguas y vuelve a entrar. No borres el almacenamiento del navegador.
5. Prueba **Diario → Nuevo diario**, crea uno y escribe. Espera **Guardado en tu cuenta** para comprobarlo desde otro dispositivo.

**Los cambios SQL ya se aplicaron al Supabase correcto de I Wish** (`iamcwrqrzuxxciofkorn`). No necesitas ejecutar SQL de nuevo para actualizar el sitio. **No se publicó nada en Netlify.**

Se entrega `iwish-diario.sql` como esquema completo acumulado y `iwish-diarios-v2.sql` como cambio incremental sobre la primera versión de Diario. Ambos son documentación para futuras instalaciones o traslados. La configuración sigue centralizada en `config.js`, sin cambiar la conexión ni trasladar el proyecto.

## Guardado y respaldos

- **Borrador guardado en este dispositivo:** lo escrito se conserva localmente al cambiar los campos. Todavía no es una entrada enviada a la cuenta.
- **Pendiente de sincronizar:** pulsaste Guardar; falta la confirmación de Supabase.
- **Guardado en tu cuenta:** la entrada tiene confirmación del servidor.
- Los cambios de otro dispositivo se presentan para revisión. **Conservar ambas** crea otra entrada en el mismo diario; no sobrescribe la versión reciente.

La aplicación guarda primero el diario y luego sus entradas cuando vuelve la conexión. Los reintentos usan el mismo identificador para no duplicar diarios ni entradas. Se comprueba también la cuenta de origen de cada envío.

El respaldo general pasa a **versión 7**, con Diario interno **versión 2**. Incluye diarios, entradas, operaciones pendientes y borradores de escritura. Se mantienen los respaldos generales v5/v6 y el formato anterior de Diario. La importación conserva la separación entre diarios y no sobrescribe entradas existentes; importar repetidamente el mismo respaldo no duplica los diarios importados.

Los datos locales siguen separados por proyecto y cuenta. Al salir se limpian la vista y el editor; el almacenamiento local de esa cuenta permanece para su recuperación. El texto local y los respaldos JSON no están cifrados. La sincronización funciona mientras la aplicación está abierta y dispone de sesión; no ejecuta envíos con la aplicación cerrada.

## Archivos y tablas

Modificados: `index.html`, `styles.css`, `journal.js`, `journal-store.js`, `app.js`, `sw.js` y `DIARIO-LEEME.md`.

Conservados byte por byte: `config.js`, `manifest.json`, iconos y la biblioteca local de Supabase.

- Nueva tabla **public.journal_notebooks**: identificador, cuenta propietaria, nombre, propósito y marcas de tiempo automáticas. Las políticas permiten crear y consultar únicamente diarios propios. La interfaz no modifica los metadatos de un diario ya creado.
- Nueva columna **journal_entries.notebook_id**, nullable para conservar las entradas anteriores.
- Clave foránea compuesta por diario y propietario: una entrada de A no puede pertenecer a un diario de B, ni siquiera mediante una petición directa a la tabla.
- Nueva función **iwish_create_journal_notebook**: creación idempotente, con comprobación de cuenta y RLS.
- **iwish_save_journal** acepta el diario de destino y conserva el control de versiones. Los argumentos anteriores siguen funcionando para las entradas de la primera versión.
- Migración aplicada: **iwish_diario_notebooks_v2**. Las tablas de deseos, economía y agenda permanecen intactas.
- Caché de recursos estáticos: **iwish-v8-notebooks**. Las respuestas privadas de la API siguen fuera de la caché compartida.

## Pruebas

**Pasaron 19 escenarios automatizados** del almacenamiento y la interfaz mediante DOM y servicio remoto simulados: creación sin red, recuperación del borrador en su diario, envío del diario antes de sus entradas, reintentos sin duplicados, texto seguro con párrafos, conflictos, borrado confirmado, búsqueda, cuatro órdenes, fechas automáticas, conservación del legado, respaldos e importación repetida, separación entre cuentas y errores de espacio local.

También pasó la suite de integración de la aplicación: arranque, cinco secciones anteriores, navegación y creación de diarios, saludos personalizados, respaldo v7, importación v5 sin alterar Diario y cierre/cambio de cuenta.

**En el Supabase real**, se ejecutaron pruebas con dos usuarios sintéticos y ROLLBACK: creación de diarios, reintentos, marcas de tiempo, pertenencia de entradas, bloqueo de asociaciones a diarios ajenos, RLS A/B, acceso anónimo bloqueado, comprobación de cuenta del envío, versiones, compatibilidad de llamadas anteriores y eliminación segura. No quedaron usuarios ni entradas de prueba.

Se verificaron sintaxis JavaScript, recursos locales, identificadores HTML únicos y estructura del ZIP.

**Pendiente de comprobación real:** apariencia en tu teléfono/computadora, actualización del service worker desde Netlify y flujo completo de inicio de sesión en dos dispositivos. Las pruebas de interfaz fueron simuladas, no capturas de un navegador real.

El asesor de seguridad no señaló problemas en los objetos nuevos. Mantiene la advertencia previa sobre protección de contraseñas filtradas desactivada en Auth, que se dejó intacta. [Documentación del aviso](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

El paquete `iwish-diario-pruebas.zip` contiene los tests reproducibles. No debe subirse a Netlify.

## Resumen para el chat principal

Diario se reorganizó en **Nuevo diario** y **Continuar diario**. Ahora cada diario tiene nombre, propósito, entradas y borradores propios. La biblioteca permite buscar por nombre y ordenar alfabéticamente o por última edición. Las fechas son automáticas y el editor es una vista amplia con pocas etiquetas y opciones secundarias plegadas. Las entradas anteriores se conservan en **Mi diario**.

Se añadieron `journal_notebooks` y `journal_entries.notebook_id`, con RLS y clave foránea por propietario. Se adaptaron las funciones de guardado y los respaldos (general v7/Diario v2), manteniendo la compatibilidad, los reintentos sin duplicados y los conflictos entre dispositivos. SQL aplicado únicamente en I Wish. `config.js` conserva la conexión.

Archivos modificados: index.html, styles.css, journal.js, journal-store.js, app.js, sw.js y documentación. Pasaron 19 pruebas automatizadas, la integración con DOM/servicio simulados y pruebas reales de RLS con transacción revertida. Pendiente revisión visual y uso real en dos dispositivos tras actualizar Netlify. No se publicó ni se trasladó el proyecto.
