# Panel remoto de laptop

Abre https://gerardodc14.github.io/panel/ para conectar al equipo. El PIN se valida en el agente local; no está en este repositorio. El navegador conserva la dirección del túnel, pero mantiene el token de sesión solo en memoria.

Funciones: mensajes escritos con voz robótica en español, tono y velocidad, repetir el último mensaje, botones de frases, volumen entre 0 y 100 %, silencio, escucha del micrófono de la laptop, cámara por cuadros JPEG con modos de consumo de datos, espejo, pantalla completa, descarga manual de fotos y un botón para detener voz y ambas capturas. Muestra batería, latencia y tiempo de sesión. Recuerda ajustes de voz y video en el navegador y busca automáticamente la dirección actual del túnel. No ofrece terminal, ejecución de comandos arbitrarios, captura del micrófono del celular ni grabación automática.

## Operación en la laptop configurada

- `systemctl --user status laptop-panel laptop-panel-tunnel`
- `systemctl --user stop laptop-panel-tunnel laptop-panel` detiene el acceso y la cámara.
- `systemctl --user start laptop-panel laptop-panel-tunnel` lo vuelve a iniciar.
- `journalctl --user -u laptop-panel -u laptop-panel-tunnel -n 50` muestra el registro.

Los servicios inician con la sesión del usuario y requieren que la laptop permanezca encendida, conectada a Internet y sin suspenderse. Cerrar este chat no los detiene. No se modificó la suspensión ni se habilitó ejecución antes de iniciar sesión.

El túnel de Cloudflare es temporal. Su supervisor publica su nueva URL en `connection.json` al iniciar; GitHub Pages puede tardar unos minutos en actualizarla. Si GitHub no está disponible, el supervisor reintenta indefinidamente con pausas de hasta 60 segundos. Si todavía aparece una dirección anterior, se puede pegar la URL actual manualmente. Cloudflare no garantiza disponibilidad para Quick Tunnels.

## Controles de acceso

PIN de seis dígitos almacenado con PBKDF2 y sal aleatoria en `~/.config/laptop-panel/config.json`, accesible solo por su propietario. Máximo cinco intentos de acceso por 15 minutos para el servicio completo. Sesiones aleatorias de 30 minutos; cada operación y cada cuadro de video exige un token. El frontend público no incluye el PIN. HTTPS mediante el túnel; el agente solo escucha en `127.0.0.1:8765`. Orígenes permitidos limitados al sitio y al propio túnel. No deben añadirse credenciales, archivos de configuración privada ni tokens a este repositorio.

La cámara muestra una notificación local al activarse y conserva su indicador físico. Se cierra al pulsar Apagar, cerrar sesión o pasar 20 segundos sin solicitudes de cuadros. Ocultar la página solicita su apagado. El video viaja por Cloudflare, sin almacenamiento de cuadros en el agente.

## Código

`agent/server.py` contiene la API en Python (`aiohttp`, `opencv-python-headless` y las herramientas `pactl`, `spd-say`, `ffmpeg`, `notify-send`). `agent/tunnel.py` ejecuta un binario local `cloudflared` y usa `gh` autenticado para publicar la URL. La instalación local contiene las unidades systemd del usuario. El HTML debe estar disponible en la ruta configurada por el agente. Las acciones del sistema usan argumentos separados y una lista fija de comandos.

## Escucha del micrófono

Pulsa **Escuchar micrófono** en el celular. El navegador reproduce una transmisión PCM mono de 16 kHz recibida por WebSocket HTTPS. Requiere un navegador con Web Audio (AudioContext). No se pide permiso para el micrófono del celular. **Dejar de escuchar** apaga la captura y **Detener todo** cancela voz, cámara y escucha. El control de volumen de escucha solo afecta la reproducción del celular; el volumen de laptop controla sus altavoces. La opción de silenciar el micrófono modifica el dispositivo de entrada de la laptop.

La conexión WebSocket autentica el primer mensaje antes de ejecutar FFmpeg: no se incluye ningún token en la URL. Solo se admite un oyente simultáneo. La captura termina al desconectarse el navegador, cerrar sesión, expirar el token o dejar de recibir el latido del cliente durante 15 segundos. Al ocultarse la página se detienen cámara y micrófono. La laptop muestra avisos al iniciar y terminar la escucha. No se escriben archivos de audio. La reproducción de mensajes siempre usa eSpeak a través de Speech Dispatcher.

El audio y el video son transmisiones separadas, sin sincronización garantizada. La transmisión PCM consume aproximadamente 2 MB por minuto, además del video si está activo. Los modos de video limitan la frecuencia a 1, 3 o 5 cuadros por segundo y ajustan la compresión JPEG. El rendimiento real depende de la red.

Para comprobar autenticación, cierre de captura y validación: `python test_server.py` con las dependencias del agente instaladas.

## Continuidad de audio (v2.1)

La reproducción conserva todos los bloques recibidos, incluso cuando la red los entrega en ráfagas. El margen inicial es de un segundo; si una interrupción lo agota, se aumenta gradualmente hasta 2,5 segundos antes de reanudar. Solo Detener o el cierre de escucha cancelan audio pendiente. FFmpeg envía cada paquete sin esperar a llenar el búfer de salida. Se mantiene el formato PCM mono de 16 kHz.

Pruebas del reproductor: `node --test panel/tests/pcm-player.test.cjs` desde la raíz del repositorio. Cubren ráfagas de dos segundos, pausas de red, recuperación y parada explícita.
