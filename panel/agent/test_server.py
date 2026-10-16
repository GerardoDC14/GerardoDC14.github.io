import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch
from aiohttp.test_utils import TestClient, TestServer
from aiohttp import WSMsgType
import asyncio
import server

class ControlsTest(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.directory=tempfile.TemporaryDirectory()
  server.CONFIG=Path(self.directory.name)/'config.json'
  salt=b'test-salt'
  server.CONFIG.write_text(json.dumps({'salt':salt.hex(),'pin_hash':hashlib.pbkdf2_hmac('sha256',b'859214',salt,600000).hex()}))
  server.sessions.clear();server.attempts.clear()
  self.fake_command=patch.object(server,'command',AsyncMock(return_value=''))
  self.fake_command.start()
  self.fake_notice=patch.object(server,'notice');self.fake_notice.start()
  self.client=TestClient(TestServer(server.create_app()));await self.client.start_server()
 async def asyncTearDown(self):
  await self.client.close();self.fake_notice.stop();self.fake_command.stop();self.directory.cleanup()
 async def auth(self):
  response=await self.client.post('/api/login',json={'pin':'859214'})
  self.assertEqual(response.status,200)
  return {'Authorization':'Bearer '+(await response.json())['token']}
 async def test_protected_routes(self):
  for path in ('status','camera/frame'):
   response=await self.client.get('/api/'+path);self.assertEqual(response.status,401)
  response=await self.client.post('/api/camera/start',json={});self.assertEqual(response.status,401)
 async def test_origin_and_lockout(self):
  response=await self.client.post('/api/login',json={'pin':'859214'},headers={'Origin':'https://evil.example'})
  self.assertEqual(response.status,403)
  for _ in range(5):
   response=await self.client.post('/api/login',json={'pin':'bad'});self.assertEqual(response.status,401)
  response=await self.client.post('/api/login',json={'pin':'859214'});self.assertEqual(response.status,429)
 async def test_validation_and_logout(self):
  headers=await self.auth()
  for volume in (150,-1,'50',True):
   response=await self.client.post('/api/volume',json={'volume':volume},headers=headers);self.assertEqual(response.status,400)
  response=await self.client.post('/api/say',json={'text':'test','pitch':'$(id)'},headers=headers);self.assertEqual(response.status,400)
  response=await self.client.post('/api/logout',json={},headers=headers);self.assertEqual(response.status,200)
  response=await self.client.get('/api/status',headers=headers);self.assertEqual(response.status,401)
 async def test_fixed_volume_command(self):
  headers=await self.auth()
  response=await self.client.post('/api/volume',json={'volume':80},headers=headers)
  self.assertEqual(response.status,200)
  server.command.assert_awaited_once_with('pactl','set-sink-volume','@DEFAULT_SINK@','80%')

class MicrophoneTest(ControlsTest):
 async def test_socket_requires_authentication(self):
  with patch.object(server.asyncio, 'create_subprocess_exec', new_callable=AsyncMock) as spawn:
   ws=await self.client.ws_connect(server.MIC_PATH)
   await ws.send_json({'token':'not-a-session'})
   message=await ws.receive(timeout=2)
   self.assertEqual(message.type, WSMsgType.CLOSE)
   self.assertEqual(ws.close_code,1008)
   spawn.assert_not_called()
 async def test_socket_rejects_untrusted_origin(self):
  response=await self.client.get(server.MIC_PATH,headers={'Origin':'https://evil.example'})
  self.assertEqual(response.status,403)
 async def test_microphone_controls_require_auth(self):
  for path in ('microphone/stop','microphone/mute','stop-all'):
   response=await self.client.post('/api/'+path,json={})
   self.assertEqual(response.status,401)
 async def test_mute_validation(self):
  headers=await self.auth()
  response=await self.client.post('/api/microphone/mute',json={'muted':'yes'},headers=headers)
  self.assertEqual(response.status,400)
 async def test_stream_and_stop(self):
  headers=await self.auth()
  process=MockProcess()
  with patch.object(server.asyncio, 'create_subprocess_exec',AsyncMock(return_value=process)) as spawn:
   ws=await self.client.ws_connect(server.MIC_PATH)
   await ws.send_json({'token':headers['Authorization'].removeprefix('Bearer ')})
   ready=await ws.receive_json(timeout=2)
   self.assertEqual(ready['sample_rate'],16000)
   message=await ws.receive(timeout=2)
   self.assertEqual(message.type,WSMsgType.BINARY)
   self.assertEqual(len(message.data),2048)
   self.assertTrue(server.microphones)
   response=await self.client.post('/api/microphone/stop',json={},headers=headers)
   self.assertEqual(response.status,200)
   self.assertFalse(server.microphones)
   self.assertEqual(process.returncode,0)
   self.assertIn('default',spawn.call_args.args)
   await ws.close()
 async def test_session_revocation_stops_capture(self):
  headers=await self.auth()
  process=MockProcess()
  with patch.object(server.asyncio, 'create_subprocess_exec',AsyncMock(return_value=process)):
   ws=await self.client.ws_connect(server.MIC_PATH)
   await ws.send_json({'token':headers['Authorization'].removeprefix('Bearer ')})
   await ws.receive_json(timeout=2)
   await self.client.post('/api/logout',json={},headers=headers)
   for _ in range(20):
    if not server.microphones: break
    await asyncio.sleep(.02)
   self.assertFalse(server.microphones)
   self.assertEqual(process.returncode,0)
   await ws.close()

class MockProcess:
 def __init__(self):
  self.returncode=None
  self.stdout=self
 async def readexactly(self, n):
  await asyncio.sleep(.02)
  return bytes(n)
 def terminate(self): self.returncode=0
 def kill(self): self.returncode=-9
 async def wait(self): return self.returncode

if __name__=='__main__':unittest.main()
