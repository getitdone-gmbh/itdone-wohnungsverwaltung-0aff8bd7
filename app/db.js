import pg from 'pg';

const { Pool } = pg;

const connectionString = (process.env.DATABASE_URL || '').replace('sslmode=require', 'sslmode=no-verify');

export const pool = new Pool({ connectionString });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wohnungen (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      adresse TEXT NOT NULL,
      groesse_qm NUMERIC,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS mieter (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      telefon TEXT,
      adresse TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS mietvertraege (
      id SERIAL PRIMARY KEY,
      wohnung_id INTEGER REFERENCES wohnungen(id) ON DELETE CASCADE,
      mieter_id INTEGER REFERENCES mieter(id) ON DELETE CASCADE,
      beginn DATE NOT NULL,
      ende DATE,
      kaltmiete NUMERIC NOT NULL DEFAULT 0,
      nebenkosten_vorauszahlung NUMERIC NOT NULL DEFAULT 0,
      kaution NUMERIC,
      notizen TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS vertragsaenderungen (
      id SERIAL PRIMARY KEY,
      mietvertrag_id INTEGER REFERENCES mietvertraege(id) ON DELETE CASCADE,
      datum DATE NOT NULL,
      neue_kaltmiete NUMERIC,
      neue_nebenkosten NUMERIC,
      beschreibung TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS dokumente (
      id SERIAL PRIMARY KEY,
      wohnung_id INTEGER REFERENCES wohnungen(id) ON DELETE SET NULL,
      mieter_id INTEGER REFERENCES mieter(id) ON DELETE SET NULL,
      kategorie TEXT NOT NULL,
      jahr INTEGER,
      dateiname TEXT NOT NULL,
      mimetyp TEXT NOT NULL,
      groesse INTEGER,
      inhalt BYTEA NOT NULL,
      hochgeladen_am TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS finanzeintraege (
      id SERIAL PRIMARY KEY,
      wohnung_id INTEGER REFERENCES wohnungen(id) ON DELETE CASCADE,
      jahr INTEGER NOT NULL,
      art TEXT NOT NULL,
      kategorie TEXT NOT NULL,
      betrag NUMERIC NOT NULL,
      datum DATE,
      beschreibung TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS nebenkostenabrechnungen (
      id SERIAL PRIMARY KEY,
      wohnung_id INTEGER REFERENCES wohnungen(id) ON DELETE CASCADE,
      mieter_id INTEGER REFERENCES mieter(id) ON DELETE CASCADE,
      jahr INTEGER NOT NULL,
      zeitraum_von DATE,
      zeitraum_bis DATE,
      vorauszahlung_gesamt NUMERIC NOT NULL DEFAULT 0,
      tatsaechliche_kosten NUMERIC NOT NULL DEFAULT 0,
      erstellt_am TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS einstellungen (
      id INTEGER PRIMARY KEY DEFAULT 1,
      vermieter_name TEXT,
      vermieter_adresse TEXT,
      bankverbindung TEXT
    );
    INSERT INTO einstellungen (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `);
}
