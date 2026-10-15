/**
 * Definición y registro de herramientas (Tools) del servidor MCP para Turismo.
 */

import { z } from 'zod';
import { apiRequestWithFallback } from './api-client.js';
import {
  DEFAULT_AI_LIMIT,
  DETAIL_MAP,
  resolveLocality,
  resolveCircuit,
  normalizeResourceName,
  compactPayload,
  filterList
} from './optimizer.js';
import { logToolCall } from './logger.js';

/**
 * Ejecuta una tool calculando métricas de latencia, tamaño de payload y ahorro de tokens.
 */
async function executeAndLog(toolName, args, executeFn) {
  const startTime = performance.now();
  try {
    const { res, resultPayload } = await executeFn();
    const durationMs = Math.round(performance.now() - startTime);

    const rawBytes = res?.data ? JSON.stringify(res.data).length : 0;
    const compactBytes = resultPayload ? JSON.stringify(resultPayload).length : rawBytes;

    logToolCall({
      tool: toolName,
      input: args,
      url: res?.url || '',
      status: res?.status || (res?.isError ? 500 : 200),
      durationMs,
      rawBytes,
      compactBytes,
      isError: res?.isError || false
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(resultPayload) }],
      isError: res?.isError || false
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    logToolCall({
      tool: toolName,
      input: args,
      url: '',
      status: 500,
      durationMs,
      rawBytes: 0,
      compactBytes: 0,
      isError: true
    });
    return {
      content: [{ type: 'text', text: `Error ejecutando herramienta ${toolName}: ${err.message}` }],
      isError: true
    };
  }
}

