# Mi rutina · I Wish

Base: I-Wish-Inicio-Economia-UX(1).zip. Los dos adjuntos eran idénticos byte por byte (SHA-256 bc8e36da807805e80de91d16d44d236ff7d62dc4ee3fe43c1cbd9e8a67b58a2a).

## Experiencia implementada

En Agenda, Mi rutina aparece inmediatamente debajo de + Agendar. Abre una vista interna con regreso a Agenda, sin cambiar los cinco accesos principales. Allí se encuentran Crear rutina, las rutinas completas, las actividades anteriores pendientes y las rutinas anteriores. La administración de rutinas ya no aparece directamente al final de Agenda.

Cada rutina completa muestra nombre, categoría, semanas, inicio, fin y estado (Programada, En curso, Pausada o Finalizada). El estado finalizado depende del período, no de haber completado una sola actividad.

Creación en tres pasos:
1. Datos: nombre, semanas enteras positivas, inicio editable y categoría. Inicio usa la fecha de Panamá. El fin se calcula como inicio + semanas × 7 − 1 días.
2. Actividades: nombres, días, horas, descripciones y recordatorios propios. Se añade o edita una actividad a la vez. Atrás conserva incluso la actividad incompleta. La acción de cancelar pide confirmar el descarte.
3. Revisión: distribución de lunes a domingo y fechas del plan. Solo se generan las repeticiones dentro del período. Se rechaza repetir el mismo nombre de actividad en el mismo día y hora dentro de la rutina.

Estudio y Deporte son categorías iniciales. Una categoría personalizada se guarda al guardar la rutina y queda disponible para las siguientes del mismo usuario. Los nombres se normalizan por espacios, Unicode y mayúsculas/minúsculas. Las categorías usadas siguen disponibles aunque se cambie la categoría de la rutina.

La vista de cada rutina permite revisar cualquier semana, completar u omitir fechas, reabrirlas, editar una fecha concreta y pausar/reanudar. Las actividades aparecen también en la lista y calendario de Agenda, y alimentan Inicio y Tu semana desde la misma proyección, sin copiarlas a eventos. En Agenda se muestran las actividades de rutina del mes del calendario, o del día seleccionado. Los eventos normales conservan sus filtros anteriores.

## Historia y decisiones de edición

Las rutinas anteriores no se convierten ni eliminan. Mantienen sus identificadores, versiones, periodicidad diaria/semanal/mensual, pausas y repeticiones. Se muestran como actividades individuales en Rutinas anteriores, con duración original o abierta cuando no hay fecha final.

Una rutina completa que ya comenzó conserva su inicio. Para modificar la planificación se elige una fecha desde mañana en adelante; hoy y el pasado no se reescriben. Los identificadores de actividades existentes se mantienen y se añaden versiones futuras. Retirar una actividad detiene sus nuevas repeticiones, conservando versiones e historial. El formulario de una fecha individual solo modifica esa fecha; la planificación general se cambia en Editar rutina.

Pausar no modifica ni amplía la fecha final. Reanudar no crea repeticiones para los días pausados. Se mantiene el comportamiento existente por el que las instancias con estado registrado sobreviven como historial. No se permite cambiar el período de modo que deje fuera una fecha con estado registrado. Las rutinas finalizadas se consultan; una nueva etapa se crea como una nueva rutina.

## Diseño y accesibilidad

La composición reutiliza la paleta, contraste previsto, preferencias de texto y temas existentes. Listado en dos columnas en computadora y una en teléfono; revisión semanal en cuatro columnas en computadora y dos en teléfono. Días con etiquetas completas para tecnologías de asistencia, controles de al menos 44 px, foco visible, pasos con aria-current y errores con role=alert. El diálogo adapta su altura a la ventana y área segura. Se conserva el manejo existente de teclado y navegación inferior.

La decisión principal es separar el plan general de la edición de una actividad. routine-ui.js mantiene un borrador en memoria entre pasos; los renders del listado no reconstruyen el formulario. El borrador no se promete como recuperable después de cerrar la pestaña: debe guardarse antes de salir.

