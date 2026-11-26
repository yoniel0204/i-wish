# I Wish · Navegación y Diario

Base: `I-Wish-Diseno-UX-Netlify(1).zip`, entregado en este encargo.
Fecha: 10 de septiembre de 2026.
Estado: cambios implementados y comprobaciones automáticas aprobadas; revisión visual en navegador pendiente. No se publicó la actualización ni se realizaron operaciones en Supabase.

## Qué cambió y por qué

- La navegación móvil tiene cinco accesos en orden exacto: **Economía → Deseos → Inicio → Agenda → Diario**. Inicio ocupa la columna central. La barra es flotante, centrada, redondeada, con un borde suave del tono principal. La selección combina fondo, borde, peso de texto y `aria-current`.
- El engranaje abre Ajustes desde el encabezado. Se retiraron el botón global `+`, el menú global Más y su ventana. Las acciones para crear siguen en sus secciones y se conservan las acciones rápidas existentes de Inicio.
- Inicio ya no contiene el desplegable “Mi mes y una reflexión”. Se conserva “Para hoy” y “Tu semana”; en computadora comparten las dos columnas existentes. Economía mantiene sus importes, movimientos, presupuestos y metas.
- La reflexión está al principio de la portada privada de Diario, después del encabezado con fecha y nombre de la sección y antes de Nuevo diario / Continuar diario. Conserva las cuatro frases, sus autores y la misma selección según el día del mes. No consulta entradas privadas. Su contenedor está centrado, sin altura fija y con ancho de lectura limitado.
- Diario oculta el selector de tema superior. El engranaje permanece discreto y el tema se puede cambiar desde Ajustes.
- El control `Aa` existe únicamente en el editor y en el lector. Incluye disminuir/aumentar, los mismos tres tamaños y cierre con Escape o al pulsar fuera. Conserva la clave `iwish_appearance_v1` y su propiedad `journal`; `text` sigue controlando por separado la accesibilidad general.
- El estado de sincronización móvil que estaba en Más se trasladó a Cuenta y sincronización, dentro de Ajustes.
- Se actualizó la versión de la caché de archivos estáticos para distribuir estos cambios. No se cambió el almacenamiento de datos del usuario.

## Archivos modificados

| Archivo | Cambio | Efecto sobre otros módulos |
| --- | --- | --- |
| `index.html` | Navegación, engranaje, traslado de reflexión, controles Aa internos, estado móvil en Ajustes. | Cambia la estructura visual compartida; conserva IDs de formularios y acciones de creación. |
| `app.js` | Visibilidad del tema por ruta, actualización de reflexión separada de Inicio y retirada de referencias a elementos eliminados. | No se cambiaron funciones de autenticación, sincronización, formularios, cálculos ni respaldos. |
| `appearance.js` | Controles Aa sincronizados, misma preferencia, iconos y detección de teclado/tamaño de barra. | Solo presentación y preferencias locales. No vuelve a renderizar el formulario al cambiar Aa. |
| `experience.css` | Barra flotante, área segura, espacio inferior, reflexión, controles y foco. | Ajustes compartidos de apariencia; temas y navegación de escritorio conservados. |
| `planner.js` | Una línea: insertar Tu semana al final de Inicio, sin depender del bloque eliminado. | Evita que la eliminación de Mi mes interrumpa el arranque. No cambia reglas del planificador. |
| `sw.js` | Nombre de caché `iwish-v12-navigation-journal`. | Renovación de archivos estáticos; estrategia de red y caché sin cambios. |

Archivo nuevo: `CAMBIOS-UX.md` (este documento).

Se verificó igualdad de bytes con el ZIP original para `journal.js`, `journal-store.js`, `planner-core.js`, `planner-store.js`, `config.js`, la biblioteca Supabase incluida, `welcome.js`, `welcome-verses.js`, `manifest.json`, `styles.css` y `planner.css`. No hay migraciones ni cambios de permisos o estructura de datos.

## Pruebas realizadas

Se ejecutaron **29 comprobaciones automáticas de integridad y funcionamiento** con el HTML y JavaScript modificados en un DOM simulado con jsdom. Se usó exclusivamente una sesión ficticia y almacenamiento aislado, sin red ni acceso a Supabase. No son pruebas visuales ni una sesión real del usuario.

Las comprobaciones abarcaron:

- Sintaxis de todos los JavaScript propios, IDs sin duplicados y referencias a archivos locales presentes.
- Comparación de módulos intactos y de funciones de autenticación, cálculos, formularios, respaldos y sincronización.
- Arranque y recorridos sin excepciones; navegación por las cinco rutas, estado activo y `aria-current`.
- Inicio sin el bloque retirado, con Tu semana conservado; reflexión con el contenido y algoritmo originales.
- Engranaje funcional, cambio de ambos temas desde Ajustes y selector superior oculto en Diario.
- Aa solo dentro del lector/editor; límites de tamaño, cierre con Escape y devolución del foco al control.
- Creación de diario, captura de borrador, guardado local, lectura, edición, segundo guardado y restauración tras recarga.
- Conservación exacta de tildes, saltos de línea, caracteres especiales y selección del textarea al cambiar Aa.
- Salida hacia Ajustes con un borrador y posterior recuperación desde Continuar diario.
- Conservación de las preferencias y separación entre tamaño general y tamaño del contenido.
- Errores simulados al guardar preferencias o borradores: aviso de error sin afirmar guardado exitoso; texto visible conservado.
- Ocultación y retirada del foco de la barra con reducción simulada de `visualViewport`, restauración al cerrar y distinción respecto al zoom.
- Crear un deseo, crear/editar un movimiento y crear/editar/completar una tarea desde sus propias secciones.
- Diario inaccesible para invitado en el entorno de prueba.

