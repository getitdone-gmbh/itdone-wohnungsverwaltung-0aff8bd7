import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT w.*,
      (SELECT m.name FROM mietvertraege mv
        JOIN mieter m ON m.id = mv.mieter_id
        WHERE mv.wohnung_id = w.id AND (mv.ende IS NULL OR mv.ende >= CURRENT_DATE)
        ORDER BY mv.beginn DESC LIMIT 1) AS aktueller_mieter
    FROM wohnungen w
    ORDER BY w.name
  `);
  res.render('wohnungen/index', { title: 'Wohnungen', active: 'wohnungen', wohnungen: rows });
});

router.post('/', async (req, res) => {
  const { name, adresse, groesse_qm } = req.body;
  if (!name || !adresse) return res.redirect('/wohnungen');
  await pool.query(
    'INSERT INTO wohnungen (name, adresse, groesse_qm) VALUES ($1, $2, $3)',
    [name, adresse, groesse_qm || null]
  );
  res.redirect('/wohnungen');
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const wohnungRes = await pool.query('SELECT * FROM wohnungen WHERE id = $1', [id]);
  if (wohnungRes.rows.length === 0) return res.status(404).send('Wohnung nicht gefunden');
  const wohnung = wohnungRes.rows[0];

  const mietvertraegeRes = await pool.query(`
    SELECT mv.*, m.name AS mieter_name, m.email AS mieter_email
    FROM mietvertraege mv
    JOIN mieter m ON m.id = mv.mieter_id
    WHERE mv.wohnung_id = $1
    ORDER BY mv.beginn DESC
  `, [id]);

  const mietvertragIds = mietvertraegeRes.rows.map((m) => m.id);
  let aenderungenByVertrag = {};
  if (mietvertragIds.length > 0) {
    const aenderungenRes = await pool.query(
      'SELECT * FROM vertragsaenderungen WHERE mietvertrag_id = ANY($1) ORDER BY datum DESC',
      [mietvertragIds]
    );
    for (const a of aenderungenRes.rows) {
      if (!aenderungenByVertrag[a.mietvertrag_id]) aenderungenByVertrag[a.mietvertrag_id] = [];
      aenderungenByVertrag[a.mietvertrag_id].push(a);
    }
  }

  const mieterRes = await pool.query('SELECT id, name FROM mieter ORDER BY name');
  const dokumenteRes = await pool.query(
    'SELECT id, kategorie, jahr, dateiname, hochgeladen_am FROM dokumente WHERE wohnung_id = $1 ORDER BY hochgeladen_am DESC',
    [id]
  );
  const jahreRes = await pool.query(
    'SELECT DISTINCT jahr FROM finanzeintraege WHERE wohnung_id = $1 ORDER BY jahr DESC',
    [id]
  );

  res.render('wohnungen/show', {
    title: wohnung.name,
    active: 'wohnungen',
    wohnung,
    mietvertraege: mietvertraegeRes.rows,
    aenderungenByVertrag,
    mieterListe: mieterRes.rows,
    dokumente: dokumenteRes.rows,
    jahre: jahreRes.rows.map((r) => r.jahr),
  });
});

router.post('/:id/loeschen', async (req, res) => {
  await pool.query('DELETE FROM wohnungen WHERE id = $1', [req.params.id]);
  res.redirect('/wohnungen');
});

router.post('/:id/mietvertraege', async (req, res) => {
  const { id } = req.params;
  const { mieter_id, beginn, ende, kaltmiete, nebenkosten_vorauszahlung, kaution, notizen } = req.body;
  if (!mieter_id || !beginn) return res.redirect(`/wohnungen/${id}`);
  await pool.query(
    `INSERT INTO mietvertraege (wohnung_id, mieter_id, beginn, ende, kaltmiete, nebenkosten_vorauszahlung, kaution, notizen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, mieter_id, beginn, ende || null, kaltmiete || 0, nebenkosten_vorauszahlung || 0, kaution || null, notizen || null]
  );
  res.redirect(`/wohnungen/${id}`);
});

export default router;
