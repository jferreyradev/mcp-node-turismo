/**
 * McpOptimizer: Motor de optimización y resolución semántica para el servidor MCP de Turismo.
 * 
 * Principios:
 * 1. Resolución canónica y difusa en memoria (Levenshtein <= 2) de 58 localidades y circuitos.
 * 2. Normalización de sinónimos y recursos en lenguaje natural.
 * 3. Compactación de payloads para reducir consumo de contexto LLM (>95% ahorro de tokens).
 * 4. Paginación amigable con DEFAULT_AI_LIMIT = 5.
 */

export const DEFAULT_AI_LIMIT = 5;

/**
 * Obtiene la fecha actual en formato ISO (YYYY-MM-DD) según el huso horario oficial de Argentina (UTC-3).
 */
export function getTodayDateArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

// Diccionario de las 58 localidades oficiales de Tucumán + sinónimos coloquiales
export const LOCALIDADES = {
  'acheral': '0725c7a10de2ee81516d46662c8d0ad5',
  'aguilares': 'bba7bec713fe2322c15323a4f32cbcf4',
  'alberdi': '1f1ccf9a660e776b22f35831c2c3a41b',
  'juan bautista alberdi': 'd2cfb2f02361c88315c7c561fab02e74',
  'alderetes': '43d22681e8db43dc8b4ae6cda21e964a',
  'alpachiri': 'da06e3093d9c2688f6846c1a53df803c',
  'amaicha': '034b66e68c56c484676e706b926a2756',
  'amaicha del valle': '034b66e68c56c484676e706b926a2756',
  'ampimpa': 'd6d25993a40de7d965acfbcb7aacbb75',
  'atahona': 'e56d327d92cbd8b712ff8e4fc7075433',
  'banda del rio sali': '4f69128f9bd84299d5f6b4c65472a977',
  'bella vista': 'c8d829762c34c0e2e5be1d440b498456',
  'burruyacu': '586a9ac36063c619137757626d1c317b',
  'cafayate': 'd7826ebcc0b3e8422371dff35b1d092c',
  'cevil pozo': 'adadf84ac7c6a06be3428213fa7fe9fb',
  'chicligasta': 'd369e0a314d41bf6c2fb745f8997e3e4',
  'choromoro': '8135b24f7aaeeb52a8480efb2b01a3b6',
  'colalao del valle': '0db077e859934c43f4db9691ac0e4f09',
  'concepcion': '9688e6b323d6796374c2ab776f756191',
  'dique escaba': 'c8056a646a2d23650d4e3e7401b4e63f',
  'el banado': '72186810484ec797fd2c48f443c0a2ba',
  'el cadillal': '9acb1864779b4ac55bd86109a437b756',
  'cadillal': '9acb1864779b4ac55bd86109a437b756',
  'el mollar': '57476ca036677754da69c88d2c595dc1',
  'mollar': '57476ca036677754da69c88d2c595dc1',
  'el pichao': '3f657720042e0b48236ae46560b8ce0a',
  'pichao': '3f657720042e0b48236ae46560b8ce0a',
  'escaba': 'cb3f552d6b640770391c00cb47d0e294',
  'famailla': '3a5cc3b28ed4a00c0ae5bdbd0ad2a83b',
  'graneros': '7509824beaf6fe252c63840b42c0d6c8',
  'la cocha': '2f70d320b1a71463bf1e7db0491603d6',
  'la florida': '65307055735c91ccf2f9658fa7c85138',
  'lamadrid': '4acbce7f63ea64c55b94f601a71080bf',
  'las talitas': 'ab151a3a095c0911132330de9833129c',
  'leales': '76ef4455301daedb9aa0004fe79a918d',
  'lules': '955768f47542d69a7a4addc4c22a2843',
  'monteagudo': '9652105f12ecb597525a2ce0ae962cc6',
  'monteros': 'a14c868f3572f4102a2a3867355a978f',
  'quilmes': 'afea78cbd3109c3b52634346f46c65ef',
  'raco': 'cda0a0d8310db0888c2585920a14e358',
  'rio colorado': 'fa99b159872c61800236f71c5c1d61bd',
  'rumi punco': 'fbc6c9b4a973011d37048eb813f4f7cc',
  'samay cochuna': '7adb11b3c1cc3a5150c6c6e5cebb53b6',
  'san javier': 'e4dcb66aefbadfbed43973273907d128',
  'san jose de chasquivil': '1b940aa8eeb23c83d0b18a6928003561',
  'san miguel de tucuman': '5a4f49d9f51b630a13c6f59c28a68a5f',
  'san miguel': '5a4f49d9f51b630a13c6f59c28a68a5f',
  'tucuman': '5a4f49d9f51b630a13c6f59c28a68a5f',
  'capital': '5a4f49d9f51b630a13c6f59c28a68a5f',
  'san pablo': '7d9c980eda462a403926b3b9d609d9f6',
  'san pedro de colalao': 'd898f67e0ad68aa40f6efe1634cbb2f3',
  'san pedro': 'd898f67e0ad68aa40f6efe1634cbb2f3',
  'santa ana': '56b30ff77bd27cafb32d1d7c19fc2df2',
  'santa lucia': '71267ab1efe85faedf7879795fc7ce90',
  'santa rosa de leales': '691b5c3887197e259022c2aae76d95ef',
  'simoca': '0d97f9c0ff3535eefb6c1b8b7a4c4e24',
  'taco ralo': 'fac85dfbae6a0419c3606a902ee0ce10',
  'tafi del valle': '776cb40c95d5a00a3efc8493ba483f38',
  'tafi': '776cb40c95d5a00a3efc8493ba483f38',
  'tafi viejo': 'e676147248ba3de6fc89eec528c640d4',
  'talapazo': 'b2a31ccc548bd864959fb2ec3d887c98',
  'tapia': 'f2eb3a211e9528dafbf7a0fe27420c66',
  'timbo viejo': 'e2da776fe3012c688653934bab7a212a',
  'trancas': '71ff171bb9e7f0198f535115c34358a0',
  'villa de leales': '09e997762315b9839591dedc1073f91b',
  'villa nougues': '9991637eef383442cd2fb3c60ae98dea',
  'yerba buena': '56865c9d51953354658aaa1d79bf7abb'
};

