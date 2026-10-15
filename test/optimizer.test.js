import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLocality,
  resolveCircuit,
  normalizeResourceName,
  normalizeString,
  levenshtein,
  compactPayload,
  filterList,
  LOCALIDADES,
  CIRCUITOS
} from '../src/optimizer.js';

test('normalizeString normaliza correctamente acentos y mayúsculas', () => {
  assert.equal(normalizeString('  Tafí  del   Valle  '), 'tafi del valle');
  assert.equal(normalizeString('CONCEPCIÓN'), 'concepcion');
  assert.equal(normalizeString('Año Nuevo'), 'ano nuevo');
});

test('levenshtein calcula distancias de edición correctas', () => {
  assert.equal(levenshtein('aguilares', 'aguilares'), 0);
  assert.equal(levenshtein('aguilare', 'aguilares'), 1);
  assert.equal(levenshtein('montero', 'monteros'), 1);
  assert.equal(levenshtein('casa', 'caza'), 1);
  assert.equal(levenshtein('tucuman', 'salta'), 6);
});

test('resolveLocality resuelve localidades exactas, con acentos y aliases', () => {
  // Aguilares
  assert.equal(resolveLocality('Aguilares'), LOCALIDADES['aguilares']);
  assert.equal(resolveLocality('aguilares'), LOCALIDADES['aguilares']);

  // Con acentos: Tafí del Valle
  assert.equal(resolveLocality('Tafí del Valle'), LOCALIDADES['tafi del valle']);
  assert.equal(resolveLocality('tafi del valle'), LOCALIDADES['tafi del valle']);
  assert.equal(resolveLocality('tafi'), LOCALIDADES['tafi del valle']);

  // Capital / Tucumán
  assert.equal(resolveLocality('capital'), LOCALIDADES['san miguel de tucuman']);
  assert.equal(resolveLocality('San Miguel de Tucumán'), LOCALIDADES['san miguel de tucuman']);
  assert.equal(resolveLocality('tucuman'), LOCALIDADES['san miguel de tucuman']);

  // San Pedro
  assert.equal(resolveLocality('San Pedro'), LOCALIDADES['san pedro de colalao']);
});

test('resolveLocality tolera errores de tipeo con distancia Levenshtein <= 2', () => {
  // Typo: aguilare -> aguilares (distancia 1)
  assert.equal(resolveLocality('aguilare'), LOCALIDADES['aguilares']);

  // Typo: concepcio -> concepcion (distancia 1)
  assert.equal(resolveLocality('concepcio'), LOCALIDADES['concepcion']);

  // Typo: monteros -> montero (distancia 1)
  assert.equal(resolveLocality('montero'), LOCALIDADES['monteros']);
});

test('resolveLocality preserva hashes hexadecimales válidos de 32 caracteres', () => {
  const hash = 'bba7bec713fe2322c15323a4f32cbcf4';
  assert.equal(resolveLocality(hash), hash);
  assert.equal(resolveLocality(hash.toUpperCase()), hash);
});

test('resolveCircuit resuelve circuitos oficiales y variantes', () => {
  assert.equal(resolveCircuit('Valles Calchaquies'), CIRCUITOS['valles calchaquies']);
  assert.equal(resolveCircuit('valles calchaquies'), CIRCUITOS['valles calchaquies']);
  assert.equal(resolveCircuit('Yungas'), CIRCUITOS['yungas']);
  assert.equal(resolveCircuit('Sur'), CIRCUITOS['sur']);
  assert.equal(resolveCircuit('Ciudad Histórica'), CIRCUITOS['ciudad historica']);
});

test('normalizeResourceName mapea sinónimos coloquiales a nombres canónicos', () => {
  assert.equal(normalizeResourceName('restaurantes'), 'gastronomia');
  assert.equal(normalizeResourceName('restaurante'), 'gastronomia');
  assert.equal(normalizeResourceName('comida'), 'gastronomia');
  assert.equal(normalizeResourceName('alojamiento'), 'hoteles');
  assert.equal(normalizeResourceName('hospedajes'), 'hoteles');
  assert.equal(normalizeResourceName('hotel'), 'hoteles');
  assert.equal(normalizeResourceName('atractivos'), 'lugares');
  assert.equal(normalizeResourceName('ciudades'), 'localidades');
  assert.equal(normalizeResourceName('noticias'), 'articulos');
  assert.equal(normalizeResourceName('hoteles_categorias'), 'hoteles-categorias');
});