## Modelo de datos y sincronización

Se conservan las colecciones budgets, goals, transfers, routines y occurrences y la llamada existente iwish_sync. No se añadieron tablas, buckets, servicios, credenciales ni operaciones remotas.

Una rutina completa ocupa UN registro de routines, de modo que sus datos generales y actividades se envían juntos mediante la cola por registro:

- versions: [] (las rutinas anteriores conservan aquí sus versiones originales).
- pauses: intervalos originales de pausa del plan.
- program: schema=1, name, category, categories, weeks, start, end y activities.
- Cada actividad tiene un UUID estable y versions; stoppedFrom limita actividades retiradas sin borrar su historia.
- Identificador de repetición nueva: UUID-rutina/UUID-actividad:AAAA-MM-DD.
- occurrences conserva routine (UUID del plan), activity (UUID de actividad), date, estado e historial. Las repeticiones anteriores siguen usando UUID-rutina:AAAA-MM-DD.

planner-core.js genera ambas formas. La separación entre cuentas usa el propietario existente del almacenamiento y la sincronización. snapshot/import transportan actividades, categorías e historial dentro de las colecciones existentes. Se conserva la resolución de conflictos de la cola.

planner-store.js incluye una corrección necesaria para el guardado: put/batch revierten el cambio de memoria si falla la escritura local. El formulario permanece abierto con un mensaje de error, sin anunciar éxito. El mensaje de rutina guardada indica conservación en este dispositivo y sincronización pendiente. Los avisos continúan limitados a la aplicación abierta; Sin recordatorio es distinto de A la hora.

### Base de datos: alcance y pendiente para MAIN

No se preparó una migración SQL: el cambio de cliente conserva las colecciones y el contrato de transporte existentes. Sin embargo, los ZIP no incluyen la definición SQL de iwish_sync ni sus validadores. No se puede afirmar desde estos archivos que el servidor acepte el nuevo contenido de routines y los identificadores de occurrences. Se comprobó la ida y vuelta con un servidor simulado que cumple el contrato actual; no con Supabase real.

Antes de publicar, MAIN debe comprobar en un entorno de prueba que la función remota almacena y devuelve sin pérdida el JSON del programa y admite los identificadores de repeticiones nuevos. Si existe validación de la estructura antigua o de identificadores, se necesitará una migración compatible basada en esa definición real. No se inventó SQL ni se realizaron operaciones remotas.

Actualizar todas las pestañas y dispositivos a esta versión antes de crear rutinas completas: versiones antiguas del cliente no conocen program ni sus identificadores. Los respaldos anteriores sí se admiten en esta versión; un respaldo con rutinas completas requiere esta versión o posterior.

## Archivos

Modificados:
- index.html: acceso, contenedores y carga de nuevos recursos.
- app.js: integración de actividades en Agenda e Inicio y regreso a Agenda.
- planner-core.js: validación y proyección de actividades agrupadas, conservando rutinas antiguas.
- planner-store.js: reversión de memoria si falla el guardado local.
- planner.js: integración con Mi rutina y acciones/recordatorios por repetición.
- sw.js: nueva versión de caché y nuevos recursos.

Añadidos:
- routine-core.js: fechas, categorías, estados y versiones del plan.
- routine-ui.js: vista interna, detalle y formulario progresivo.
- routine.css: adaptación visual y controles.
- CAMBIOS-MI-RUTINA.md: este informe y resumen para MAIN.

Sin cambios: configuración y proveedor de autenticación, archivos de Diario, apariencia general, styles.css, experience.css y planner.css. No se modificaron cálculos de dinero ni reglas de ahorro. Los informes CAMBIOS-UX.md y CAMBIOS-ECONOMIA-UX.md corresponden a entregas anteriores.

## Pruebas realizadas