// Diccionario de Circuitos Turísticos Oficiales
export const CIRCUITOS = {
  'calchaqui': '182f5abd139b586de82dccc2851e1510',
  'valles calchaquies': '182f5abd139b586de82dccc2851e1510',
  'circuito valles calchaquies': '182f5abd139b586de82dccc2851e1510',
  'choromoro': 'c31662be70dcb4700e2e376d3340492e',
  'circuito choromoro': 'c31662be70dcb4700e2e376d3340492e',
  'valle de choromoro': 'c31662be70dcb4700e2e376d3340492e',
  'sur': '5420dd943b3fd25cb93b0b695ba77b5b',
  'circuito sur': '5420dd943b3fd25cb93b0b695ba77b5b',
  'yungas': '2b6f1060d29ed3534b1ffba7fa20fa70',
  'circuito yungas': '2b6f1060d29ed3534b1ffba7fa20fa70',
  'ciudad historica': 'c2b2337006959d7262a3fa61ead969e3',
  'historica': 'c2b2337006959d7262a3fa61ead969e3'
};

// Normalización de recursos y sinónimos a su nombre canónico
export const RESOURCE_ALIASES = {
  evento: 'eventos',
  hotel: 'hoteles',
  prestador: 'prestadores',
  destino: 'destinos',
  lugar: 'lugares',
  agencia: 'agencias',
  guia: 'guias',
  articulo: 'articulos',
  localidad: 'localidades',
  circuito: 'circuitos',
  seccion: 'secciones',
  subseccion: 'subsecciones',
  idioma: 'idiomas',
  restaurante: 'gastronomia',
  restaurantes: 'gastronomia',
  comida: 'gastronomia',
  bares: 'gastronomia',
  bar: 'gastronomia',
  restaurant: 'gastronomia',
  restaurants: 'gastronomia',
  alojamiento: 'hoteles',
  alojamientos: 'hoteles',
  hospedaje: 'hoteles',
  hospedajes: 'hoteles',
  hostel: 'hoteles',
  hostels: 'hoteles',
  hotels: 'hoteles',
  atractivo: 'lugares',
  atractivos: 'lugares',
  sitio: 'lugares',
  sitios: 'lugares',
  punto: 'lugares',
  puntos: 'lugares',
  places: 'lugares',
  place: 'lugares',
  attraction: 'lugares',
  attractions: 'lugares',
  ciudad: 'localidades',
  ciudades: 'localidades',
  municipio: 'localidades',
  municipios: 'localidades',
  pueblo: 'localidades',
  pueblos: 'localidades',
  city: 'localidades',
  cities: 'localidades',
  town: 'localidades',
  towns: 'localidades',
  noticia: 'articulos',
  noticias: 'articulos',
  nota: 'articulos',
  notas: 'articulos',
  post: 'articulos',
  posts: 'articulos',
  news: 'articulos',
  article: 'articulos',
  articles: 'articulos',
  'categorias-hoteles': 'hoteles-categorias',
  'categorias-eventos': 'eventos-categorias',
  'subcategorias-eventos': 'eventos-subcategorias',
  'categorias-gastronomia': 'gastronomia-categorias',
  'tipos-prestadores': 'prestadores-tipos',
  'tipos-prestador': 'prestadores-tipos',
  events: 'eventos',
  event: 'eventos',
  circuits: 'circuitos',
  circuit: 'circuitos',
  guides: 'guias',
  guide: 'guias',
  agencies: 'agencias',
  agency: 'agencias'
};

