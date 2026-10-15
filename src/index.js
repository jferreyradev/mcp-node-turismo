#!/usr/bin/env node

/**
 * Servidor MCP Oficial de la API de Turismo de Tucumán.
 * 
 * Modos de ejecución:
 * 1. STDIO (por defecto): Para clientes locales (Claude Desktop, Cursor, Gemini, CLI).
 *    Uso: node src/index.js
 * 
 * 2. HTTP / SSE: Para servidores remotos, Docker, n8n, Flowise y agentes en la nube.
 *    Uso: node src/index.js --http 3000
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTurismoMcpServer } from './server.js';
import { startHttpServer } from './http-transport.js';

const args = process.argv.slice(2);
const httpFlagIndex = args.findIndex(arg => arg === '--http' || arg === '--port');
const isHttp = httpFlagIndex !== -1 || process.env.MCP_TRANSPORT === 'http';

if (isHttp) {
  const portArg = httpFlagIndex !== -1 ? args[httpFlagIndex + 1] : null;
  const port = Number(portArg) || Number(process.env.PORT) || 3000;
  startHttpServer(port);
} else {
  // Modo STDIO por defecto
  const server = createTurismoMcpServer();
  const transport = new StdioServerTransport();

  server.connect(transport).then(() => {
    process.stderr.write('[MCP-Node-Turismo] Servidor iniciado correctamente en modo STDIO.\n');
  }).catch((err) => {
    process.stderr.write(`[MCP-Node-Turismo] Error fatal al iniciar: ${err.message}\n`);
    process.exit(1);
  });
}
