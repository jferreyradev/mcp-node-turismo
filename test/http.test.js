import test from 'node:test';
import assert from 'node:assert/strict';
import { startHttpServer } from '../src/http-transport.js';

test('servidor HTTP arranca y responde en /health con metadatos del servicio', async () => {
  const server = startHttpServer(0);
  await new Promise((resolve) => server.once('listening', resolve));

  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'online');
    assert.equal(body.transport, 'streamable-sse');
    assert.equal(body.endpoints.sse, '/sse');
    assert.equal(body.endpoints.messages, '/message');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
