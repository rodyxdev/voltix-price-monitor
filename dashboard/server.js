/**
 * Voltix - servidor del dashboard.
 *
 * Fase 1: únicamente sirve el frontend estático de /public.
 * Fase 2 agregará aquí las rutas de API (datos reales desde Supabase,
 * POST /api/monitoreo para "ejecutar ahora" y descarga de reportes).
 */
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Chequeo de salud: útil para el deploy de Fase 3.
app.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'voltix-dashboard', fase: 1 });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Voltix dashboard escuchando en http://localhost:${PORT}`);
});
