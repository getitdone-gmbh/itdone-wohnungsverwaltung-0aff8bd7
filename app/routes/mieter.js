import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT m.*,
      (SELECT w.name FROM mietvertraege mv
        JOIN wohnungen w ON w.id = mv.wohnung_id
        WHERE mv.mieter_id = m.id AND (mv.ende IS NULL OR mv.ende >= CURRENT_DATE)
        ORDER BY mv.beginn DESC LIMIT 1) AS aktuelle_wohnung
    FROM mieter m
    ORDER BY m.name
  `);
  res.render('mieter/index', { title: 'Mieter', active: 'mieter', mieter: rows });
});

router.post('/', async (req, res) => {
  const { name, email, telefon, adresse } = req.body;
  if (!name) return res.redirect('/mieter');
  await pool.query(
    'INSERT INTO mieter (name, email, telefon, adresse) VALUES ($1, $2, $3, $4)',
    [name, email || null, telefon || null, adresse || null]
  );
  res.redirect('/mieter');
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const mieterRes = await pool.query('SELECT * FROM mieter WHERE id = $1', [id]);
  if (mieterRes.rows.length === 0) return res.status(404).send('Mieter nicht gefunden');
  const mieter = mieterRes.rows[0];

  const mietvertraegeRes = await pool.query(`
    SELECT mv.*, w.name AS wohnung_name
    FROM mietvertraege mv
    JOIN wohnungen w ON w.id = mv.wohnung_id
    WHERE mv.mieter_id = $1
    ORDER BY mv.beginn DESC
  `, [id]);

  const dokumenteRes = await pool.query(
    'SELECT id, kategorie, jahr, dateiname, hochgeladen_am FROM dokumente WHERE mieter_id = $1 ORDER BY hochgeladen_am DESC',
    [id]
  );

  res.render('mieter/show', {
    title: mieter.name,
    active: 'mieter',
    mieter,
    mietvertraege: mietvertraegeRes.rows,
    dokumente: dokumenteRes.rows,
  });
});

router.post('/:id/bearbeiten', async (req, res) => {
  const { id } = req.params;
  const { name, email, telefon, adresse } = req.body;
  await pool.query(
    'UPDATE mieter SET name = $1, email = $2, telefon = $3, adresse = $4 WHERE id = $5',
    [name, email || null, telefon || null, adresse || null, id]
  );
  res.redirect(`/mieter/${id}`);
});

router.post('/:id/loeschen', async (req, res) => {
  await pool.query('DELETE FROM mieter WHERE id = $1', [req.params.id]);
  res.redirect('/mieter');
});

export default router;
