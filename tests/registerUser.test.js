const API_URL = process.env.API_URL || 'http://localhost:4000';
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://127.0.0.1:5984';
const COUCHDB_USER = process.env.COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'admin';

describe('User registration flow', () => {
  const email = `test_${Date.now()}@example.com`;
  const password = 'pass123';
  let userDocId;

  it('registers and logs in a user', async () => {
    // register (idempotent)
    const r1 = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Test User' })
    });
    expect(r1.status).toBeLessThan(500);

    // login -> token
    const r2 = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    expect(r2.status).toBe(200);
    const data = await r2.json();
    expect(data.token).toBeTruthy();

    userDocId = `org.couchdb.user:${email}`;
  });

  afterAll(async () => {
    // cleanup user from _users (best-effort)
    try {
      const auth = 'Basic ' + Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64');
      const res = await fetch(`${COUCHDB_URL}/_users/${encodeURIComponent(userDocId)}`, {
        headers: { Authorization: auth }
      });
      if (res.ok) {
        const doc = await res.json();
        if (doc._rev) {
          await fetch(`${COUCHDB_URL}/_users/${encodeURIComponent(userDocId)}?rev=${doc._rev}`, {
            method: 'DELETE',
            headers: { Authorization: auth }
          });
        }
      }
    } catch {}
  });
});