// Mapeo automático de entidades con endpoints dedicados de detalle
export const DETAIL_MAP = {
  eventos: 'evento-detalle',
  hoteles: 'hotel-detalle',
  prestadores: 'prestador-detalle',
  destinos: 'destino-detalle',
  gastronomia: 'gastronomia-detalle',
  agencias: 'agencia-detalle',
  guias: 'guia-detalle',
  articulos: 'articulo-detalle',
  lugares: 'lugar-detalle'
};

// Catálogo de todos los recursos disponibles en la API
export const RECURSOS_CATALOGO = [
  { recurso: 'eventos', detalle: 'evento-detalle/{codigo}', descripcion: 'Agenda oficial de eventos, festivales y congresos' },
  { recurso: 'lugares', detalle: 'lugar-detalle/{codigo}', descripcion: 'Atractivos turísticos, museos, monumentos y parques' },
  { recurso: 'hoteles', detalle: 'hotel-detalle/{codigo}', descripcion: 'Alojamientos, hoteles, hosterías y cabañas' },
  { recurso: 'gastronomia', detalle: 'gastronomia-detalle/{codigo}', descripcion: 'Restaurantes, bares, cafeterías y confiterías' },
  { recurso: 'prestadores', detalle: 'prestador-detalle/{codigo}', descripcion: 'Prestadores de turismo activo y aventura' },
  { recurso: 'destinos', detalle: 'destino-detalle/{codigo}', descripcion: 'Destinos y valles turísticos' },
  { recurso: 'agencias', detalle: 'agencia-detalle/{codigo}', descripcion: 'Agencias de viajes oficiales' },
  { recurso: 'guias', detalle: 'guia-detalle/{codigo}', descripcion: 'Guías de turismo matriculados' },
  { recurso: 'articulos', detalle: 'articulo-detalle/{codigo}', descripcion: 'Noticias, comunicados y notas de interés' },
  { recurso: 'secciones', detalle: null, descripcion: 'Secciones de contenidos' },
  { recurso: 'subsecciones', detalle: null, descripcion: 'Subsecciones de contenidos' },
  { recurso: 'localidades', detalle: null, descripcion: '58 localidades oficiales de la provincia' },
  { recurso: 'circuitos', detalle: null, descripcion: 'Circuitos turísticos oficiales' },
  { recurso: 'hoteles-categorias', detalle: null, descripcion: 'Categorías y tipos de hoteles' },
  { recurso: 'eventos-categorias', detalle: null, descripcion: 'Categorías temáticas de eventos' },
  { recurso: 'eventos-subcategorias', detalle: null, descripcion: 'Subcategorías de eventos' },
  { recurso: 'prestadores-tipos', detalle: null, descripcion: 'Tipos de actividades y prestadores' },
  { recurso: 'gastronomia-categorias', detalle: null, descripcion: 'Categorías de locales gastronómicos' },
  { recurso: 'idiomas', detalle: null, descripcion: 'Idiomas disponibles en la plataforma' }
];

/**
 * Normaliza cadenas de texto eliminando acentos, espacios duplicados y mayúsculas.
 */
