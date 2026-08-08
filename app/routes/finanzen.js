import express from 'express';
import { pool } from '../db.js';
import { KATEGORIEN_KOSTEN, KATEGORIEN_ERTRAG, currentYear, money } from '../helpers.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { wohnung_id, jahr } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;
  if (wohnung_id) { conditions.push(`f.wohnung_id = $${i++}`); values.push(wohnung_id); }
  if (jahr) { conditions.push(`f.jahr = $${i++}`); values.push(jahr); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const eintraegeRes = await pool.query(`
    SELECT f.*, w.name AS wohnung_name
    FROM finanzeintraege f
    JOIN wohnungen w ON w.id = f.wohnung_id
    ${where}
    ORDER BY f.jahr DESC, f.datum DESC NULLS LAST, f.id DESC
  `, values);

  const wohnungenRes = await pool.query('SELECT id, name FROM wohnungen ORDER BY name');
  const jahreRes = await pool.query('SELECT DISTINCT jahr FROM finanzeintraege ORDER BY jahr DESC');

  res.render('finanzen/index', {
    title: 'Kosten & Erträge',
    active: 'finanzen',
    eintraege: eintraegeRes.rows,
    wohnungen: wohnungenRes.rows,
    jahre: jahreRes.rows.map((r) => r.jahr),
    filter: { wohnung_id, jahr },
    kategorienKosten: KATEGORIEN_KOSTEN,
    kategorienErtrag: KATEGORIEN_ERTRAG,
    thisYear: currentYear(),
  });
});

router.post('/', async (req, res) => {
  const { wohnung_id, jahr, art, kategorie, betrag, datum, beschreibung } = req.body;
  if (!wohnung_id || !jahr || !art || !kategorie || !betrag) return res.redirect('/finanzen');
  await pool.query(
    `INSERT INTO finanzeintraege (wohnung_id, jahr, art, kategorie, betrag, datum, beschreibung)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [wohnung_id, jahr, art, kategorie, betrag, datum || null, beschreibung || null]
  );
  res.redirect('/finanzen');
});

router.post('/:id/loeschen', async (req, res) => {
  await pool.query('DELETE FROM finanzeintraege WHERE id = $1', [req.params.id]);
  res.redirect('/finanzen');
});

router.get('/report', async (req, res) => {
  const jahr = req.query.jahr || currentYear();
  const wohnung_id = req.query.wohnung_id || '';

  const wohnungenRes = await pool.query('SELECT id, name, adresse FROM wohnungen ORDER BY name');
  const jahreRes = await pool.query('SELECT DISTINCT jahr FROM finanzeintraege ORDER BY jahr DESC');
  const jahre = jahreRes.rows.map((r) => r.jahr);
  if (!jahre.includes(Number(jahr))) jahre.unshift(Number(jahr));

  if (wohnung_id) {
    const wohnung = wohnungenRes.rows.find((w) => String(w.id) === String(wohnung_id));
    const rowsRes = await pool.query(
      `SELECT art, kategorie, SUM(betrag) AS summe
       FROM finanzeintraege WHERE wohnung_id = $1 AND jahr = $2
       GROUP BY art, kategorie ORDER BY art, kategorie`,
      [wohnung_id, jahr]
    );
    const kosten = rowsRes.rows.filter((r) => r.art === 'kosten');
    const ertraege = rowsRes.rows.filter((r) => r.art === 'ertrag');
    const summeKosten = kosten.reduce((s, r) => s + Number(r.summe), 0);
    const summeErtraege = ertraege.reduce((s, r) => s + Number(r.summe), 0);

    return res.render('finanzen/report', {
      title: 'Steuer-Report',
      active: 'finanzen',
      modus: 'einzeln',
      wohnung,
      wohnungen: wohnungenRes.rows,
      jahr: Number(jahr),
      jahre,
      kosten,
      ertraege,
      summeKosten,
      summeErtraege,
      ergebnis: summeErtraege - summeKosten,
    });
  }

  const gesamtRes = await pool.query(`
    SELECT w.id, w.name,
      COALESCE(SUM(CASE WHEN f.art = 'ertrag' THEN f.betrag ELSE 0 END), 0) AS ertraege,
      COALESCE(SUM(CASE WHEN f.art = 'kosten' THEN f.betrag ELSE 0 END), 0) AS kosten
    FROM wohnungen w
    LEFT JOIN finanzeintraege f ON f.wohnung_id = w.id AND f.jahr = $1
    GROUP BY w.id, w.name
    ORDER BY w.name
  `, [jahr]);

  const zeilen = gesamtRes.rows.map((r) => ({
    ...r,
    ergebnis: Number(r.ertraege) - Number(r.kosten),
  }));
  const gesamtErtraege = zeilen.reduce((s, r) => s + Number(r.ertraege), 0);
  const gesamtKosten = zeilen.reduce((s, r) => s + Number(r.kosten), 0);

  res.render('finanzen/report', {
    title: 'Steuer-Report',
    active: 'finanzen',
    modus: 'alle',
    wohnungen: wohnungenRes.rows,
    jahr: Number(jahr),
    jahre,
    zeilen,
    gesamtErtraege,
    gesamtKosten,
    gesamtErgebnis: gesamtErtraege - gesamtKosten,
  });
});

router.get('/report.csv', async (req, res) => {
  const jahr = req.query.jahr || currentYear();
  const wohnung_id = req.query.wohnung_id || '';
  const conditions = ['jahr = $1'];
  const values = [jahr];
  if (wohnung_id) { conditions.push('wohnung_id = $2'); values.push(wohnung_id); }

  const rowsRes = await pool.query(`
    SELECT f.datum, w.name AS wohnung, f.art, f.kategorie, f.betrag, f.beschreibung
    FROM finanzeintraege f
    JOIN wohnungen w ON w.id = f.wohnung_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY w.name, f.art, f.datum
  `, values);

  const header = ['Datum', 'Wohnung', 'Art', 'Kategorie', 'Betrag', 'Beschreibung'];
  const lines = [header.join(';')];
  for (const r of rowsRes.rows) {
    const datum = r.datum ? new Date(r.datum).toLocaleDateString('de-DE') : '';
    const art = r.art === 'kosten' ? 'Kosten' : 'Ertrag';
    const betrag = Number(r.betrag).toFixed(2).replace('.', ',');
    lines.push([datum, r.wohnung, art, r.kategorie, betrag, (r.beschreibung || '').replace(/;/g, ',')].join(';'));
  }
  const csv = '\uFEFF' + lines.join('\r\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="steuerreport_${jahr}${wohnung_id ? '_wohnung' + wohnung_id : ''}.csv"`);
  res.send(csv);
});

export default router;