export function registerTools(server) {
  // 1. Healthcheck
  server.tool(
    'turismo_health',
    'Verifica el estado del servicio y el runtime de la API de Turismo (Healthcheck). Retorna status (online), versión de PHP activa y timestamp.',
    {
      base_url: z.string().optional().describe('URL base opcional de la API (ej: "http://api.tucumanturismo.gob.ar" o "http://localhost:8000").')
    },
    async ({ base_url }) => {
      return executeAndLog('turismo_health', { base_url }, async () => {
        const res = await apiRequestWithFallback(base_url, '/health');
        return { res, resultPayload: res.data || res };
      });
    }
  );

  // 2. Login
  server.tool(
    'turismo_login',
    'Autentica credenciales en la API de Turismo y obtiene un token Bearer JWT para consultas protegidas.',
    {
      email: z.string().describe('Email del usuario para iniciar sesión.'),
      password: z.string().describe('Contraseña del usuario.'),
      base_url: z.string().optional().describe('URL base opcional de la API.')
    },
    async ({ email, password, base_url }) => {
      return executeAndLog('turismo_login', { email, base_url }, async () => {
        const res = await apiRequestWithFallback(base_url, '/api/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        return { res, resultPayload: res.data || res };
      });
    }
  );

  // 3. Catálogo de Circuitos
  server.tool(
    'turismo_get_circuitos',
    'Obtiene la lista completa de circuitos turísticos oficiales disponibles en MariaDB.',
    {
      q: z.string().optional().describe('Filtro opcional de texto para buscar circuitos por nombre.'),
      campos: z.string().optional().describe('Lista de campos requeridos separados por coma (ej: "codigo,nombre").'),
      base_url: z.string().optional().describe('URL base opcional de la API.')
    },
    async ({ q, campos, base_url }) => {
      return executeAndLog('turismo_get_circuitos', { q, campos, base_url }, async () => {
        const res = await apiRequestWithFallback(base_url, '/api/v1/circuitos');
        let data = res.data;
        if (data) {
          if (q && Array.isArray(data.data)) {
            data = { ...data, data: filterList(data.data, q) };
          }
          data = compactPayload(data, { campos });
        }
        return { res, resultPayload: data || res };
      });
    }
  );

  // 4. Catálogo y Detalle de Eventos
  server.tool(
    'turismo_get_eventos',
    'Lista eventos turísticos con filtros opcionales de fechas, localidad, categoría, búsqueda de texto y paginación, o consulta el detalle de un evento por código.',
    {
      codigo: z.string().optional().describe('Código de 32 caracteres para obtener el detalle de un evento específico.'),
      id: z.string().optional().describe('Alias de código de evento.'),
      desde: z.string().optional().describe('Fecha inicio en formato YYYY-MM-DD.'),
      hasta: z.string().optional().describe('Fecha fin en formato YYYY-MM-DD.'),
      localidad: z.string().optional().describe('Nombre de localidad (ej: "Aguilares", "Tafí del Valle", "capital") o código hash MD5.'),
      categoria: z.string().optional().describe('Código de categoría temática.'),
      busqueda: z.string().optional().describe('Texto para buscar en títulos o descripciones.'),
      limite: z.number().int().optional().describe('Cantidad máxima de registros a retornar (por defecto 5 para agentes de IA).'),
      offset: z.number().int().optional().describe('Desplazamiento inicial para paginación.'),
      campos: z.string().optional().describe('Lista de campos requeridos separados por coma (ej: "nombre,localidad,fecha_inicio").'),
      incluir_imagenes: z.boolean().optional().describe('Si es true, incluye URLs de imágenes. Por defecto es false para ahorrar tokens.'),
      base_url: z.string().optional().describe('URL base opcional de la API.')
    },
    async (args) => {
      return executeAndLog('turismo_get_eventos', args, async () => {
        const codigo = args.codigo || args.id;
        const { codigo: _c, id: _i, base_url, campos, incluir_imagenes, ...rawFilters } = args;
        const filters = { ...rawFilters };

        if (filters.localidad) {
          filters.localidad = resolveLocality(filters.localidad);
        }
        if (!filters.limite && !codigo) {
          filters.limite = DEFAULT_AI_LIMIT;
        }

        let res;
        if (codigo) {
          res = await apiRequestWithFallback(base_url, `/api/v1/evento-detalle/${encodeURIComponent(codigo)}`);
          if (res.status === 404) {
            res = await apiRequestWithFallback(base_url, `/api/v1/eventos/${encodeURIComponent(codigo)}`);
          }
        } else {
          res = await apiRequestWithFallback(base_url, '/api/v1/eventos', { params: filters });
        }

        let data = res.data;
        if (data) {
          data = compactPayload(data, { campos, incluir_imagenes });
        }

        return { res, resultPayload: data || res };
      });
    }
  );

  // 5. Catálogo y Detalle de Lugares Turísticos
  server.tool(
    'turismo_get_lugares',
    'Lista lugares turísticos con filtros opcionales de circuito, localidad, búsqueda y paginación, o consulta el detalle de un lugar por código.',
    {
      codigo: z.string().optional().describe('Código de 32 caracteres para obtener el detalle de un lugar turístico específico.'),
      id: z.string().optional().describe('Alias de código de lugar.'),
      circuito: z.string().optional().describe('Nombre del circuito turístico (ej: "Valles Calchaquies", "Yungas", "Sur") o hash MD5.'),
      localidad: z.string().optional().describe('Nombre de localidad (ej: "San Javier", "El Cadillal") o hash MD5.'),
      busqueda: z.string().optional().describe('Término de búsqueda de texto en títulos o descripciones.'),
      limite: z.number().int().optional().describe('Cantidad máxima de registros a retornar (por defecto 5).'),
      offset: z.number().int().optional().describe('Desplazamiento para paginación.'),
      campos: z.string().optional().describe('Lista de campos requeridos separados por coma (ej: "nombre,localidad,direccion").'),
      incluir_imagenes: z.boolean().optional().describe('Si es true, incluye URLs de imágenes. Por defecto es false para ahorrar tokens.'),
      base_url: z.string().optional().describe('URL base opcional de la API.')
    },
    async (args) => {
      return executeAndLog('turismo_get_lugares', args, async () => {
        const codigo = args.codigo || args.id;
        const { codigo: _c, id: _i, base_url, campos, incluir_imagenes, ...rawFilters } = args;
        const filters = { ...rawFilters };

        if (filters.localidad) {
          filters.localidad = resolveLocality(filters.localidad);
        }
        if (filters.circuito) {
          filters.circuito = resolveCircuit(filters.circuito);
        }
        if (!filters.limite && !codigo) {
          filters.limite = DEFAULT_AI_LIMIT;
        }

        let res;
        if (codigo) {
          res = await apiRequestWithFallback(base_url, `/api/v1/lugar-detalle/${encodeURIComponent(codigo)}`);
          if (res.status === 404) {
            res = await apiRequestWithFallback(base_url, `/api/v1/lugares/${encodeURIComponent(codigo)}`);
          }
        } else {
          res = await apiRequestWithFallback(base_url, '/api/v1/lugares', { params: filters });
        }

        let data = res.data;
        if (data) {
          data = compactPayload(data, { campos, incluir_imagenes });
        }

        return { res, resultPayload: data || res };
      });
    }
  );

  // 6. Consulta Genérica de Recursos Dinámicos (28 recursos)
  server.tool(
    'turismo_get_recurso',
    'Consulta genérica a cualquiera de los 28 recursos dinámicos de la API (hoteles, prestadores, gastronomia, destinos, localidades, articulos, agencias, guias, etc.). Resuelve automáticamente sinónimos en lenguaje natural.',
    {
      recurso: z.string().describe('Nombre del recurso (ej: "hoteles", "gastronomia", "prestadores", "destinos", "agencias", "guias", "articulos", "localidades"). Acepta sinónimos como "restaurantes", "alojamiento", "noticias".'),
      codigo: z.string().optional().describe('Código opcional para consultar el detalle de un recurso específico.'),
      id: z.string().optional().describe('Alias de código.'),
      filtros: z.record(z.string(), z.any()).optional().describe('Parámetros clave-valor de filtro (ej: {"localidad": "Yerba Buena", "limite": 5}).'),
      campos: z.string().optional().describe('Lista de campos requeridos separados por coma (ej: "nombre,direccion,telefono").'),
      incluir_imagenes: z.boolean().optional().describe('Si es true, incluye URLs de imágenes. Por defecto es false para ahorrar tokens.'),
      base_url: z.string().optional().describe('URL base opcional de la API.')
    },
    async (args) => {
      return executeAndLog('turismo_get_recurso', args, async () => {
        const canonicalResource = normalizeResourceName(args.recurso || '');
        const codigo = args.codigo || args.id;
        const filters = { ...(args.filtros || {}) };

        if (filters.localidad) {
          filters.localidad = resolveLocality(filters.localidad);
        }
        if (filters.circuito) {
          filters.circuito = resolveCircuit(filters.circuito);
        }
        if (!filters.limite && !codigo) {
          filters.limite = DEFAULT_AI_LIMIT;
        }

        let res;
        if (codigo) {
          const detailSlug = DETAIL_MAP[canonicalResource];
          if (detailSlug) {
            res = await apiRequestWithFallback(args.base_url, `/api/v1/${detailSlug}/${encodeURIComponent(codigo)}`);
          }
          if (!res || res.status === 404) {
            res = await apiRequestWithFallback(args.base_url, `/api/v1/${encodeURIComponent(canonicalResource)}/${encodeURIComponent(codigo)}`);
          }
        } else {
          res = await apiRequestWithFallback(args.base_url, `/api/v1/${encodeURIComponent(canonicalResource)}`, { params: filters });
        }

        let data = res.data;
        if (data) {
          data = compactPayload(data, {
            campos: args.campos,
            incluir_imagenes: args.incluir_imagenes
          });
        }

        return { res, resultPayload: data || res };
      });
    }
  );

  // 7. Perfil de Usuario Protegido
  server.tool(
    'turismo_get_perfil',
    'Consulta el endpoint protegido de perfil de usuario mediante un token Bearer JWT obtenido en turismo_login.',
    {
      token: z.string().describe('Token JWT recibido previamente en turismo_login.'),
      base_url: z.string().optional().describe('URL base opcional de la API.')
    },
    async ({ token, base_url }) => {
      return executeAndLog('turismo_get_perfil', { base_url }, async () => {
        const res = await apiRequestWithFallback(base_url, '/api/users/profile', { token });
        return { res, resultPayload: res.data || res };
      });
    }
  );
}