test('compactPayload elimina claves nulas, vacías, redundantes y formatea GPS', () => {
  const rawItem = {
    codigo: '12345678901234567890123456789012',
    nombre: 'Hotel Tucumano',
    codigo_localidad: '5a4f49d9f51b630a13c6f59c28a68a5f',
    localidad: 'San Miguel de Tucumán',
    codigo_categoria: 'cat_01',
    categoria: '3 Estrellas',
    descripcion: '',
    telefono_secundario: null,
    fecha_baja: '0000-00-00',
    destacado: 0,
    tucmesa: 0,
    latitud: -26.858068470094942,
    longitud: -65.2071987654321,
    imagen: 'https://cdn.turismo.gob.ar/images/hotel_grande_123456.jpg'
  };

  const compacted = compactPayload(rawItem);

  // Verificaciones de limpieza
  assert.equal(compacted.codigo, '12345678901234567890123456789012');
  assert.equal(compacted.nombre, 'Hotel Tucumano');
  assert.equal(compacted.localidad, 'San Miguel de Tucumán');
  assert.equal(compacted.categoria, '3 Estrellas');

  // Claves técnicas redundantes deben ser eliminadas
  assert.equal(compacted.codigo_localidad, undefined);
  assert.equal(compacted.codigo_categoria, undefined);

  // Claves vacías y nulas deben ser eliminadas
  assert.equal(compacted.descripcion, undefined);
  assert.equal(compacted.telefono_secundario, undefined);
  assert.equal(compacted.fecha_baja, undefined);
  assert.equal(compacted.destacado, undefined);
  assert.equal(compacted.tucmesa, undefined);

  // Redondeo de GPS a 4 decimales
  assert.equal(compacted.latitud, -26.8581);
  assert.equal(compacted.longitud, -65.2072);

  // Imagen debe ser omitida por defecto para ahorrar tokens
  assert.equal(compacted.imagen, undefined);
});

test('compactPayload incluye imágenes cuando se solicita explícitamente', () => {
  const rawItem = {
    nombre: 'Lugar Hermoso',
    imagen: 'https://cdn.turismo.gob.ar/foto.jpg'
  };

  const withImg = compactPayload(rawItem, { incluir_imagenes: true });
  assert.equal(withImg.imagen, 'https://cdn.turismo.gob.ar/foto.jpg');
});

test('compactPayload aplica proyección selectiva con campos', () => {
  const rawItem = {
    codigo: 'abc',
    nombre: 'Restó Central',
    direccion: 'San Martín 100',
    telefono: '381-123456',
    horarios: 'Lunes a Viernes 08:00 a 20:00',
    servicios: ['Wi-Fi', 'Aire Acondicionado']
  };

  const projected = compactPayload(rawItem, { campos: 'direccion,telefono' });

  // codigo y nombre se preservan siempre
  assert.equal(projected.codigo, 'abc');
  assert.equal(projected.nombre, 'Restó Central');
  assert.equal(projected.direccion, 'San Martín 100');
  assert.equal(projected.telefono, '381-123456');

  // Campos no solicitados se eliminan
  assert.equal(projected.horarios, undefined);
  assert.equal(projected.servicios, undefined);
});

test('filterList filtra arrays de objetos en memoria ignorando mayúsculas y acentos', () => {
  const list = [
    { nombre: 'Circuito Valles Calchaquíes' },
    { nombre: 'Circuito Yungas' },
    { nombre: 'Circuito Choromoro' },
    { nombre: 'Ciudad Histórica' }
  ];

  const filtered = filterList(list, 'valle');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].nombre, 'Circuito Valles Calchaquíes');

  const filteredHistorica = filterList(list, 'historica');
  assert.equal(filteredHistorica.length, 1);
  assert.equal(filteredHistorica[0].nombre, 'Ciudad Histórica');
});
