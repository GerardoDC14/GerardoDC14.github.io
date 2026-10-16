# Panel remoto de laptop

Abre https://gerardodc14.github.io/panel/ para conectar al equipo. El PIN se valida en el agente local; no está en este repositorio. El navegador conserva la dirección del túnel, pero mantiene el token de sesión solo en memoria.

Funciones: voz en español con tono y velocidad, detener voz, volumen entre 0 y 100 %, silencio, cámara con video por cuadros JPEG y descarga manual de una foto. No ofrece terminal ni ejecución de comandos arbitrarios, captura de micrófono o grabación automática.

## Operación en la laptop configurada

- `systemctl --user status laptop-panel laptop-panel-tunnel`
- `systemctl --user stop laptop-panel-tunnel laptop-panel` detiene el acceso y la cámara.
- `systemctl --user start laptop-panel laptop-panel-tunnel` lo vuelve a iniciar.
- `journalctl --user -u laptop-panel -u laptop-panel-tunnel -n 50` muestra el registro.

Los servicios inician con la sesión del usuario y requieren que la laptop permanezca encendida, conectada a Internet y sin suspenderse. Cerrar este chat no los detiene. No se modificó la suspensión ni se habilitó ejecución antes de iniciar sesión.

El túnel de Cloudflare es temporal. Su supervisor publica su nueva URL en `connection.json` al iniciar; GitHub Pages puede tardar unos minutos en actualizarla. Si todavía aparece una dirección anterior, se puede pegar la URL actual manualmente. Cloudflare no garantiza disponibilidad para Quick Tunnels.

## Controles de acceso

PIN de seis dígitos almacenado con PBKDF2 y sal aleatoria en `~/.config/laptop-panel/config.json`, accesible solo por su propietario. Máximo cinco intentos de acceso por 15 minutos para el servicio completo. Sesiones aleatorias de 30 minutos; cada operación y cada cuadro de video exige un token. El frontend público no incluye el PIN. HTTPS mediante el túnel; el agente solo escucha en `127.0.0.1:8765`. Orígenes permitidos limitados al sitio y al propio túnel. No deben añadirse credenciales, archivos de configuración privada ni tokens a este repositorio.

La cámara muestra una notificación local al activarse y conserva su indicador físico. Se cierra al pulsar Apagar, cerrar sesión o pasar 20 segundos sin solicitudes de cuadros. Ocultar la página solicita su apagado. El video viaja por Cloudflare, sin almacenamiento de cuadros en el agente.

## Código

`agent/server.py` contiene la API en Python (`aiohttp`, `opencv-python` y las herramientas `pactl`, `spd-say`, `notify-send`). `agent/tunnel.py` ejecuta un binario local `cloudflared` y usa `gh` autenticado para publicar la URL. La instalación local contiene las unidades systemd del usuario. El HTML debe estar disponible en la ruta configurada por el agente. Las acciones del sistema usan argumentos separados y una lista fija de comandos.
