/**
 * Servidor HTTP con transporte SSE (Server-Sent Events) para despliegues en servidores remotos o Docker.
 */

import http from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createTurismoMcpServer } from './server.js';

export function startHttpServer(port = 3000) {
  const mcpServer = createTurismoMcpServer();
  const transports = new Map();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // Headers CORS comunes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Preflight CORS
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Healthcheck y bienvenida
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'online',
        service: 'Turismo Tucumán MCP Server (Node.js)',
        version: '1.0.0',
        transport: 'streamable-sse',
        endpoints: {
          sse: '/sse',
          messages: '/message'
        }
      }, null, 2));
      return;
    }

    // 1. Endpoint SSE (Handshake inicial del cliente)
    if (req.method === 'GET' && url.pathname === '/sse') {
      try {
        const transport = new SSEServerTransport('/message', res);
        transports.set(transport.sessionId, transport);

        req.on('close', () => {
          transports.delete(transport.sessionId);
        });

        await mcpServer.connect(transport);
      } catch (err) {
        process.stderr.write(`[MCP-HTTP] Error iniciando SSE: ${err.message}\n`);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
      return;
    }

    // 2. Endpoint POST de mensajes
    if (req.method === 'POST' && url.pathname === '/message') {
      const sessionId = url.searchParams.get('sessionId');
      const transport = transports.get(sessionId);

      if (!transport) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sesión no encontrada o expirada' }));
        return;
      }

      await transport.handlePostMessage(req, res);
      return;
    }

    // 404 para cualquier otra ruta
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  });

  server.listen(port, () => {
    process.stderr.write(`[MCP-HTTP] Servidor MCP escuchando en http://0.0.0.0:${port}\n`);
    process.stderr.write(`[MCP-HTTP] Endpoint SSE para clientes: http://0.0.0.0:${port}/sse\n`);
  });

  return server;
}
