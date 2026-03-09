-- SchutzenConnect Datenbankschema
-- Fuer lokales PostgreSQL und AWS RDS/Aurora kompatibel

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- AUTH (eigene Tabelle - ersetzt Supabase Auth)
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$ BEGIN CREATE TYPE member_status AS ENUM ('prospect', 'active', 'passive', 'resigned'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE app_role AS ENUM ('admin', 'member'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE role_level AS ENUM ('club', 'company'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE event_category AS ENUM ('training', 'meeting', 'fest', 'work', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE event_audience AS ENUM ('company_only', 'club_internal', 'public'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE work_shift_status AS ENUM ('signed_up', 'cancelled', 'completed', 'no_show'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE document_visibility AS ENUM ('internal', 'restricted'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE protocol_status AS ENUM ('draft', 'submitted', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE post_category AS ENUM ('announcement', 'info', 'event', 'warning', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- CLUBS
-- ============================================================

CREATE TABLE IF NOT EXISTS clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    city TEXT,
    description TEXT,
    founded_year INTEGER,
    website TEXT,
    logo_path TEXT,
    hero_image_path TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    plan_started_at TIMESTAMPTZ,
    custom_domain TEXT UNIQUE,
    domain_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    cover_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_club_id ON companies(club_id);

-- ============================================================
-- MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    street TEXT,
    zip TEXT,
    city TEXT,
    status member_status NOT NULL DEFAULT 'prospect',
    avatar_url TEXT,
    birthday DATE,
    member_since DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(club_id, email)
);

CREATE INDEX IF NOT EXISTS idx_members_club_id ON members(club_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);

-- ============================================================
-- USER ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, club_id)
);

-- ============================================================
-- ROLES AND PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level role_level NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS member_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    scope_type TEXT DEFAULT 'club',
    scope_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(member_id, role_id, scope_type, scope_id)
);

-- ============================================================
-- MEMBER COMPANY MEMBERSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS member_company_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_single_active_company
ON member_company_memberships (member_id)
WHERE valid_to IS NULL;

-- ============================================================
-- APPOINTMENTS AND DELEGATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scope_type TEXT DEFAULT 'club',
    scope_id UUID,
    valid_from DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    from_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    to_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    valid_from DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    category event_category NOT NULL DEFAULT 'other',
    owner_type TEXT NOT NULL DEFAULT 'club',
    owner_id UUID NOT NULL,
    audience event_audience NOT NULL DEFAULT 'club_internal',
    publication_status TEXT NOT NULL DEFAULT 'draft',
    created_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    updated_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    approved_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    rejection_reason TEXT,
    responsible_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_club_id ON events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);

-- ============================================================
-- WORK SHIFTS
-- ============================================================

CREATE TABLE IF NOT EXISTS work_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    required_slots INTEGER NOT NULL DEFAULT 1,
    owner_type TEXT NOT NULL DEFAULT 'club',
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_shift_id UUID NOT NULL REFERENCES work_shifts(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    status work_shift_status NOT NULL DEFAULT 'signed_up',
    hours_worked NUMERIC(5,2),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(work_shift_id, member_id)
);

-- ============================================================
-- POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT,
    category post_category NOT NULL DEFAULT 'other',
    owner_type TEXT NOT NULL DEFAULT 'club',
    owner_id UUID NOT NULL,
    audience TEXT NOT NULL DEFAULT 'club_internal',
    publication_status TEXT NOT NULL DEFAULT 'draft',
    cover_image_path TEXT,
    created_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    approved_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_club_id ON posts(club_id);

CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    reaction TEXT NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(post_id, member_id, reaction)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    related_entity_type TEXT,
    related_entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_member_id, is_read) WHERE is_read = false;

CREATE TABLE IF NOT EXISTS member_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE UNIQUE,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    push_notifications BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- GALLERY
-- ============================================================

CREATE TABLE IF NOT EXISTS gallery_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    title TEXT,
    description TEXT,
    uploaded_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_gallery_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    gallery_image_id UUID NOT NULL REFERENCES gallery_images(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(member_id, gallery_image_id)
);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    parent_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    scope_type TEXT NOT NULL DEFAULT 'club',
    scope_id UUID NOT NULL,
    visibility document_visibility NOT NULL DEFAULT 'internal',
    uploaded_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    is_current_version BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROTOCOLS
-- ============================================================

CREATE TABLE IF NOT EXISTS protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status protocol_status NOT NULL DEFAULT 'draft',
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AWARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS award_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    scope_type TEXT NOT NULL DEFAULT 'club',
    scope_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS award_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    award_type_id UUID NOT NULL REFERENCES award_types(id) ON DELETE CASCADE,
    condition_type TEXT NOT NULL,
    condition_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    award_type_id UUID REFERENCES award_types(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    award_type TEXT,
    awarded_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    approved_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MAGAZINES
-- ============================================================

CREATE TABLE IF NOT EXISTS magazines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS magazine_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    magazine_id UUID NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS magazine_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES magazine_sections(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    website TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS magazine_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    magazine_id UUID NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
    sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
    size TEXT NOT NULL DEFAULT 'quarter',
    status TEXT NOT NULL DEFAULT 'pending',
    file_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CLUBS REGISTRATION VIEW
-- ============================================================

CREATE OR REPLACE VIEW clubs_registration AS
SELECT id, name, slug FROM clubs;

-- ============================================================
-- TRIGGER: updated_at automatisch setzen
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER trg_clubs_updated_at BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION set_updated_at(); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- STANDARD-BERECHTIGUNGEN
-- ============================================================

INSERT INTO permissions (key, description) VALUES
  ('club.admin.full',                        'Vollstaendiger Admin-Zugriff'),
  ('club.members.manage',                    'Mitglieder verwalten'),
  ('club.companies.manage',                  'Kompanien verwalten'),
  ('club.events.manage',                     'Termine verwalten'),
  ('club.events.approve_publication',        'Termine zur Veroeffentlichung freigeben'),
  ('club.posts.manage',                      'Beitraege verwalten'),
  ('club.posts.approve_publication',         'Beitraege zur Veroeffentlichung freigeben'),
  ('club.gallery.manage',                    'Galerie verwalten'),
  ('club.documents.manage',                  'Dokumente verwalten'),
  ('club.roles.manage',                      'Rollen und Rechte verwalten'),
  ('club.settings.manage',                   'Vereinseinstellungen verwalten'),
  ('club.appointments.manage',               'Aemter und Funktionen verwalten'),
  ('club.magazine.manage',                   'Schuetzenheft verwalten'),
  ('club.magazine.ads.manage',               'Schuetzenheft-Anzeigen verwalten'),
  ('club.work_shifts.manage',                'Arbeitsdienste verwalten'),
  ('company.events.manage',                  'Kompanie-Termine verwalten'),
  ('company.events.share_internal',          'Kompanie-Termine intern teilen'),
  ('company.events.submit_publication',      'Kompanie-Termine zur Veroeffentlichung einreichen'),
  ('company.posts.manage',                   'Kompanie-Beitraege verwalten'),
  ('company.work_shifts.manage',             'Kompanie-Arbeitsdienste verwalten')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS founded_year INTEGER;