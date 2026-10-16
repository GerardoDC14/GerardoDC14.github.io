"""Explicit remote controls for this laptop; listen on loopback only."""
import asyncio
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import time
from collections import deque

import cv2
from aiohttp import web

ROOT = Path(__file__).resolve().parent
CONFIG = Path(os.environ.get('LAPTOP_PANEL_CONFIG', Path.home() / '.config/laptop-panel/config.json'))
ALLOWED = {'https://gerardodc14.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'}
sessions = {}
attempts = deque()
speech = None
camera = None
camera_lock = asyncio.Lock()
last_frame = 0

async def command(*args):
    p = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    try:
        out, err = await asyncio.wait_for(p.communicate(), 8)
    except asyncio.TimeoutError:
        p.kill()
        await p.wait()
        raise web.HTTPServiceUnavailable(text='El dispositivo no respondió.')
    if p.returncode:
        raise web.HTTPServiceUnavailable(text='No se pudo completar la operación del dispositivo.')
    return out.decode(errors='replace')

def notice(message):
    async def show():
        try:
            await command('notify-send', 'Panel remoto de la laptop', message)
        except Exception:
            pass
    asyncio.create_task(show())

@web.middleware
async def security(request, handler):
    origin = request.headers.get('Origin', '')
    own_origin = 'https://' + request.host
    if origin and origin not in ALLOWED and origin != own_origin:
        raise web.HTTPForbidden(text='Origen no autorizado.')
    if request.method == 'OPTIONS':
        response = web.Response(status=204)
    else:
        try:
            if request.path.startswith('/api/') and request.path != '/api/login':
                token = request.headers.get('Authorization', '').removeprefix('Bearer ')
                now = time.monotonic()
                for key in list(sessions):
                    if sessions[key] < now:
                        sessions.pop(key, None)
                if not token or token not in sessions:
                    raise web.HTTPUnauthorized(text='Inicia sesión de nuevo.')
            response = await handler(request)
        except web.HTTPException as error:
            response = error
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            response = web.json_response({'error': 'Datos de solicitud inválidos.'}, status=400)
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
        response.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response

async def login(request):
    now = time.monotonic()
    while attempts and attempts[0] < now - 900:
        attempts.popleft()
    if len(attempts) >= 5:
        raise web.HTTPTooManyRequests(text='Demasiados intentos. Espera 15 minutos.')
    attempts.append(now)
    data = await request.json()
    pin = str(data.get('pin', ''))
    if not re.fullmatch(r'\d{6}', pin):
        raise web.HTTPUnauthorized(text='PIN incorrecto.')
    config = json.loads(CONFIG.read_text())
    derived = await asyncio.to_thread(hashlib.pbkdf2_hmac, 'sha256', pin.encode(), bytes.fromhex(config['salt']), 600000)
    if not hmac.compare_digest(derived.hex(), config['pin_hash']):
        await asyncio.sleep(1)
        raise web.HTTPUnauthorized(text='PIN incorrecto.')
    attempts.clear()
    token = secrets.token_urlsafe(32)
    # Bounded sessions; access expires after 30 minutes.
    if len(sessions) >= 20:
        sessions.pop(next(iter(sessions)))
    sessions[token] = now + 1800
    notice('Se inició una sesión remota. Puedes detenerla con el acceso Detener panel remoto.')
    return web.json_response({'token': token, 'expires_in': 1800})

async def status(request):
    volume = await command('pactl', 'get-sink-volume', '@DEFAULT_SINK@')
    mute = await command('pactl', 'get-sink-mute', '@DEFAULT_SINK@')
    return web.json_response({'volume': int(re.search(r'(\d+)%', volume).group(1)), 'muted': 'yes' in mute or 'sí' in mute,
                              'camera': camera is not None, 'speaking': speech is not None and speech.returncode is None})

async def set_volume(request):
    value = (await request.json())['volume']
    if type(value) is not int or not 0 <= value <= 100:
        raise web.HTTPBadRequest(text='El volumen debe estar entre 0 y 100.')
    await command('pactl', 'set-sink-volume', '@DEFAULT_SINK@', str(value) + '%')
    return web.json_response({'ok': True})

