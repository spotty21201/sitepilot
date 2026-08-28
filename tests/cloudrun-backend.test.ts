import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';

describe('Cloud Run Backend Authorization & Integrity Test Suite', () => {
  let server: http.Server;
  const PORT = 8991;
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  const TEST_SECRET = 'test-secret-cloudrun-555';

  beforeEach(async () => {
    process.env.PORT = String(PORT);
    process.env.SITEPILOT_SERVER_SECRET = TEST_SECRET;
    process.env.GOOGLE_CLOUD_PROJECT = 'project-528f858c-325a-45aa-ac0';
    process.env.GOOGLE_CLOUD_LOCATION = 'global';
    process.env.GEMINI_MODEL = 'gemini-3.6-flash';
    process.env.K_REVISION = 'sitepilot-vertex-test-rev';

    // Clear module cache and require server
    vi.resetModules();
    const serverModule = await import('../backend/server.js');
    server = serverModule.default || serverModule;

    await new Promise<void>((resolve) => {
      if (server.listening) resolve();
      else server.once('listening', resolve);
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // Test 1: /analyze with no Authorization header -> 401
  it('1. rejects /analyze requests with no Authorization header (401)', async () => {
    const res = await fetch(`${BASE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test prompt' })
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Missing Authorization');
    expect(data.ok).toBe(false);
  });

  // Test 2: /analyze with an invalid token -> 401
  it('2. rejects /analyze requests with an invalid Bearer token (401)', async () => {
    const res = await fetch(`${BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong-unauthorized-secret'
      },
      body: JSON.stringify({ prompt: 'test prompt' })
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Invalid authentication credentials');
    expect(data.ok).toBe(false);
  });

  // Test 3: /analyze with malformed JSON but no token -> still 401, proving auth happens first
  it('3. rejects malformed JSON without token with 401, proving auth occurs prior to JSON body parsing', async () => {
    const res = await fetch(`${BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header
      },
      body: '{ this is completely malformed json'
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Missing Authorization');
  });

  // Test 4: /health and root endpoints are public and do not invoke Vertex AI
  it('4. serves public health metadata on / and /health without requiring authorization', async () => {
    const resRoot = await fetch(`${BASE_URL}/`);
    expect(resRoot.status).toBe(200);
    const dataRoot = await resRoot.json();
    expect(dataRoot.status).toBe('ready');
    expect(dataRoot.model).toBe('gemini-3.6-flash');
    expect(dataRoot.project).toBe('project-528f858c-325a-45aa-ac0');
    expect(dataRoot.vertex_location).toBe('global');

    const resHealth = await fetch(`${BASE_URL}/health`);
    expect(resHealth.status).toBe(200);
  });
});
