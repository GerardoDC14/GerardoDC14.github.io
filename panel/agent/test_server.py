import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch
from aiohttp.test_utils import TestClient, TestServer
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

if __name__=='__main__':unittest.main()
