"""Run a temporary tunnel and publish only its URL to GitHub Pages."""
import base64
import json
from pathlib import Path
import re
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parent
REPO = 'GerardoDC14/GerardoDC14.github.io'
API = f'repos/{REPO}/contents/panel/connection.json'

def publish(url):
    data = {'url': url, 'updated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    payload = {'message': 'Update laptop tunnel endpoint', 'content': base64.b64encode((json.dumps(data) + '\n').encode()).decode(), 'branch': 'main'}
    existing = subprocess.run(['gh', 'api', API], capture_output=True, text=True, timeout=25)
    if existing.returncode == 0:
        payload['sha'] = json.loads(existing.stdout)['sha']
    result = subprocess.run(['gh', 'api', '--method', 'PUT', API, '--input', '-'], input=json.dumps(payload), capture_output=True, text=True, timeout=40)
    if result.returncode:
        raise RuntimeError('No se pudo actualizar la dirección en GitHub Pages.')

def keep_publishing(url):
    delay = 5
    while True:
        try:
            publish(url)
            print('Dirección del panel actualizada en GitHub Pages.', flush=True)
            return
        except Exception as error:
            print(f'{error} Reintento en {delay} segundos.', flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 60)

process = subprocess.Popen([str(ROOT / 'cloudflared'), 'tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://127.0.0.1:8765'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    for line in process.stdout:
        print(line, end='', flush=True)
        match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', line)
        if match:
            url = match.group()
            (ROOT / 'tunnel-url.txt').write_text(url + '\n')
            threading.Thread(target=keep_publishing, args=(url,), daemon=True).start()
    sys.exit(process.wait() or 1)
finally:
    process.terminate()