81 comprobaciones automatizadas con datos ficticios:
- 30 del motor y almacenamiento: duración inclusiva, año nuevo, febrero bisiesto, día de Panamá, validaciones, cinco sesiones semanales por cuatro semanas (=20), identificadores únicos, recordatorios opcionales, estado independiente, resumen semanal, historial tras editar/retirar, pausa, reanudación, categorías, rutinas anteriores y fin de mes, respaldos, cambio de cuenta, fallos de almacenamiento e ida/vuelta del contrato de sincronización simulado.
- 22 de interfaz con JSDOM: acceso bajo Agendar, vista interna, validaciones, conservación de actividad incompleta al retroceder, tres actividades y revisión de siete días, guardado, Agenda sin duplicados, finalización desde Agenda, categoría reutilizable, cancelación, edición futura, pausa/reanudación, regreso por navegación, edición individual, error de guardado y recuperación tras recargar.
- 29 de regresión de Inicio/Economía: resumen de Tu semana idéntico a la base, indicadores, tres desplegables, filtros, movimientos, presupuestos, metas, aportes/retiros, vínculos desde Deseos y archivos no afectados.

Sintaxis de todos los JavaScript y CSS validada. ZIP comprobado con una sola carpeta iwish-web e index.html directamente dentro. Los datos de prueba no se incluyen en la aplicación.

### Pendiente, sin atribuirlo a las pruebas anteriores

JSDOM no renderiza ni mide la interfaz. La conexión al navegador estuvo disponible, pero su acceso a la aplicación local fue bloqueado con ERR_BLOCKED_BY_CLIENT. No se publicaron archivos para sortear esa restricción y no se generaron capturas reales.

Pendientes: revisión visual a 360, 390, 768 y 1440 px; ambos temas; texto ampliado; contraste medido y lector de pantalla; teclado real y foco; áreas seguras y ausencia de contenido tapado; desplazamiento del diálogo; comportamiento nativo de detalles; actualización real de caché. También quedan pendientes Supabase real, conflictos entre dispositivos reales, respaldos mediante el selector de archivos de un navegador real y notificaciones del sistema operativo.

## Actualización manual

1. Guarda los borradores y exporta un respaldo desde Ajustes.
2. Conserva la versión anterior. MAIN debe resolver la comprobación de compatibilidad remota descrita arriba antes de publicar.
3. Descomprime el ZIP: contiene únicamente iwish-web y dentro está index.html.
4. Cuando corresponda, publica manualmente la carpeta completa mediante el procedimiento habitual de Netlify. No hay publicación realizada en esta entrega.
5. Cierra las pestañas antiguas y abre la versión nueva en todos los dispositivos antes de crear rutinas completas. No borres el almacenamiento local.
6. Comprueba Crear rutina → guardar → recargar y después la recuperación desde un segundo dispositivo. La indicación de guardado local por sí sola no demuestra sincronización.

## Resumen para MAIN

Implementado Mi rutina dentro de Agenda sobre los dos ZIP adjuntos, que eran idénticos. Acceso debajo de + Agendar; listado y detalle internos; formulario Datos → Actividades → Revisión; varias actividades por rutina; categorías propias reutilizables; fechas inclusivas de Panamá; edición futura y pausa sin extensión; rutinas anteriores conservadas como actividades individuales. Actividades integradas con Agenda, Inicio y Tu semana mediante la proyección existente.

Datos agrupados en un único registro de routines con program; occurrences incorpora activity e identificadores rutina/actividad:fecha. No hay nuevos buckets ni llamadas remotas. Guardado local revierte memoria en caso de error. Se preservan respaldos y la cola por cuenta.

Modificados index.html, app.js, planner-core.js, planner-store.js, planner.js y sw.js. Añadidos routine-core.js, routine-ui.js, routine.css y este informe.

81 comprobaciones automatizadas aprobadas; sintaxis y ZIP validados. Sin capturas ni validación visual real. Pendientes servidor real, accesibilidad visual, teclado/área segura y caché. La definición SQL de iwish_sync no estaba adjunta: verificar aceptación del nuevo payload e identificadores antes de publicar; si hay validadores antiguos, preparar migración compatible con su definición real. Todos los clientes deben actualizarse antes de crear rutinas completas. No se publicó ni se modificó Supabase.
