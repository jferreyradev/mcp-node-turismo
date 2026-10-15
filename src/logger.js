/**
 * Módulo de Observabilidad y Telemetría para el Servidor MCP.
 * 
 * Registra cada consulta en:
 * 1. process.stderr con formato legible en tiempo real (seguro para STDIO).
 * 2. logs/mcp-activity.jsonl en formato estructurado JSON Lines para análisis posterior.
 */

import fs from 'node:fs';
import path from 'node:path';

const ENABLE_FILE_LOG = process.env.ENABLE_FILE_LOG !== 'false';
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'mcp-activity.jsonl');

let dirChecked = false;
function ensureLogDir() {
  if (!dirChecked && ENABLE_FILE_LOG) {
    try {
      if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      }
      dirChecked = true;
    } catch {
      // Ignorar errores de creación de directorio
    }
  }
}

/**
 * Registra una llamada a una herramienta MCP con sus métricas.
 */
export function logToolCall(entry) {
  const {
    tool,
    input = {},
    url = '',
    status = 200,
    durationMs = 0,
    rawBytes = 0,
    compactBytes = 0,
    isError = false
  } = entry;

  const timestamp = new Date().toISOString();
  const savingsPct = rawBytes > 0 && compactBytes > 0 && compactBytes < rawBytes
    ? Math.round((1 - compactBytes / rawBytes) * 100)
    : 0;

  const record = {
    timestamp,
    tool,
    input,
    url,
    status,
    durationMs,
    rawBytes,
    compactBytes,
    savingsPct: `${savingsPct}%`,
    isError
  };

  // 1. Salida legible con colores en process.stderr
  const color = isError ? '\x1b[31m' : '\x1b[32m';
  const reset = '\x1b[0m';
  const cyan = '\x1b[36m';
  const yellow = '\x1b[33m';
  const gray = '\x1b[90m';

  const badge = isError ? 'ERR' : 'OK';
  const line = `[MCP-LOG] ${color}${badge}${reset} ${cyan}${tool}${reset} (${durationMs}ms) | URL: ${url || 'n/a'} | Reducción: ${yellow}${savingsPct}%${reset} ${gray}(${rawBytes}B -> ${compactBytes}B)${reset}`;
  
  process.stderr.write(`${line}\n`);

  // 2. Registro estructurado en archivo JSON Lines
  if (ENABLE_FILE_LOG) {
    try {
      ensureLogDir();
      fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n', 'utf8');
    } catch (err) {
      process.stderr.write(`[MCP-LOG] No se pudo persistir log: ${err.message}\n`);
    }
  }
}
