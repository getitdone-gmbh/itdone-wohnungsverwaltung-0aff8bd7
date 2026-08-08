import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

router.post('/:id/aenderungen', async (req, res) => {
  const { id } = req.params;
  const { wohnung_id, datum, neue_kaltmiete, neue_nebenkosten, beschreibung } = req.body;
  if (!datum) return res.redirect(`/wohnungen/${wohnung_id}`);
  await pool.query(
    `INSERT INTO vertragsaenderungen (mietvertrag_id, datum, neue_kaltmiete, neue_nebenkosten, beschreibung)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, datum, neue_kaltmiete || null, neue_nebenkosten || null, beschreibung || null]
  );
  if (neue_kaltmiete || neue_nebenkosten) {
    const updates = [];
    const values = [];
    let i = 1;
    if (neue_kaltmiete) { updates.push(`kaltmiete = $${i++}`); values.push(neue_kaltmiete); }
    if (neue_nebenkosten) { updates.push(`nebenkosten_vorauszahlung = $${i++}`); values.push(neue_nebenkosten); }
    values.push(id);
    await pool.query(`UPDATE mietvertraege SET ${updates.join(', ')} WHERE id = $${i}`, values);
  }
  res.redirect(`/wohnungen/${wohnung_id}`);
});

router.post('/:id/loeschen', async (req, res) => {
  const { id } = req.params;
  const { wohnung_id } = req.body;
  await pool.query('DELETE FROM mietvertraege WHERE id = $1', [id]);
  res.redirect(`/wohnungen/${wohnung_id}`);
});

export default router;
