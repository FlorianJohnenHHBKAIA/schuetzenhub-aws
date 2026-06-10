-- ============================================================
-- BHDS-Auszeichnungen Migration
-- Erweitert award_types und member_awards um BHDS-Standardauszeichnungen
-- ============================================================

-- award_types: Neue Felder
ALTER TABLE award_types ADD COLUMN IF NOT EXISTS is_bhds_standard BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE award_types ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'custom';
  -- Gültige Werte: 'orden' | 'ehrenzeichen' | 'vereinsauszeichnung' | 'custom'
ALTER TABLE award_types ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE award_types ADD COLUMN IF NOT EXISTS special_notes TEXT;
ALTER TABLE award_types ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 99;

-- member_awards: Neue Felder
ALTER TABLE member_awards ADD COLUMN IF NOT EXISTS awarded_by TEXT;
ALTER TABLE member_awards ADD COLUMN IF NOT EXISTS certificate_url TEXT;
ALTER TABLE member_awards ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- Seed-Funktion für BHDS-Standardauszeichnungen
-- Wird für jeden Verein einmalig aufgerufen
-- ============================================================

CREATE OR REPLACE FUNCTION seed_bhds_awards_for_club(p_club_id UUID) RETURNS void AS $$
BEGIN
  -- Nur einfügen wenn noch keine BHDS-Standards für diesen Verein existieren
  IF NOT EXISTS (
    SELECT 1 FROM award_types WHERE club_id = p_club_id AND is_bhds_standard = true LIMIT 1
  ) THEN
    INSERT INTO award_types (
      id, club_id, name, description, icon, badge_color,
      scope_type, is_active, is_bhds_standard, category,
      requirements, special_notes, sort_order
    ) VALUES
      -- 1. Silbernes Verdienstkreuz (SVK)
      (
        gen_random_uuid(), p_club_id,
        'Silbernes Verdienstkreuz (SVK)',
        'Offizielle BHDS-Auszeichnung für besondere Verdienste im Sinne des Leitmotivs des BHDS.',
        'medal', 'silver', 'club', true, true, 'orden',
        'Mindestens 5 Jahre Verdienste im Sinne des Leitmotivs des BHDS.',
        NULL, 1
      ),
      -- 2. Hoher Bruderschaftsorden (HBO)
      (
        gen_random_uuid(), p_club_id,
        'Hoher Bruderschaftsorden (HBO)',
        'Offizielle BHDS-Auszeichnung für langjährige Verdienste im Sinne des Leitmotivs des BHDS.',
        'medal', 'gold', 'club', true, true, 'orden',
        'Mindestens 10 Jahre Verdienste im Sinne des Leitmotivs des BHDS.',
        NULL, 2
      ),
      -- 3. St.-Sebastianus-Ehrenkreuz (SEK)
      (
        gen_random_uuid(), p_club_id,
        'St.-Sebastianus-Ehrenkreuz (SEK)',
        'Offizielle BHDS-Auszeichnung für besonders langjährige Verdienste.',
        'order', 'gold', 'club', true, true, 'orden',
        'Mindestens 15 Jahre Verdienste im Sinne des Leitmotivs des BHDS.',
        NULL, 3
      ),
      -- 4. Schulterband zum St.-Sebastianus-Ehrenkreuz
      (
        gen_random_uuid(), p_club_id,
        'Schulterband zum St.-Sebastianus-Ehrenkreuz (SEK)',
        'Erweiterung des St.-Sebastianus-Ehrenkreuzes für herausragende Verdienste, in der Regel auch im Vorstand einer Bruderschaft.',
        'order', 'gold', 'club', true, true, 'orden',
        'Mindestens 20 Jahre Verdienste; in der Regel auch im Vorstand einer Bruderschaft.',
        NULL, 4
      ),
      -- 5. Goldener Stern zum St.-Sebastianus-Ehrenkreuz
      (
        gen_random_uuid(), p_club_id,
        'Goldener Stern zum St.-Sebastianus-Ehrenkreuz (SEK)',
        'Hohe BHDS-Auszeichnung, in der Regel auch für Mitglieder des Bezirksvorstands.',
        'star', 'gold', 'club', true, true, 'orden',
        'Mindestens 25 Jahre Verdienste; in der Regel auch im Bezirksvorstand.',
        NULL, 5
      ),
      -- 6. Großer Stern zum St.-Sebastianus-Ehrenkreuz
      (
        gen_random_uuid(), p_club_id,
        'Großer Stern zum St.-Sebastianus-Ehrenkreuz (SEK)',
        'Sehr hohe BHDS-Auszeichnung für Mitglieder des Diözesanvorstands oder auf Ebene des BHDS.',
        'star', 'gold', 'club', true, true, 'orden',
        'Mindestens 30 Jahre Verdienste; in der Regel auch im Diözesanvorstand oder auf Ebene des BHDS.',
        'Anzahl der Träger auf 28 beschränkt. Zustimmung durch Zweidrittelmehrheit des Präsidiums erforderlich.',
        6
      ),
      -- 7. Großkreuz zum St.-Sebastianus-Ehrenkreuz
      (
        gen_random_uuid(), p_club_id,
        'Großkreuz zum St.-Sebastianus-Ehrenkreuz (SEK)',
        'Höchste BHDS-Ordensauszeichnung, in der Regel auf Ebene des BHDS. Dem Hochmeister wird diese Auszeichnung von Amts wegen verliehen.',
        'crown', 'gold', 'club', true, true, 'orden',
        'Mindestens 30 Jahre Verdienste; in der Regel auch auf Ebene des BHDS.',
        'Anzahl der Träger auf 7 beschränkt. Zustimmung durch Vierfünftelmehrheit des Präsidiums erforderlich. Dem Hochmeister wird diese Auszeichnung von Amts wegen verliehen.',
        7
      ),
      -- 8. Fürst Salm-Reifferscheid-Gedenkmedaille
      (
        gen_random_uuid(), p_club_id,
        'Fürst Salm-Reifferscheid-Gedenkmedaille',
        'Offizielle BHDS-Ehrenzeichen-Auszeichnung.',
        'medal', 'silver', 'club', true, true, 'ehrenzeichen',
        NULL, NULL, 8
      ),
      -- 9. Dr. Peter Louis-Gedenkmedaille
      (
        gen_random_uuid(), p_club_id,
        'Dr. Peter Louis-Gedenkmedaille',
        'Offizielle BHDS-Ehrenzeichen-Auszeichnung.',
        'medal', 'silver', 'club', true, true, 'ehrenzeichen',
        NULL, NULL, 9
      ),
      -- 10. Christoph Bernhard Graf von Galen-Gedenkmedaille
      (
        gen_random_uuid(), p_club_id,
        'Christoph Bernhard Graf von Galen-Gedenkmedaille',
        'Offizielle BHDS-Ehrenzeichen-Auszeichnung.',
        'medal', 'silver', 'club', true, true, 'ehrenzeichen',
        NULL, NULL, 10
      ),
      -- 11. Hochmeisterplakette
      (
        gen_random_uuid(), p_club_id,
        'Hochmeisterplakette',
        'Vereinsauszeichnung des BHDS. Wird an Schützenbruderschaften für besonders caritative Aufgaben verliehen. Berücksichtigt Einzel- und Langzeitprojekte. Beschluss durch das Präsidium nach vorheriger Sitzung des Ausschusses für caritative Aufgaben.',
        'shield', 'gold', 'club', true, true, 'vereinsauszeichnung',
        NULL,
        'Beschluss durch das Präsidium nach vorheriger Sitzung des Ausschusses für caritative Aufgaben.',
        11
      );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Alle bestehenden Vereine einmalig mit BHDS-Auszeichnungen befüllen
SELECT seed_bhds_awards_for_club(id) FROM clubs WHERE deleted_at IS NULL;
