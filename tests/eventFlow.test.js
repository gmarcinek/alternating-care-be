const API_URL = process.env.API_URL || 'http://localhost:4000';
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://127.0.0.1:5984';
const COUCHDB_USER = process.env.COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'admin';

/**
 * Full flow test: register user, login, create group, create event, delete event, logout, cleanup.
 */
describe('Event lifecycle flow', () => {
  const email = `flow_${Date.now()}@example.com`;
  const password = 'pass123';
  const auth =
    'Basic ' + Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64');

  let token;
  let userDocId;
  let groupId;
  let eventId;
  let eventRev;

  it('registers, logs in, creates and deletes event', async () => {
    // register (idempotent)
    const r1 = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Flow User' }),
    });
    expect(r1.status).toBeLessThan(500);

    // login -> token
    const r2 = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(r2.status).toBe(200);
    const loginData = await r2.json();
    expect(loginData.token).toBeTruthy();
    token = loginData.token;
    userDocId = `org.couchdb.user:${email}`;

    // create group
    const r3 = await fetch(`${API_URL}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: `Test Group ${Date.now()}` }),
    });
    expect(r3.status).toBe(200);
    const group = await r3.json();
    expect(group.id).toBeTruthy();
    groupId = group.id;

    // create event
    const today = new Date().toISOString().slice(0, 10);
    const r4 = await fetch(`${API_URL}/groups/${groupId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date: today, type: 'test', payload: { a: 1 } }),
    });
    expect(r4.status).toBe(201);
    const event = await r4.json();
    expect(event._id).toBeTruthy();
    expect(event._rev).toBeTruthy();
    eventId = event._id;
    eventRev = event._rev;

    // delete event
    const r5 = await fetch(
      `${API_URL}/groups/${groupId}/events/${eventId}?rev=${encodeURIComponent(
        eventRev,
      )}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(r5.status).toBe(204);

    // verify cannot access protected resource without token (simulate logout)
    const r6 = await fetch(`${API_URL}/groups/mine`);
    expect(r6.status).toBe(401);
  });

  afterAll(async () => {
    // best-effort cleanup
    try {
      // delete group doc
      if (groupId) {
        const gDocRes = await fetch(`${COUCHDB_URL}/groups/${groupId}`, {
          headers: { Authorization: auth },
        });
        if (gDocRes.ok) {
          const gDoc = await gDocRes.json();
          if (gDoc._rev) {
            await fetch(`${COUCHDB_URL}/groups/${groupId}?rev=${gDoc._rev}`, {
              method: 'DELETE',
              headers: { Authorization: auth },
            });
          }
        }
        // delete group database
        await fetch(`${COUCHDB_URL}/group_${groupId}`, {
          method: 'DELETE',
          headers: { Authorization: auth },
        });
      }

      // delete user
      if (userDocId) {
        const uRes = await fetch(
          `${COUCHDB_URL}/_users/${encodeURIComponent(userDocId)}`,
          {
            headers: { Authorization: auth },
          },
        );
        if (uRes.ok) {
          const uDoc = await uRes.json();
          if (uDoc._rev) {
            await fetch(
              `${COUCHDB_URL}/_users/${encodeURIComponent(userDocId)}?rev=${uDoc._rev}`,
              {
                method: 'DELETE',
                headers: { Authorization: auth },
              },
            );
          }
        }
      }
    } catch {}
  });
});

