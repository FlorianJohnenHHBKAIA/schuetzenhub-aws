# SchützenConnect – Lokale & AWS Einrichtung

## Übersicht

Dieses Projekt läuft vollständig **ohne Supabase**. Es verwendet:
- **Backend**: Node.js + Express (läuft lokal oder auf AWS EC2/ECS)
- **Datenbank**: PostgreSQL (lokal oder AWS RDS/Aurora)
- **Datei-Uploads**: Lokal gespeichert (oder AWS S3 – nur 1 Variable umschalten)
- **Auth**: JWT (selbst verwaltet, keine externen Abhängigkeiten)

---

## 🚀 Lokale Einrichtung (Schnellstart)

### 1. PostgreSQL Datenbank anlegen

```bash
psql -U postgres -c "CREATE DATABASE schuetzenhub;"
psql -U postgres -d schuetzenhub -f database/migration.sql
```

### 2. Backend einrichten

```bash
cd backend
npm install
cp .env.example .env
# .env anpassen: DB_PASSWORD, JWT_SECRET
npm run dev
```

Das Backend läuft auf http://localhost:5000

### 3. Frontend einrichten

```bash
cd frontend
npm install
cp .env.example .env
# .env anpassen (standard: VITE_API_URL=http://localhost:5000)
npm run dev
```

Das Frontend läuft auf http://localhost:8080

### 4. Ersten Verein anlegen

Öffne http://localhost:8080/setup und folge dem Einrichtungsassistenten.

---

## 🗂 Projektstruktur

```
/
├── backend/
│   ├── server.js           # Express-Server (Einstiegspunkt)
│   ├── db.js               # PostgreSQL-Verbindung
│   ├── storage.js          # Datei-Speicher (lokal/S3-abstrahiert)
│   ├── middleware/
│   │   └── auth.js         # JWT-Middleware
│   ├── routes/
│   │   ├── auth.js         # Login, Register, Setup, /me
│   │   ├── members.js      # Mitglieder-API
│   │   ├── events.js       # Termine-API
│   │   └── api.js          # Alle weiteren Routen
│   ├── uploads/            # Lokaler Datei-Speicher
│   │   ├── avatars/
│   │   ├── club-assets/
│   │   ├── company-assets/
│   │   ├── gallery-images/
│   │   ├── documents/
│   │   └── post-images/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── integrations/
│   │   │   ├── api/
│   │   │   │   └── client.ts   # API-Client (ersetzt Supabase)
│   │   │   └── supabase/
│   │   │       └── client.ts   # Shim → leitet auf api/client um
│   │   ├── lib/
│   │   │   └── auth.tsx        # Auth-Context (JWT-basiert)
│   │   └── ...
│   ├── .env.example
│   └── package.json
│
└── database/
    └── migration.sql       # Vollständiges DB-Schema
```

---

## ☁️ AWS-Umstieg (später)

### Schritt 1: Datenbank → AWS RDS

1. RDS PostgreSQL-Instanz erstellen (z.B. `db.t3.micro`)
2. In `backend/.env` anpassen:
   ```
   DB_HOST=your-rds-endpoint.rds.amazonaws.com
   DB_PORT=5432
   DB_NAME=schuetzenhub
   DB_USER=postgres
   DB_PASSWORD=sicheres_passwort
   ```
3. In `backend/db.js` SSL aktivieren (Zeile auskommentieren):
   ```js
   ssl: { rejectUnauthorized: false }
   ```
4. Migration ausführen:
   ```bash
   psql -h your-rds-endpoint -U postgres -d schuetzenhub -f database/migration.sql
   ```

### Schritt 2: Datei-Uploads → AWS S3

1. S3-Bucket erstellen (z.B. `schuetzenhub-uploads`)
2. In `backend/.env`:
   ```
   USE_S3=true
   AWS_REGION=eu-central-1
   AWS_S3_BUCKET=schuetzenhub-uploads
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```
3. In `frontend/.env`:
   ```
   VITE_USE_S3=true
   VITE_AWS_REGION=eu-central-1
   VITE_AWS_S3_BUCKET=schuetzenhub-uploads
   ```
