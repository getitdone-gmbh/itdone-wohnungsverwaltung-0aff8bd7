import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM einstellungen WHERE id = 1');
  res.render('einstellungen/index', {
    title: 'Einstellungen',
    active: 'einstellungen',
    einstellungen: rows[0] || {},
    gespeichert: req.query.gespeichert,
  });
});

router.post('/', async (req, res) => {
  const { vermieter_name, vermieter_adresse, bankverbindung } = req.body;
  await pool.query(
    `UPDATE einstellungen SET vermieter_name = $1, vermieter_adresse = $2, bankverbindung = $3 WHERE id = 1`,
    [vermieter_name || null, vermieter_adresse || null, bankverbindung || null]
  );
  res.redirect('/einstellungen?gespeichert=1');
});

export default router;
