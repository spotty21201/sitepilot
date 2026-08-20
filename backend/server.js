/**
 * SitePilot Cloud Run Vertex AI Gateway
 * Single purpose: Authenticated execution proxy for Vertex AI Gemini 3.7 Flash
 */

const http = require('node:http');
const crypto = require('node:crypto');
const { GoogleGenAI } = require('@google/genai');

const PORT = parseInt(process.env.PORT || '8080', 10);
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'project-528f858c-325a-45aa-ac0';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
const REVISION = process.env.K_REVISION || 'sitepilot-vertex-local';
const SERVICE_NAME = process.env.K_SERVICE || 'sitepilot-vertex';

const server = http.createServer((req, res) => {
  // CORS / Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  // Liveness & Discovery Endpoint (Public - Does NOT invoke Vertex AI)
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health' || req.url === '/api/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ready',
      service: SERVICE_NAME,
      model: MODEL,
      project: PROJECT_ID,
      vertex_location: LOCATION,
      revision: REVISION
    }));
  }

  // Planning Assessment Endpoint: /analyze
  if (req.method === 'POST' && req.url === '/analyze') {
    // 1. Mandatory Server-to-Server Authentication FIRST (Before Body Parsing)
    const authHeader = req.headers['authorization'] || '';
    const serverSecret = process.env.SITEPILOT_SERVER_SECRET;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        error: 'Unauthorized: Missing Authorization Bearer header.',
        ok: false 
      }));
    }

    const token = authHeader.slice(7).trim();
    if (!serverSecret || token !== serverSecret) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        error: 'Unauthorized: Invalid authentication credentials.',
        ok: false 
      }));
    }

    // 2. Read and Parse JSON Body
    let bodyRaw = '';
    req.on('data', chunk => {
      bodyRaw += chunk;
      if (bodyRaw.length > 5 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large.', ok: false }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      let body;
      try {
        body = JSON.parse(bodyRaw);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Malformed JSON payload.', ok: false }));
      }

      if (!body || typeof body !== 'object' || !body.prompt || typeof body.prompt !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Validation error: prompt is required.', ok: false }));
      }

      // 3. Execute Vertex AI Gemini Call via Google GenAI SDK
      try {
        const ai = new GoogleGenAI({
          vertexai: true,
          project: PROJECT_ID,
          location: LOCATION
        });

        const correlationId = crypto.randomUUID();
        const startTime = Date.now();

        const response = await ai.models.generateContent({
          model: MODEL,
          contents: body.prompt
        });

        const durationMs = Date.now() - startTime;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: true,
          model: MODEL,
          project: PROJECT_ID,
          vertexLocation: LOCATION,
          revision: REVISION,
          service: SERVICE_NAME,
          correlationId,
          durationMs,
          response: response.text || '',
          authenticated: true
        }));
      } catch (err) {
        console.error('[SitePilot Backend] Vertex AI error:', err);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Vertex AI execution failed.',
          details: err instanceof Error ? err.message : String(err),
          ok: false
        }));
      }
    });

    return;
  }

  // 404 for any other route
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', ok: false }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SitePilot Backend] Cloud Run gateway listening on port ${PORT}`);
  console.log(`[SitePilot Backend] Project: ${PROJECT_ID} | Location: ${LOCATION} | Model: ${MODEL}`);
});

module.exports = server;
