-- Add missing columns to the racers table
ALTER TABLE racers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE racers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE racers ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT false;
ALTER TABLE racers ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

-- Update the RPC function to handle email and phone (if not already done)
CREATE OR REPLACE FUNCTION register_racer_with_members(
    p_racer_id TEXT,
    p_bib INTEGER,
    p_category TEXT,
    p_distance TEXT,
    p_is_series INTEGER,
    p_members JSONB,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
BEGIN
    -- 1. Beszúrjuk a versenyzőt az elérhetőségekkel együtt
    INSERT INTO racers (id, bib, category, distance, is_series, status, email, phone)
    VALUES (p_racer_id, p_bib, p_category, p_distance, p_is_series, 'registered', p_email, p_phone);

    -- 2. Beszúrjuk a tagokat a JSONB tömbből
    IF p_members IS NOT NULL AND jsonb_array_length(p_members) > 0 THEN
        INSERT INTO members (racer_id, name, birth_date, otproba_id)
        SELECT p_racer_id, 
               (m->>'name')::TEXT, 
               (m->>'birth_date')::TEXT, 
               (m->>'otproba_id')::TEXT
        FROM jsonb_array_elements(p_members) AS m;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', p_racer_id, 'bib', p_bib);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Hiba a regisztráció során: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