Además:

- Sintaxis de los tres CSS analizada con css-tree.
- Presencia de las reglas de cinco columnas, área segura, espacio inferior, reflexión centrada, foco y movimiento reducido verificada estáticamente.
- Contraste calculado sobre los colores sólidos de la paleta: etiquetas inactivas/activas 6,21:1 / 5,53:1 en claro y 7,03:1 / 6,27:1 en oscuro; contenido sobre fondo 15,76:1 en claro y 16,48:1 en oscuro. Estos cálculos no sustituyen una medición del resultado renderizado, de mezclas de color ni del foco.
- Validación de la estructura y la integridad del ZIP final: una única carpeta `iwish-web`, con `index.html` directamente dentro.

## Pruebas pendientes

La vista previa disponible en este entorno no admite directamente este proyecto estático sin servidor de desarrollo compatible. No se añadieron dependencias de desarrollo al proyecto solo para cambiar su forma de ejecución. **No se generaron capturas reales ni se comprobó el diseño renderizado.**

Antes de considerar cerrada la validación visual, revisar:

1. Anchos de 360, 390, 768 y 1440 píxeles, en claro y oscuro, con texto normal, grande y muy grande; también texto al 200 % en navegador. Comprobar etiquetas, saltos, formularios y ausencia de desbordamiento horizontal.
2. Barra centrada, selección visible y controles cómodos; al llegar al final de cada sección, ningún contenido, acción de guardar o aviso debe quedar debajo de la barra.
3. Área segura en un teléfono real y en modo instalado; retrato y paisaje. El alto de la barra se mide para reservar espacio incluso si crece el texto.
4. Teclado virtual real en Android/iOS: escritura, cierre del teclado, cambio de orientación, control Aa, regreso de la barra y acceso al guardado. La simulación de viewport no demuestra el comportamiento físico.
5. Reflexión con textos largos: centrado y separación de Nuevo diario / Continuar diario, sin recorte. No se cambiaron las frases existentes.
6. Navegación completa con Tab, Shift+Tab y Escape, foco visible y lectura de etiquetas con tecnologías de asistencia. Solo se probó automáticamente el comportamiento de Escape del control Aa.
7. Inicio de sesión, guardado en Supabase, errores de red y sincronización entre dispositivos con una cuenta real. No se utilizaron credenciales ni se hicieron operaciones remotas.
8. Actualización de caché en una instalación existente y funcionamiento sin conexión tras la publicación manual. No se ejecutó el service worker en un navegador real.

## Actualización manual

1. Conserva el ZIP anterior. Si vas a actualizar una instalación con datos importantes, utiliza su opción existente de Descargar respaldo y termina de guardar las entradas abiertas.
2. Descomprime el ZIP actualizado. Debe aparecer una sola carpeta `iwish-web`; al abrirla verás `index.html` junto con los demás archivos.
3. Publica manualmente esa carpeta completa en tu sitio habitual de Netlify. No subas únicamente `index.html`, ni cambies el dominio o la configuración de Supabase.
4. Cierra las pestañas/ventanas anteriores de I Wish y vuelve a abrirla con conexión. Si sigue mostrando la versión previa, recarga. No borres el almacenamiento del navegador para actualizar: puede contener borradores o cambios pendientes.
5. Realiza las pruebas visuales pendientes antes de dar por finalizada la actualización.

## Una decisión de diseño y su código

El tamaño de lectura se trata como una preferencia de presentación, no como una edición de la entrada. Los botones Aa modifican `data-journal-size` en la raíz y guardan la misma propiedad `journal` que ya existía. CSS convierte ese valor en `--journal-font`, aplicado exclusivamente a `#journal-content` y `#journal-reader-content`. Así el texto, la selección y el borrador no necesitan reconstruirse y el resto de la interfaz mantiene su tamaño general.

La barra usa cinco columnas iguales (`repeat(5, minmax(0, 1fr))`): Inicio queda en el centro por el orden del HTML, sin desplazarlo artificialmente. Su altura real y el área segura forman el espacio inferior reservado al contenido.

## Resumen para MAIN

Se implementaron los ajustes de diseño sobre `I-Wish-Diseno-UX-Netlify(1).zip`: barra móvil flotante Economía → Deseos → Inicio → Agenda → Diario; engranaje superior; eliminación de + y Más globales; Inicio sin Mi mes/reflexión; reflexión original trasladada a la portada de Diario; selector de tema oculto en Diario y Aa solo en lector/editor con la preferencia existente. Se conserva Tu semana y la navegación de escritorio.

Archivos modificados: index.html, app.js, appearance.js, experience.css, planner.js (solo anclaje visual de Tu semana) y sw.js (versión de caché). Se añadió CAMBIOS-UX.md. No cambiaron autenticación, cálculos, permisos, estructura de datos ni módulos de almacenamiento. No se publicó ni se hicieron operaciones en Supabase.

Pruebas: 29 comprobaciones automáticas aprobadas en DOM simulado, con sesión ficticia y almacenamiento aislado; sintaxis de JS/CSS, integridad, rutas, creación/edición/guardado local, recuperación de borradores, preferencias, errores y teclado simulado. Contraste calculado sobre los tokens de ambos temas. Pendientes: revisión visual real a 360/390/768/1440, texto aumentado, foco completo, teclado/área segura en dispositivo, service worker y sincronización con cuenta real. No hay capturas reales. Implementación lista para publicación manual; validación visual aún pendiente.
