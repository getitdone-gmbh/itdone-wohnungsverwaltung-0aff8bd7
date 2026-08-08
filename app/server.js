import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { pool, initDb } from './db.js';
import { money, dateDe, dokKategorieLabel } from './helpers.js';

import wohnungenRouter from './routes/wohnungen.js';
import mietvertraegeRouter from './routes/mietvertraege.js';
import mieterRouter from './routes/mieter.js';
import dokumenteRouter from './routes/dokumente.js';
import finanzenRouter from './routes/finanzen.js';
import nebenkostenRouter from './routes/nebenkosten.js';
import einstellungenRouter from './routes/einstellungen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

async function main() {
  await initDb();

  const app = express();
  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    res.locals.user = null;
    res.locals.fmtMoney = money;
    res.locals.fmtDate = dateDe;
    res.locals.dokLabel = dokKategorieLabel;
    next();
  });

  app.get('/healthz', (req, res) => res.send('ok'));

  app.get('/', async (req, res) => {
    const wohnungenCount = await pool.query('SELECT COUNT(*) FROM wohnungen');
    const mieterCount = await pool.query('SELECT COUNT(*) FROM mieter');
    const dokumenteCount = await pool.query('SELECT COUNT(*) FROM dokumente');

    const aktuelleRes = await pool.query(`
      SELECT w.id, w.name, w.adresse,
        m.name AS mieter_name, mv.kaltmiete, mv.nebenkosten_vorauszahlung
      FROM wohnungen w
      LEFT JOIN mietvertraege mv ON mv.wohnung_id = w.id AND (mv.ende IS NULL OR mv.ende >= CURRENT_DATE)
      LEFT JOIN mieter m ON m.id = mv.mieter_id
      ORDER BY w.name
    `);

    const dokRes = await pool.query(`
      SELECT d.id, d.kategorie, d.dateiname, d.hochgeladen_am, w.name AS wohnung_name
      FROM dokumente d LEFT JOIN wohnungen w ON w.id = d.wohnung_id
      ORDER BY d.hochgeladen_am DESC LIMIT 6
    `);

    res.render('dashboard', {
      title: 'Übersicht',
      active: 'dashboard',
      counts: {
        wohnungen: wohnungenCount.rows[0].count,
        mieter: mieterCount.rows[0].count,
        dokumente: dokumenteCount.rows[0].count,
      },
      wohnungenUebersicht: aktuelleRes.rows,
      neuesteDokumente: dokRes.rows,
    });
  });

  app.use('/wohnungen', wohnungenRouter);
  app.use('/mietvertraege', mietvertraegeRouter);
  app.use('/mieter', mieterRouter);
  app.use('/dokumente', dokumenteRouter);
  app.use('/finanzen', finanzenRouter);
  app.use('/nebenkosten', nebenkostenRouter);
  app.use('/einstellungen', einstellungenRouter);

  app.use((req, res) => {
    res.status(404).send('Seite nicht gefunden. <a href="/">Zurück zur Übersicht</a>');
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server läuft auf Port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Startfehler', err);
  process.exit(1);
});