4. S3-Paket installieren:
   ```bash
   cd backend && npm install @aws-sdk/client-s3
   ```
5. **Sonst nichts ändern** – die Storage-Abstraktion übernimmt den Rest.

### Schritt 3: Backend → AWS EC2 oder ECS

**Option A: EC2**
```bash
# Auf dem Server:
git clone ... && cd backend
npm install --production
# PM2 für Prozess-Management:
npm install -g pm2
pm2 start server.js --name schuetzen-backend
pm2 save && pm2 startup
```

**Option B: ECS/Fargate**
- Dockerfile im backend/ anlegen (Vorlage unten)
- Image zu ECR pushen
- ECS-Task-Definition erstellen

**Dockerfile-Vorlage für Backend:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

### Schritt 4: Frontend → AWS CloudFront + S3

```bash
cd frontend
npm run build
# dist/ Ordner zu S3-Bucket hochladen (static website hosting)
# CloudFront Distribution davor schalten
```

---

## 🔑 Umgebungsvariablen Referenz

### Backend `.env`

| Variable | Lokal | AWS |
|----------|-------|-----|
| `DB_HOST` | `localhost` | RDS-Endpoint |
| `DB_PORT` | `5432` | `5432` |
| `DB_NAME` | `schuetzenhub` | `schuetzenhub` |
| `DB_USER` | `postgres` | `postgres` |
| `DB_PASSWORD` | Dein PW | Secrets Manager |
| `JWT_SECRET` | Langer String | Langer String (gleich lassen!) |
| `PORT` | `5000` | `5000` |
| `FRONTEND_URL` | `http://localhost:8080` | `https://deine-domain.de` |
| `USE_S3` | `false` | `true` |
| `AWS_REGION` | – | `eu-central-1` |
| `AWS_S3_BUCKET` | – | `schuetzenhub-uploads` |

### Frontend `.env`

| Variable | Lokal | AWS |
|----------|-------|-----|
| `VITE_API_URL` | `http://localhost:5000` | `https://api.deine-domain.de` |
| `VITE_USE_S3` | `false` | `true` |
| `VITE_AWS_REGION` | – | `eu-central-1` |
| `VITE_AWS_S3_BUCKET` | – | `schuetzenhub-uploads` |

---

## 🔒 Sicherheitshinweise

- **JWT_SECRET**: Mindestens 64 zufällige Zeichen. Generieren mit: `openssl rand -hex 64`
- **DB_PASSWORD**: Niemals in Git committen! Für AWS → AWS Secrets Manager nutzen
- **CORS**: `FRONTEND_URL` auf die exakte Frontend-URL setzen (kein Wildcard in Produktion)
- **HTTPS**: In Produktion unbedingt HTTPS (AWS Certificate Manager ist kostenlos)

---

## 📋 API-Übersicht

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| POST | `/api/auth/login` | Anmeldung |
| POST | `/api/auth/register` | Registrierung |
| POST | `/api/auth/setup` | Ersteinrichtung |
| GET | `/api/auth/me` | Aktueller User |
| GET | `/api/members` | Mitgliederliste |
| POST | `/api/members` | Mitglied anlegen |
| PUT | `/api/members/:id` | Mitglied bearbeiten |
| DELETE | `/api/members/:id` | Mitglied löschen |
| GET | `/api/events` | Termine |
| POST | `/api/events` | Termin anlegen |
| GET | `/api/clubs/me` | Vereinsdaten |
| GET | `/api/clubs/registration` | Öffentliche Vereinsliste |
| GET | `/api/companies` | Kompanien |
| GET | `/api/posts` | Beiträge |
| GET | `/api/notifications` | Benachrichtigungen |
| GET | `/api/gallery` | Galerie |
| GET | `/api/documents` | Dokumente |
| GET | `/api/work-shifts` | Arbeitsdienste |
| GET | `/api/dashboard` | Dashboard-Daten |
