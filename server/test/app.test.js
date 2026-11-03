import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../src/server.js';

test('GET /api/health returns service status', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.ok(response.body.express);
});

test('POST /api/sessions creates a new session', async () => {
  const response = await request(app).post('/api/sessions');
  assert.equal(response.status, 201);
  assert.ok(response.body.data.id);
});

test('POST /api/chat responds with answer payload', async () => {
  const sessionResponse = await request(app).post('/api/sessions');
  const sessionId = sessionResponse.body.data.id;

  const chatResponse = await request(app)
    .post('/api/chat')
    .send({ sessionId, message: 'What are the hostel facilities?' });

  assert.equal(chatResponse.status, 200);
  assert.ok(chatResponse.body.data.answer);
});