async def mute(request):
    value = (await request.json())['muted']
    if type(value) is not bool:
        raise web.HTTPBadRequest()
    await command('pactl', 'set-sink-mute', '@DEFAULT_SINK@', '1' if value else '0')
    return web.json_response({'ok': True})

async def say(request):
    global speech
    data = await request.json()
    text = data.get('text', '')
    pitch, rate = data.get('pitch', -50), data.get('rate', -20)
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 600:
        raise web.HTTPBadRequest(text='Escribe entre 1 y 600 caracteres.')
    if any(type(v) is not int or not -100 <= v <= 100 for v in (pitch, rate)):
        raise web.HTTPBadRequest(text='Tono o velocidad inválidos.')
    if speech is not None and speech.returncode is None:
        raise web.HTTPConflict(text='La voz está ocupada. Detén el audio o espera.')
    speech = await asyncio.create_subprocess_exec('spd-say', '-l', 'es', '-p', str(pitch), '-r', str(rate), '-w', '--', text)
    asyncio.create_task(speech.wait())
    return web.json_response({'ok': True})

async def stop_audio(request):
    global speech
    await command('spd-say', '-C')
    if speech is not None and speech.returncode is None:
        try:
            speech.terminate()
        except ProcessLookupError:
            pass
    return web.json_response({'ok': True})

def open_camera():
    cap = cv2.VideoCapture('/dev/video0', cv2.CAP_V4L2)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if not cap.isOpened():
        cap.release()
        return None
    return cap

async def start_camera(request):
    global camera, last_frame
    async with camera_lock:
        if camera is None:
            camera = await asyncio.to_thread(open_camera)
            if camera is None:
                raise web.HTTPServiceUnavailable(text='La cámara no está disponible.')
            notice('CÁMARA ACTIVA: el panel remoto está viendo video. El indicador físico de la cámara permanece encendido.')
        last_frame = time.monotonic()
    return web.json_response({'ok': True})

async def close_camera():
    global camera
    async with camera_lock:
        if camera is not None:
            await asyncio.to_thread(camera.release)
            camera = None
            notice('La cámara remota se apagó.')

async def stop_camera(request):
    await close_camera()
    return web.json_response({'ok': True})

def capture(cap):
    ok, frame = cap.read()
    if not ok:
        return None
    ok, jpg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return jpg.tobytes() if ok else None

async def frame(request):
    global last_frame
    async with camera_lock:
        if camera is None:
            raise web.HTTPConflict(text='La cámara está apagada.')
        image = await asyncio.to_thread(capture, camera)
        if image is None:
            raise web.HTTPServiceUnavailable(text='No se pudo obtener un cuadro.')
        last_frame = time.monotonic()
    return web.Response(body=image, content_type='image/jpeg')

async def logout(request):
    sessions.pop(request.headers.get('Authorization', '').removeprefix('Bearer '), None)
    await close_camera()
    return web.json_response({'ok': True})

async def lifetime(app):
    async def watch():
        while True:
            await asyncio.sleep(5)
            if camera is not None and time.monotonic() - last_frame > 20:
                await close_camera()
    task = asyncio.create_task(watch())
    yield
    task.cancel()
    await close_camera()
    await command('spd-say', '-C')

def create_app():
    app = web.Application(middlewares=[security], client_max_size=8192)
    app.router.add_post('/api/login', login)
    app.router.add_get('/api/status', status)
    app.router.add_post('/api/volume', set_volume)
    app.router.add_post('/api/mute', mute)
    app.router.add_post('/api/say', say)
    app.router.add_post('/api/audio/stop', stop_audio)
    app.router.add_post('/api/camera/start', start_camera)
    app.router.add_post('/api/camera/stop', stop_camera)
    app.router.add_get('/api/camera/frame', frame)
    app.router.add_post('/api/logout', logout)
    async def options(request):
        return web.Response(status=204)
    app.router.add_route('OPTIONS', '/{tail:.*}', options)
    async def home(request):
        return web.FileResponse(ROOT.parent / 'github-pages-panel/panel/index.html')
    app.router.add_get('/', home)
    app.cleanup_ctx.append(lifetime)
    return app

if __name__ == '__main__':
    os.environ['LC_ALL'] = 'C'
    web.run_app(create_app(), host='127.0.0.1', port=8765, access_log=None)
