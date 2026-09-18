#!/usr/bin/env node
/**
 * GigaBazar y ElectroExpress son dos proyectos de Vercel independientes (cada
 * uno con su Root Directory), así que no pueden importar código de una carpeta
 * hermana. El código es el mismo: GigaBazar es la fuente y este script lo
 * copia a ElectroExpress.
 *
 *   node competitors/tools/sincronizar.js              copia gigabazar -> electroexpress
 *   node competitors/tools/sincronizar.js --verificar  sale con 1 si hay diferencias
 *
 * Lo propio de cada tienda NO se copia: src/tienda.js (identidad y precios
 * base), public/css/estilos.css (tema), index.html (snapshot) y el nombre en
 * package.json (se verifica que dependencias y scripts coincidan).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ORIGEN = path.join(RAIZ, 'gigabazar');
const DESTINOS = [path.join(RAIZ, 'electroexpress')];

const COMPARTIDOS = [
  'server.js',
  'api/index.js',
  'src/app.js',
  'src/catalogo.js',
  'src/config.js',
  'src/datos.js',
  'src/render.js',
  'src/seguridad.js',
  'scripts/snapshot.js',
  'test/app.test.js',
  'vercel.json',
  '.vercelignore',
  '.env.example'
];

const verificar = process.argv.includes('--verificar');
const diferencias = [];

for (const destino of DESTINOS) {
  const nombre = path.basename(destino);

  for (const rel of COMPARTIDOS) {
    const contenido = fs.readFileSync(path.join(ORIGEN, rel), 'utf8');
    const archivo = path.join(destino, rel);
    const actual = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8') : null;
    if (actual === contenido) continue;
    if (verificar) {
      diferencias.push(nombre + '/' + rel);
    } else {
      fs.mkdirSync(path.dirname(archivo), { recursive: true });
      fs.writeFileSync(archivo, contenido, 'utf8');
      console.log('copiado ' + nombre + '/' + rel);
    }
  }

  const pkgOrigen = JSON.parse(fs.readFileSync(path.join(ORIGEN, 'package.json'), 'utf8'));
  const pkgDestino = JSON.parse(fs.readFileSync(path.join(destino, 'package.json'), 'utf8'));
  for (const campo of ['version', 'scripts', 'engines', 'dependencies']) {
    if (JSON.stringify(pkgOrigen[campo]) !== JSON.stringify(pkgDestino[campo])) {
      diferencias.push(nombre + '/package.json (' + campo + ') — actualízalo a mano');
    }
  }
}

if (diferencias.length) {
  console.error((verificar ? 'Difieren de gigabazar:\n  ' : 'Pendiente:\n  ') + diferencias.join('\n  '));
  process.exit(1);
}
console.log(verificar ? 'Código compartido idéntico en las dos tiendas.' : 'Sincronizado.');
