import express from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { DOKUMENT_KATEGORIEN } from '../helpers.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const { wohnung_id, mieter_id, kategorie, jahr } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;
  if (wohnung_id) { conditions.push(`d.wohnung_id = $${i++}`); values.push(wohnung_id); }
  if (mieter_id) { conditions.push(`d.mieter_id = $${i++}`); values.push(mieter_id); }
  if (kategorie) { conditions.push(`d.kategorie = $${i++}`); values.push(kategorie); }
  if (jahr) { conditions.push(`d.jahr = $${i++}`); values.push(jahr); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const dokumenteRes = await pool.query(`
    SELECT d.id, d.kategorie, d.jahr, d.dateiname, d.groesse, d.hochgeladen_am,
           w.name AS wohnung_name, m.name AS mieter_name
    FROM dokumente d
    LEFT JOIN wohnungen w ON w.id = d.wohnung_id
    LEFT JOIN mieter m ON m.id = d.mieter_id
    ${where}
    ORDER BY d.hochgeladen_am DESC
  `, values);

  const wohnungenRes = await pool.query('SELECT id, name FROM wohnungen ORDER BY name');
  const mieterRes = await pool.query('SELECT id, name FROM mieter ORDER BY name');

  res.render('dokumente/index', {
    title: 'Dokumente',
    active: 'dokumente',
    dokumente: dokumenteRes.rows,
    wohnungen: wohnungenRes.rows,
    mieterListe: mieterRes.rows,
    kategorien: DOKUMENT_KATEGORIEN,
    filter: { wohnung_id, mieter_id, kategorie, jahr },
  });
});

router.post('/', upload.single('datei'), async (req, res) => {
  const { wohnung_id, mieter_id, kategorie, jahr } = req.body;
  if (!req.file || !kategorie) return res.redirect('/dokumente');
  await pool.query(
    `INSERT INTO dokumente (wohnung_id, mieter_id, kategorie, jahr, dateiname, mimetyp, groesse, inhalt)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      wohnung_id || null,
      mieter_id || null,
      kategorie,
      jahr || null,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.file.buffer,
    ]
  );
  res.redirect('/dokumente');
});

router.get('/:id/datei', async (req, res) => {
  const { rows } = await pool.query('SELECT dateiname, mimetyp, inhalt FROM dokumente WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).send('Dokument nicht gefunden');
  const doc = rows[0];
  res.set('Content-Type', doc.mimetyp || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(doc.dateiname)}"`);
  res.send(doc.inhalt);
});

router.post('/:id/loeschen', async (req, res) => {
  await pool.query('DELETE FROM dokumente WHERE id = $1', [req.params.id]);
  res.redirect('/dokumente');
});

export default router;