export function normalizeString(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Calcula la distancia de Levenshtein entre dos cadenas.
 */
export function levenshtein(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) matrix[0][j] = j;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Resuelve el nombre de una localidad al hash MD5 de 32 caracteres.
 * Soporta coincidencia exacta, normalización de acentos y tolerancia fuzzy (Levenshtein <= 2).
 */
export function resolveLocality(input) {
  if (!input) return null;
  const str = String(input).trim();
  // Si ya es un hash hexadecimal de 32 caracteres, mantenerlo directamente
  if (/^[0-9a-fA-F]{32}$/.test(str)) {
    return str.toLowerCase();
  }

  const norm = normalizeString(str);
  if (LOCALIDADES[norm]) return LOCALIDADES[norm];

  // Búsqueda difusa (Fuzzy Matching con distancia <= 2)
  let bestMatch = null;
  let bestDist = 999;
  for (const [name, hash] of Object.entries(LOCALIDADES)) {
    const dist = levenshtein(norm, name);
    if (dist <= 2 && dist < bestDist) {
      bestDist = dist;
      bestMatch = hash;
    }
  }

  return bestMatch || str;
}

/**
 * Resuelve el nombre de un circuito turístico al hash MD5 de 32 caracteres.
 */
export function resolveCircuit(input) {
  if (!input) return null;
  const str = String(input).trim();
  if (/^[0-9a-fA-F]{32}$/.test(str)) {
    return str.toLowerCase();
  }

  const norm = normalizeString(str);
  if (CIRCUITOS[norm]) return CIRCUITOS[norm];

  let bestMatch = null;
  let bestDist = 999;
  for (const [name, hash] of Object.entries(CIRCUITOS)) {
    const dist = levenshtein(norm, name);
    if (dist <= 2 && dist < bestDist) {
      bestDist = dist;
      bestMatch = hash;
    }
  }

  return bestMatch || str;
}

/**
 * Normaliza nombres de recursos y sinónimos (ej: "restaurante" -> "gastronomia").
 */
export function normalizeResourceName(name) {
  if (!name) return '';
  const norm = String(name).toLowerCase().trim().replace(/[_/ ]+/g, '-');
  return RESOURCE_ALIASES[norm] || norm;
}

/**
 * Compacta payloads recursivamente para eliminar campos vacíos, redundantes y optimizar para LLM.
 */
export function compactPayload(data, options = {}) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => compactItem(item, options));
  }

  if (data.data && Array.isArray(data.data)) {
    return {
      ...data,
      data: data.data.map(item => compactItem(item, options))
    };
  }

  return compactItem(data, options);
}

function compactItem(item, options = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return item;
  }

  const redundantMap = {
    codigo_localidad: 'localidad',
    codigo_categoria: 'categoria',
    codigo_subcategoria: 'subcategoria',
    codigo_circuito: 'circuito',
    codigo_idioma: 'idioma',
    codigo_seccion: 'seccion',
    codigo_subseccion: 'subseccion'
  };

  const incluirImagenes = Boolean(options.incluir_imagenes || options.con_imagenes);
  let camposPermitidos = null;
  if (options.campos) {
    const list = Array.isArray(options.campos)
      ? options.campos
      : String(options.campos).split(',').map(s => s.trim());
    camposPermitidos = new Set(list);
  }

  const clean = {};
  for (const [key, val] of Object.entries(item)) {
    // Descartar códigos técnicos redundantes si ya existe el nombre humano legible
    if (redundantMap[key] && item[redundantMap[key]]) {
      continue;
    }

    // Descartar valores vacíos o nulos
    if (val === null || val === '' || val === 'null' || val === '0000-00-00') {
      continue;
    }

    // Descartar flags neutros (0)
    if ((key === 'destacado' || key === 'tucmesa') && (val === 0 || val === '0')) {
      continue;
    }

    // Omitir imágenes si no se solicitaron explícitamente para ahorrar cientos de tokens
    if (key === 'imagen' && !incluirImagenes) {
      continue;
    }

    // Redondear coordenadas a 4 decimales (~11m de precisión, ahorrando ~40 tokens por registro)
    if ((key === 'latitud' || key === 'longitud') && !isNaN(Number(val))) {
      clean[key] = Math.round(Number(val) * 10000) / 10000;
      continue;
    }

    // Filtro selectivo de campos (preserva siempre codigo y nombre si existen)
    if (camposPermitidos && key !== 'codigo' && key !== 'nombre' && !camposPermitidos.has(key)) {
      continue;
    }

    if (val && typeof val === 'object') {
      const sub = compactPayload(val, options);
      if (sub && (Array.isArray(sub) || Object.keys(sub).length > 0)) {
        clean[key] = sub;
      }
    } else {
      clean[key] = val;
    }
  }

  return clean;
}

/**
 * Filtra arrays de objetos en memoria por búsqueda insensible a tildes y mayúsculas.
 */
export function filterList(items, term) {
  if (!term || !Array.isArray(items)) return items;
  const normTerm = normalizeString(term);
  return items.filter(it => normalizeString(it.nombre || '').includes(normTerm));
}
