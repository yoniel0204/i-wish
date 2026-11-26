# Inicio y Economía · Cambios de UX

Base: I-Wish-Diseno-UX-Netlify(1)(2).zip.

## Cambios
- Tu semana conserva exactamente su resumen visible, fecha y aviso de presupuestos. Se retiraron el acceso inferior y todo el resumen desplegable asociado.
- Balance, ingresos y gastos tienen menos relleno y una distribución horizontal en teléfono, sin altura fija ni recorte de cantidades. El selector mensual y Registrar movimiento permanecen visibles.
- Tres desplegables independientes: Ver historial y distribución, Presupuestos mensuales y Metas de ahorro. Cerrados al entrar normalmente; conservan su estado durante las actualizaciones de la visita.
- Los enlaces desde Deseos abren Metas de ahorro, seleccionan activas o archivadas según corresponda y enfocan la meta vinculada.
- Historial primero y distribución después; columnas en computadora y apilados en teléfono. Se utilizan los colores existentes en ambos temas.

## Decisión de diseño y código
Se utilizan details/summary nativos: toda la fila activa el bloque y el navegador comunica su estado expandido. Los contenedores están en index.html; planner.js reconstruye solo sus cuerpos al guardar. Así la actualización no cierra el desplegable. Los formularios permanecen en sus diálogos existentes. La distribución usa barras CSS porcentuales, sin un lienzo que necesite recalcularse al abrir.

## Archivos modificados
index.html, experience.css, app.js, planner.js y sw.js. Añadido CAMBIOS-ECONOMIA-UX.md. El informe CAMBIOS-UX.md corresponde a la entrega anterior.

app.js avisa al planificador únicamente al entrar a Economía desde otra sección. planner.js conserva cálculos de planner-core.js y el almacenamiento de planner-store.js sin cambios. sw.js actualiza el nombre de caché para distribuir los recursos nuevos mediante el mecanismo existente.

## Verificado
31 comprobaciones automatizadas con JSDOM y datos ficticios locales, sin llamadas remotas:
- Igualdad del resumen semanal con el original cerrado.
- Orden, cierre inicial, apertura independiente y conservación del filtro mensual.
- Igualdad de indicadores y HTML de distribución con la base.
- Creación, edición y eliminación de movimientos; acción de crear accesible con detalles cerrados.
- Conservación de formularios al actualizar; guardado de presupuesto y meta vinculada.
- Aportes y retiros; conservación del estado de desplegables e historial interno.
- Regreso normal con bloques cerrados; enlaces desde Deseos a metas activas y archivadas, con foco.
- Ausencia de errores DOM; integridad de módulos de cálculo, almacenamiento, Diario, configuración, preferencias y estilos no afectados.
Sintaxis de todos los JavaScript y CSS validada. Estructura del ZIP comprobada.

## Pendiente
No se generaron capturas reales: no hay navegador de pruebas disponible. JSDOM no mide diseño ni valida accesibilidad real. Pendientes a 360, 390, 768 y 1440 px: ambos temas, contraste visual, texto ampliado, cantidades largas, barras al desplegar, teclado y lector de pantalla, apertura nativa de detalles anidados, área segura y controles no tapados. El estado del historial de ahorro se simuló con open=true para verificar su conservación durante el render. Pendientes también sincronización con cuenta real y actualización de caché tras publicación. No se modificó Supabase ni se publicó.

## Actualización manual
1. Conserva la versión anterior y guarda cualquier entrada en curso.
2. Descomprime este ZIP. Contiene una sola carpeta iwish-web con index.html directamente dentro.
3. Publica manualmente la carpeta completa mediante tu procedimiento habitual en Netlify.
4. Recarga la aplicación; si permanece una pestaña antigua, ciérrala y vuelve a abrir. No borres almacenamiento local.

## Resumen para MAIN
Implementado sobre I-Wish-Diseno-UX-Netlify(1)(2).zip: Tu semana sin acceso ni contenido desplegable; resumen original conservado. Economía con indicadores compactos y tres detalles independientes, cerrados al entrar y estables al guardar. Registrar movimiento visible. Deseos abre y enfoca la meta vinculada, incluidas archivadas. Modificados index.html, experience.css, app.js, planner.js y sw.js; añadido este informe. Cálculos, estructura de datos, autenticación y sincronización conservados. 31 comprobaciones DOM simuladas aprobadas y sintaxis validada. Pendientes revisión visual real, accesibilidad, teclado/área segura, caché y sincronización real. No publicado.
