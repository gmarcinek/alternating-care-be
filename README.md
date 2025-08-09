# Alternating Care — Backend (Fastify + CouchDB)

Backend offline-first z CouchDB. Ten README prowadzi od zera do „działa”, z testem E2E i sprzątaniem artefaktów.

## Wymagania

- Docker + Docker Compose
- (opcjonalnie, lokalne uruchomienie) Node 20, npm

## Konfiguracja środowiska

Skopiuj zmienne i ustaw sekrety:

```bash
cp .env.example .env
# ZMIEŃ JWT_SECRET na długi losowy ciąg (min. 32 znaki)
```

Domyślne porty:

- API: `4000`
- CouchDB: `5984`

## Uruchomienie w Dockerze (zalecane)

Plik `docker-compose.yml` uruchamia **CouchDB → inicjalizację baz → backend** (production build).

```bash
docker compose up -d --build
```

Sprawdź:

```bash
curl http://127.0.0.1:5984/_up      # {"status":"ok"}
curl http://127.0.0.1:4000/health   # {"ok":true}
```

> Wewnątrz kontenera backendu `COUCHDB_URL` to `http://couchdb:5984`.

## Smoke test (bez jq) + sprzątanie

> Poniższe komendy działają w Git Bash / zsh. Jeśli nie masz `jq`, używamy `sed`.

```bash
# --- dane testowe ---
EMAIL="test@example.com"
PASS="pass123"

# rejestracja (idempotentna)
curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Test User\"}" >/dev/null

# login -> token
LOGIN_JSON=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$LOGIN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "TOKEN: $TOKEN"
[ -z "$TOKEN" ] && echo "❌ login padł" && echo "$LOGIN_JSON" && exit 1

# utworzenie grupy -> GROUP_ID
GROUP_JSON=$(curl -s -X POST http://localhost:4000/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Team A"}')
GROUP_ID=$(echo "$GROUP_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "GROUP_ID: $GROUP_ID"
[ -z "$GROUP_ID" ] && echo "❌ brak GROUP_ID" && echo "$GROUP_JSON" && exit 1

# dodanie eventu
curl -s -X POST http://localhost:4000/groups/$GROUP_ID/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-08-15","type":"EVENT","payload":{"note":"hello"}}' \
  | sed 's/.*/Event create -> &/'

# lista eventów
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/groups/$GROUP_ID/events?from=2025-08-01&to=2025-08-31" \
  | sed 's/.*/Events list -> &/'

# --- sprzątanie artefaktów testu ---
# usuń bazę tenanta (group_<id>)
curl -s -u ${COUCHDB_USER:-admin}:${COUCHDB_PASSWORD:-admin} \
  -X DELETE "http://127.0.0.1:5984/group_${GROUP_ID}" \
  | sed 's/.*/Delete tenant DB -> &/'

# usuń dokument grupy z meta-DB `groups`
REV=$(curl -s -u ${COUCHDB_USER:-admin}:${COUCHDB_PASSWORD:-admin} \
  "http://127.0.0.1:5984/groups/$GROUP_ID" | sed -n 's/.*"_rev":"\([^"]*\)".*/\1/p')
[ -n "$REV" ] && curl -s -u ${COUCHDB_USER:-admin}:${COUCHDB_PASSWORD:-admin} \
  -X DELETE "http://127.0.0.1:5984/groups/$GROUP_ID?rev=$REV" \
  | sed 's/.*/Delete group doc -> &/'

# (opcjonalnie) usuń testowego usera z _users
USER_ID="org.couchdb.user:$EMAIL"
USER_REV=$(curl -s -u ${COUCHDB_USER:-admin}:${COUCHDB_PASSWORD:-admin} \
  "http://127.0.0.1:5984/_users/$USER_ID" | sed -n 's/.*"_rev":"\([^"]*\)".*/\1/p')
[ -n "$USER_REV" ] && curl -s -u ${COUCHDB_USER:-admin}:${COUCHDB_PASSWORD:-admin} \
  -X DELETE "http://127.0.0.1:5984/_users/$USER_ID?rev=$USER_REV" \
  | sed 's/.*/Delete user -> &/'
```

## Tryb developerski w Dockerze (hot-reload)

Jeśli chcesz edytować kod bez rebuilda obrazu, dodaj plik `docker-compose.dev.yml`:

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.dev
    command: npm run dev
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - COUCHDB_URL=http://couchdb:5984
      - PORT=4000
      - JWT_SECRET=dev_change_me
      - CORS_ORIGIN=http://localhost:3000
    ports:
      - "4000:4000"
    depends_on:
      couchdb:
        condition: service_healthy
```

I `Dockerfile.dev`:

```dockerfile
FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm","run","dev"]
```

Uruchom:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Lokalnie bez Dockera (opcjonalnie)

```bash
npm install
npm run init:couch     # CORS + utworzenie DB "groups"
npm run dev            # Node ESM: używamy loadera ts-node/esm
```

> Jeśli zobaczysz błąd `.ts as ESM`, ustaw skrypt `dev` w `package.json`:
> `"dev": "node --loader ts-node/esm --no-warnings src/server.ts"`

## Rebuild obrazów po zmianach kodu

W trybie produkcyjnym każda zmiana kodu wymaga rebuilda:

```bash
docker compose build backend
docker compose up -d backend
```

## Najczęstsze problemy

- **401 `FST_JWT_NO_AUTHORIZATION_IN_HEADER`**
  Brak nagłówka `Authorization: Bearer <TOKEN>` lub pusty `$TOKEN` (login padł).

- **403 `FORBIDDEN` przy /events**
  Upewnij się, że backend ma _aktualny_ kod `requireRole` (sprawdza członkostwo w DB `groups`) i że kontener został przebudowany.

- **`Database does not exist: _users`**
  Uruchom Compose z init-kontenerem (jest w `docker-compose.yml`) lub odpal `npm run init:couch`.

- **`COUCH_UNREACHABLE` w /auth/login**
  Login używa `POST ${COUCHDB_URL}/_session`. `COUCHDB_URL` **bez** `user:pass@` i CouchDB musi być dostępny.

- **ESM/TS błędy w dev**
  Używaj `node --loader ts-node/esm` (zamiast `ts-node-dev`) i `module: "NodeNext"` w `tsconfig.json`.

## .env — ważne pola

```
PORT=4000
JWT_SECRET=***WYPEŁNIJ SILNYM SEKRETEM***
COUCHDB_URL=http://127.0.0.1:5984   # w kontenerze backendu nadpisywane na http://couchdb:5984
COUCHDB_USER=admin
COUCHDB_PASSWORD=admin
CORS_ORIGIN=http://localhost:3000
```

To wszystko. Jeśli chcesz, mogę dorzucić gotowy `smoke-test.sh` i `cleanup.sh` do repo, żebyś miał je pod ręką.
