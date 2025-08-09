## Start
1) cp .env.example .env
2) docker compose -f docker/docker-compose.yml up -d
3) npm i
4) npm run init:couch
5) npm run dev

## Smoke (ręcznie)
- POST /auth/register {email,password,name}
- POST /auth/login {email,password}  -> token
- POST /groups (Bearer) {name}
- GET /groups/mine (Bearer)
- POST /groups/:groupId/events (Bearer) {date,type,payload?}
- GET /groups/:groupId/events?from=YYYY-MM-DD&to=YYYY-MM-DD
