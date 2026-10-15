/**
 * Cliente HTTP para la API REST de Turismo Tucumán.
 * 
 * Gestiona peticiones fetch nativas, timeouts, fallback automático de rutas (/v1 y /api/v1)
 * y formateo de respuestas de error.
 */

export const DEFAULT_BASE_URL = process.env.TURISMO_API_URL || 'http://api.tucumanturismo.gob.ar';

export function cleanBaseUrl(url) {
  const base = url || DEFAULT_BASE_URL;
  return base.replace(/\/+$/, '');
}

/**
 * Realiza una petición HTTP con reintentos y compatibilidad con prefijos de API.
 */
export async function apiRequest(url, options = {}) {
  const {
    method = 'GET',
    params = {},
    body = null,
    token = null,
    timeoutMs = 15000
  } = options;

  let requestUrl = url;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      requestUrl += (requestUrl.includes('?') ? '&' : '?') + qs;
    }
  }

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Turismo-MCP-Node/1.0'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    if (body) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(requestUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      isError: !response.ok,
      status: response.status,
      data,
      url: requestUrl
    };
  } catch (err) {
    return {
      isError: true,
      status: 500,
      message: `Error de conexión HTTP: ${err.message} hacia ${requestUrl}`,
      data: null,
      url: requestUrl
    };
  }
}

/**
 * Ejecuta una petición con fallback entre `/v1/...` y `/api/v1/...` en caso de 404.
 */
export async function apiRequestWithFallback(baseUrl, path, options = {}) {
  const base = cleanBaseUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Intentar la ruta directa primero
  let res = await apiRequest(`${base}${normalizedPath}`, options);

  // Si da 404, intentar con el prefijo alternativo
  if (res.status === 404) {
    let alternativePath;
    if (normalizedPath.startsWith('/api/')) {
      alternativePath = normalizedPath.replace(/^\/api/, '');
    } else {
      alternativePath = `/api${normalizedPath}`;
    }
    const altRes = await apiRequest(`${base}${alternativePath}`, options);
    if (!altRes.isError || altRes.status !== 404) {
      return altRes;
    }
  }

  return res;
}
