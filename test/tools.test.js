import test from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '../src/tools.js';

test('registerTools registra las 7 herramientas esperadas en el servidor MCP', () => {
  const server = new McpServer({ name: 'test-server', version: '1.0.0' });
  registerTools(server);

  const tools = Object.keys(server._registeredTools);
  const expectedTools = [
    'turismo_health',
    'turismo_login',
    'turismo_get_circuitos',
    'turismo_get_eventos',
    'turismo_get_lugares',
    'turismo_get_recurso',
    'turismo_get_perfil'
  ];

  for (const name of expectedTools) {
    assert.ok(tools.includes(name), `Herramienta ${name} debe estar registrada`);
  }
  assert.equal(tools.length, 7);
});

test('herramienta turismo_get_circuitos ejecuta y procesa datos compactados con mock fetch', async () => {
  const server = new McpServer({ name: 'test-server', version: '1.0.0' });
  registerTools(server);

  const mockCircuitos = {
    success: true,
    data: [
      { codigo: '1', nombre: 'Circuito Yungas', color: '#0F477C' },
      { codigo: '2', nombre: 'Circuito Valles Calchaquíes', color: '#A83413' }
    ]
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => mockCircuitos
  });

  try {
    const tool = server._registeredTools['turismo_get_circuitos'];
    const res = await tool.handler({ q: 'Yungas' });

    assert.equal(res.isError, false);
    assert.ok(Array.isArray(res.content));
    assert.equal(res.content[0].type, 'text');

    const payload = JSON.parse(res.content[0].text);
    assert.equal(payload.data.length, 1);
    assert.equal(payload.data[0].nombre, 'Circuito Yungas');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('herramienta turismo_get_eventos resuelve localidad, aplica límite y fecha actual por defecto', async () => {
  const server = new McpServer({ name: 'test-server', version: '1.0.0' });
  registerTools(server);

  let capturedUrl = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = String(url);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: [] })
    };
  };

  try {
    const tool = server._registeredTools['turismo_get_eventos'];
    // 1. Sin fecha: debe inyectar la fecha de hoy automáticamente
    await tool.handler({ localidad: 'aguilare' });

    assert.ok(capturedUrl.includes('localidad=bba7bec713fe2322c15323a4f32cbcf4'));
    assert.ok(capturedUrl.includes('limite=5'));
    assert.ok(/desde=\d{4}-\d{2}-\d{2}/.test(capturedUrl), 'Debe inyectar parámetro desde con fecha actual');

    // 2. Con historicos: true: no debe forzar la fecha actual
    capturedUrl = '';
    await tool.handler({ localidad: 'aguilare', historicos: true });
    assert.ok(!capturedUrl.includes('desde='), 'No debe inyectar desde cuando historicos=true');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('herramienta turismo_get_recurso normaliza recurso y rutea a endpoint de detalle', async () => {
  const server = new McpServer({ name: 'test-server', version: '1.0.0' });
  registerTools(server);

  let capturedUrl = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = String(url);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { nombre: 'Hotel Premier' } })
    };
  };

  try {
    const tool = server._registeredTools['turismo_get_recurso'];
    // Pasamos el sinónimo "alojamiento" con un código
    await tool.handler({ recurso: 'alojamiento', codigo: '5691531ac558866c93472e22d0e983c4' });

    // Debe dirigirse a /hotel-detalle/5691...
    assert.ok(capturedUrl.includes('/hotel-detalle/5691531ac558866c93472e22d0e983c4'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
