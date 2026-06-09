-- Ausführen mit: psql $DATABASE_URL -f database/performance_indexes_migration.sql
-- Fügt fehlende Indizes auf häufig abgefragten Spalten hinzu.

-- members.email wird bei Login und Mitglieder-Suche abgefragt
CREATE INDEX IF NOT EXISTS idx_members_email  ON members(email);

-- members.status wird bei Filterung (prospect, active, passive, resigned) verwendet
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);

-- events.publication_status wird bei öffentlichen Event-Abfragen gefiltert
CREATE INDEX IF NOT EXISTS idx_events_publication_status ON events(publication_status);

-- posts.publication_status wird bei öffentlichen Post-Abfragen gefiltert
CREATE INDEX IF NOT EXISTS idx_posts_publication_status ON posts(publication_status);
