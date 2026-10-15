#!/usr/bin/env node

/**
 * Script de análisis y estadísticas de uso del Servidor MCP.
 * Procesa logs/mcp-activity.jsonl y genera un resumen en terminal.
 */

import fs from 'node:fs';
import path from 'node:path';

const LOG_FILE = process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs', 'mcp-activity.jsonl');

if (!fs.existsSync(LOG_FILE)) {
  console.log('\nℹ️ Aún no hay registros de actividad en logs/mcp-activity.jsonl.\n');
  process.exit(0);
}

const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
if (lines.length === 0) {
  console.log('\nℹ️ El archivo de logs está vacío.\n');
  process.exit(0);
}

const entries = [];
for (const line of lines) {
  try {
    entries.push(JSON.parse(line));
  } catch {
    // Ignorar líneas corruptas
  }
}

const totalCalls = entries.length;
const toolCounts = {};
let totalDuration = 0;
let totalRawBytes = 0;
let totalCompactBytes = 0;
let totalErrors = 0;
const localities = {};
const resources = {};

for (const e of entries) {
  toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
  totalDuration += e.durationMs || 0;
  totalRawBytes += e.rawBytes || 0;
  totalCompactBytes += e.compactBytes || 0;
  if (e.isError) totalErrors++;

  // Extraer localidad si existe
  const loc = e.input?.localidad || e.input?.filtros?.localidad;
  if (loc) {
    localities[loc] = (localities[loc] || 0) + 1;
  }

  // Extraer recurso si existe
  const rec = e.input?.recurso;
  if (rec) {
    resources[rec] = (resources[rec] || 0) + 1;
  }
}

const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
const overallSavings = totalRawBytes > 0 && totalCompactBytes < totalRawBytes
  ? Math.round((1 - totalCompactBytes / totalRawBytes) * 100)
  : 0;

console.log('\n======================================================');
console.log('📊 REPORTE DE ACTIVIDAD Y CONSUMO DEL SERVIDOR MCP');
console.log('======================================================\n');
console.log(`🔹 Total de consultas registradas : ${totalCalls}`);
console.log(`⏱️  Latencia promedio a la API     : ${avgDuration} ms`);
console.log(`📉 Ahorro global de Payload/Tokens: ${overallSavings}% (${totalRawBytes} B -> ${totalCompactBytes} B)`);
console.log(`⚠️  Errores registrados            : ${totalErrors}\n`);

console.log('🛠️  Consultas por Herramienta:');
for (const [tool, count] of Object.entries(toolCounts)) {
  const pct = Math.round((count / totalCalls) * 100);
  console.log(`   - ${tool.padEnd(25)}: ${String(count).padStart(3)} llamadas (${pct}%)`);
}

if (Object.keys(localities).length > 0) {
  console.log('\n📍 Localidades más consultadas:');
  const sortedLocs = Object.entries(localities).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [loc, count] of sortedLocs) {
    console.log(`   - ${loc.padEnd(20)}: ${count} veces`);
  }
}

if (Object.keys(resources).length > 0) {
  console.log('\n📦 Recursos dinámicos más consultados:');
  const sortedRecs = Object.entries(resources).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [rec, count] of sortedRecs) {
    console.log(`   - ${rec.padEnd(20)}: ${count} veces`);
  }
}

console.log('\n======================================================\n');
