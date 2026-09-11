-- ==========================================================
-- DragonWave 2026 - RLS Biztonsági Házirend Javító Migráció
-- ==========================================================
-- Megszünteti a teljesen nyitott "Public Access FOR ALL" szabályt,
-- így a nyilvános API-n keresztül illetéktelenek nem tudnak adatot törölni vagy módosítani.

-- 1. Régi nyitott szabályok visszavonása
DROP POLICY IF EXISTS "Public Access" ON racers;
DROP POLICY IF EXISTS "Public Access" ON members;
DROP POLICY IF EXISTS "Public Access" ON categories;
DROP POLICY IF EXISTS "Public Access" ON checkpoints;

DROP POLICY IF EXISTS "Public Read Access" ON racers;
DROP POLICY IF EXISTS "Public Read Access" ON members;
DROP POLICY IF EXISTS "Public Read Access" ON categories;
DROP POLICY IF EXISTS "Public Read Access" ON checkpoints;

DROP POLICY IF EXISTS "Service Role Full Access" ON racers;
DROP POLICY IF EXISTS "Service Role Full Access" ON members;
DROP POLICY IF EXISTS "Service Role Full Access" ON categories;
DROP POLICY IF EXISTS "Service Role Full Access" ON checkpoints;

-- 2. RLS bekapcsolása minden táblára
ALTER TABLE racers ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;

-- 3. Nyilvános olvasási jogosultság (Anonim látogatók CSAK olvasni tudnak)
CREATE POLICY "Public Read Access" ON racers FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON members FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON categories FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON checkpoints FOR SELECT USING (true);

-- 4. Teljes körű jogosultság a szerveroldali háttérfolyamatoknak (service_role)
CREATE POLICY "Service Role Full Access" ON racers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access" ON members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access" ON categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access" ON checkpoints FOR ALL TO service_role USING (true) WITH CHECK (true);
