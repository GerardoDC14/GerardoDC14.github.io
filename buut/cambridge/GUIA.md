# BUUT · Cambridge — guía de exhibición

Abre **https://gerardodc14.github.io/buut/cambridge/** o escanea `qr.png`. La entrada https://gerardodc14.github.io/buut/ conduce a esta edición. Puedes mostrar la clave: forma parte de una presentación pública, no es autenticación privada.

- Organización: Cambridge.
- Presentador: Ernesto Martín del Campo García.
- Usuario: `cambridge.ernesto`.
- Clave de exhibición: `CambridgeDemo2026!`.

Usa únicamente datos ficticios. Esta edición estática vive en GitHub Pages: funciona con la computadora de desarrollo, Rust y el túnel apagados. Necesita Internet para abrirse; no promete uso offline después de vaciar la caché. Una vez abierta, las interacciones no consultan servicios BUUT.

## Dos formas de presentar

**Explorar libremente:** entra, busca a Valeria Sotomayor y recorre las seis secciones. Guarda una actividad ficticia, modifica el estado del expediente, abre las versiones 1 y 2 del documento y descarga ambas. Cambia honorarios y gastos, guarda la cotización y descarga su texto. Abre Reportes y descarga el CSV o imprime. Las fichas, estados, importes e historial se conservan sólo en ese navegador.

**Presentación automática:** en Inicio, pulsa Presentación automática. Dura aproximadamente **2 minutos y 30 segundos**, diez segmentos de 15 segundos:

| Tiempo | Pantalla | Guion sugerido |
| --- | --- | --- |
| 0:00–0:15 | Inicio | «BUUT conecta la atención: del primer contacto a una entrega con contexto». |
| 0:15–0:30 | Cliente | «La ficha reúne la información que necesitamos consultar durante el asunto». |
| 0:30–0:45 | Cliente actualizado | «Una corrección permanece en el caso; aquí la actividad cambia con un ejemplo ficticio». |
| 0:45–1:00 | Expediente | «El asunto mantiene su vínculo con el cliente, sus observaciones y su estado». |
| 1:00–1:15 | Estado actualizado | «El avance queda visible para continuar la atención». |
| 1:15–1:30 | Documento, versión 1 | «Podemos consultar el borrador original y sus pendientes». |
| 1:30–1:45 | Documento, versión 2 | «El nuevo borrador conserva el anterior; ambas versiones son descargables». |
| 1:45–2:00 | Cotización | «Los honorarios y gastos producen un resumen claro. Los importes y el IVA son ilustrativos». |
| 2:00–2:15 | Reporte | «El reporte reúne cliente, estado, versiones e importe y permite una descarga real». |
| 2:15–2:30 | Inicio | «Ernesto puede explorar libremente o repetir la presentación». |

Pausar detiene el reloj; Continuar lo reanuda. Anterior y Siguiente cambian de segmento. Volver al inicio regresa al primero y pausa. Al concluir, Repetir inicia nuevamente el recorrido; Cerrar recorrido devuelve el control libre. Al cambiar de pestaña, la presentación pausa para no avanzar fuera de vista. Las descargas requieren pulsar sus controles; el recorrido no descarga archivos automáticamente.

## Alcance y límites

**Interacciones reales locales:** búsqueda, edición de cliente/expediente, cambios de estado, historial, selección y descarga de versiones, incorporación de muestras .txt (hasta 250 KiB, ocho versiones), cálculo aritmético ilustrativo, descarga de cotización .txt, CSV, impresión, presentación y reinicio. No se envían archivos a un servidor. Los formatos y límites de esta edición no modifican los de BUUT Rust.

**Contenido preparado:** identidad del caso, documentos, estados iniciales e importes son ficticios. El acceso Cambridge es público. No comprueba permisos privados, cumplimiento normativo ni exactitud fiscal.

**Próximas etapas independientes:** alojamiento permanente del servicio Rust, acceso privado, datos compartidos y sus controles; OCR y GPTLegal requieren sus investigaciones y validaciones. No se muestran resultados de OCR/GPTLegal como si fueran servicios activos. Esta publicación no incluye mapa de relaciones ni planeación. Su código y datos permanecen en el repositorio principal BUUT.

La clave local de datos es `buut.cambridge.scenario.v1`; la entrada de exhibición usa `buut.cambridge.exhibition.v1` en sessionStorage. Reiniciar demostración, con confirmación, restaura solamente esta edición; no borra otros sitios ni perfiles BUUT. Salir cierra la puerta de exhibición de esa pestaña, sin prometer protección de datos públicos. Si el navegador bloquea o agota almacenamiento, aparece un aviso y los cambios sólo duran la sesión. No uses navegación privada si necesitas conservarlos.

## Actualización y retorno

La fuente canónica se conserva en `GerardoDC14/BUUT`, carpeta `showcase/cambridge/`. El repositorio personal publica una copia en `buut/cambridge/` y la portada de `buut/`. No editar la raíz, `/panel/` ni otros proyectos para actualizar BUUT.

1. Edita la fuente canónica y prueba con un servidor estático local y navegador real.
2. Copia los archivos de exhibición a `buut/cambridge/`, actualiza el guion y registra el SHA fuente. Conserva el QR apuntando a la URL definitiva.
3. Abre un PR en el repositorio personal. Revisa que sólo cambien archivos de BUUT. Integra mediante los controles vigentes y comprueba GitHub Pages, descargas, recarga y recorrido.
4. Para volver, restaura únicamente `buut/` desde la revisión de exhibición anterior mediante un nuevo PR. No vuelvas al enlace de túnel de la edición previa a Cambridge. Comprueba que el esquema local siga compatible; si una versión futura cambia su esquema, debe usar una clave nueva o una migración explícita.

GitHub Pages publica HTML, CSS y JavaScript estáticos; no ejecuta Rust. Referencia: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
