import express from 'express';
import { pool } from '../db.js';
import { currentYear } from '../helpers.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const listRes = await pool.query(`
    SELECT n.*, w.name AS wohnung_name, m.name AS mieter_name
    FROM nebenkostenabrechnungen n
    JOIN wohnungen w ON w.id = n.wohnung_id
    JOIN mieter m ON m.id = n.mieter_id
    ORDER BY n.jahr DESC, n.erstellt_am DESC
  `);
  const wohnungenRes = await pool.query('SELECT id, name FROM wohnungen ORDER BY name');
  const mieterRes = await pool.query(`
    SELECT mv.wohnung_id, m.id AS mieter_id, m.name
    FROM mietvertraege mv JOIN mieter m ON m.id = mv.mieter_id
    ORDER BY m.name
  `);

  res.render('nebenkosten/index', {
    title: 'Nebenkostenabrechnung',
    active: 'nebenkosten',
    abrechnungen: listRes.rows,
    wohnungen: wohnungenRes.rows,
    mietverhaeltnisse: mieterRes.rows,
    thisYear: currentYear(),
  });
});

router.get('/vorschlag', async (req, res) => {
  const { wohnung_id, mieter_id, jahr } = req.query;
  if (!wohnung_id || !jahr) return res.json({});
  const kostenRes = await pool.query(
    `SELECT COALESCE(SUM(betrag),0) AS summe FROM finanzeintraege
     WHERE wohnung_id = $1 AND jahr = $2 AND art = 'kosten' AND kategorie ILIKE '%Nebenkosten%'`,
    [wohnung_id, jahr]
  );
  let vorauszahlung = 0;
  if (mieter_id) {
    const vertragRes = await pool.query(
      `SELECT nebenkosten_vorauszahlung FROM mietvertraege
       WHERE wohnung_id = $1 AND mieter_id = $2 ORDER BY beginn DESC LIMIT 1`,
      [wohnung_id, mieter_id]
    );
    if (vertragRes.rows.length > 0) {
      vorauszahlung = Number(vertragRes.rows[0].nebenkosten_vorauszahlung) * 12;
    }
  }
  res.json({ kosten: Number(kostenRes.rows[0].summe), vorauszahlung });
});

router.post('/', async (req, res) => {
  const { wohnung_id, mieter_id, jahr, zeitraum_von, zeitraum_bis, vorauszahlung_gesamt, tatsaechliche_kosten } = req.body;
  if (!wohnung_id || !mieter_id || !jahr) return res.redirect('/nebenkosten');
  const result = await pool.query(
    `INSERT INTO nebenkostenabrechnungen
      (wohnung_id, mieter_id, jahr, zeitraum_von, zeitraum_bis, vorauszahlung_gesamt, tatsaechliche_kosten)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [wohnung_id, mieter_id, jahr, zeitraum_von || null, zeitraum_bis || null, vorauszahlung_gesamt || 0, tatsaechliche_kosten || 0]
  );
  res.redirect(`/nebenkosten/${result.rows[0].id}/anschreiben`);
});

router.post('/:id/loeschen', async (req, res) => {
  await pool.query('DELETE FROM nebenkostenabrechnungen WHERE id = $1', [req.params.id]);
  res.redirect('/nebenkosten');
});

router.get('/:id/anschreiben', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT n.*, w.name AS wohnung_name, w.adresse AS wohnung_adresse,
           m.name AS mieter_name, m.adresse AS mieter_adresse
    FROM nebenkostenabrechnungen n
    JOIN wohnungen w ON w.id = n.wohnung_id
    JOIN mieter m ON m.id = n.mieter_id
    WHERE n.id = $1
  `, [req.params.id]);
  if (rows.length === 0) return res.status(404).send('Abrechnung nicht gefunden');
  const abrechnung = rows[0];
  const einstellungenRes = await pool.query('SELECT * FROM einstellungen WHERE id = 1');
  const einstellungen = einstellungenRes.rows[0] || {};

  const differenz = Number(abrechnung.vorauszahlung_gesamt) - Number(abrechnung.tatsaechliche_kosten);

  res.render('nebenkosten/anschreiben', {
    title: 'Anschreiben',
    active: 'nebenkosten',
    abrechnung,
    einstellungen,
    differenz,
    heute: new Date(),
  });
});

export default router;
