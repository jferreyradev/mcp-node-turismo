/**
 * Fábrica y configuración del servidor MCP de Turismo Tucumán.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTools } from './tools.js';
import { LOCALIDADES, CIRCUITOS, RECURSOS_CATALOGO } from './optimizer.js';

export function createTurismoMcpServer() {
  const server = new McpServer({
    name: 'turismo-api-mcp-node',
    version: '1.0.0'
  });

  // 1. Registrar Herramientas (Tools)
  registerTools(server);

  // 2. Registrar Recursos (Resources) usando la API moderna registerResource
  server.registerResource(
    'localidades',
    'turismo://localidades',
    {
      description: 'Catálogo de las 58 localidades oficiales de Tucumán',
      mimeType: 'application/json'
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          total: Object.keys(LOCALIDADES).length,
          localidades: LOCALIDADES
        })
      }]
    })
  );

  server.registerResource(
    'circuitos',
    'turismo://circuitos',
    {
      description: 'Catálogo de circuitos turísticos oficiales de Tucumán',
      mimeType: 'application/json'
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          total: Object.keys(CIRCUITOS).length,
          circuitos: CIRCUITOS
        })
      }]
    })
  );

  server.registerResource(
    'recursos',
    'turismo://recursos',
    {
      description: 'Catálogo de los 28 recursos dinámicos disponibles en la API',
      mimeType: 'application/json'
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          total: RECURSOS_CATALOGO.length,
          recursos: RECURSOS_CATALOGO
        })
      }]
    })
  );

  // 3. Registrar Plantillas de Prompts usando registerPrompt
  server.registerPrompt(
    'planificar_itinerario',
    {
      description: 'Genera una recomendación de itinerario turístico personalizado para Tucumán consultando lugares y gastronomía oficiales.',
      argsSchema: {
        destino: z.string().describe('Localidad o circuito turístico (ej: "Tafí del Valle", "San Javier", "Yungas").'),
        dias: z.string().optional().describe('Cantidad de días de estadía (ej: "2 días", "fin de semana").')
      }
    },
    ({ destino, dias }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Eres el guía experto oficial del Ente Tucumán Turismo. Por favor diseña un itinerario completo de ${dias || '2 días'} para ${destino}. Utiliza las herramientas oficiales para consultar los lugares turísticos, alojamientos y locales gastronómicos recomendados en la zona.`
        }
      }]
    })
  );

  server.registerPrompt(
    'buscar_actividades',
    {
      description: 'Busca eventos culturales, ferias o festividades en una localidad específica para una fecha determinada.',
      argsSchema: {
        localidad: z.string().describe('Localidad a consultar (ej: "Aguilares", "San Miguel de Tucumán", "Monteros").'),
        fecha: z.string().optional().describe('Fecha o período estimado (ej: "2026-10-15").')
      }
    },
    ({ localidad, fecha }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Por favor consulta los eventos y actividades turísticas programadas en ${localidad}${fecha ? ` para la fecha ${fecha}` : ''} usando la herramienta turismo_get_eventos y preséntame un resumen claro con horarios y direcciones.`
        }
      }]
    })
  );

  return server;
}
