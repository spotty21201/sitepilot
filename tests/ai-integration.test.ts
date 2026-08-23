import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAiConfig } from '@/lib/ai/config';
import { createAiClient, extractDocumentFindings } from '@/lib/ai/gemini';

describe('Google GenAI & Vertex AI Integration Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('configures Vertex AI with the repository model gemini-3.7-flash when GOOGLE_CLOUD_PROJECT is set', () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'sitepilot-hackathon-proj';
    process.env.GOOGLE_CLOUD_LOCATION = 'asia-southeast2';
    process.env.GEMINI_MODEL = 'gemini-3.7-flash';

    const config = getAiConfig();
    expect(config.provider).toBe('VERTEX_AI');
    expect(config.projectId).toBe('sitepilot-hackathon-proj');
    expect(config.location).toBe('asia-southeast2');
    expect(config.model).toBe('gemini-3.7-flash');

    const clientInfo = createAiClient();
    expect(clientInfo.provider).toBe('VERTEX_AI');
    expect(clientInfo.model).toBe('gemini-3.7-flash');
    expect(clientInfo.ai).toBeDefined();
    expect(clientInfo.ai.vertexai).toBe(true);
  });

  it('defaults to verified Gemini 3.7 Flash model when GEMINI_MODEL is not explicitly set', () => {
    delete process.env.GEMINI_MODEL;
    const config = getAiConfig();
    expect(config.model).toBe('gemini-3.7-flash');
    expect(config.model).not.toBe('gemini-2.5-flash');
  });

  it('configures Gemini API when GEMINI_API_KEY is set and no GCP project', () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    process.env.GEMINI_API_KEY = 'test-gemini-api-key';

    const config = getAiConfig();
    expect(config.provider).toBe('GEMINI_API');
    expect(config.apiKey).toBe('test-gemini-api-key');

    const clientInfo = createAiClient();
    expect(clientInfo.provider).toBe('GEMINI_API');
    expect(clientInfo.ai.vertexai).toBe(false);
  });

  it('falls back to local development mode in development when unconfigured', async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const config = getAiConfig();
    expect(config.provider).toBe('LOCAL_DEVELOPMENT');

    const findings = await extractDocumentFindings('The land area is 16,850 m² as stated in SHGB certificate', {
      id: 'src-test-01',
      name: 'SHGB_Certificate_Test.pdf',
      origin: 'BPN Cadastral Land Office'
    });

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('LEGAL_TITLE');
    expect(findings[0].extractedValue?.numericValue).toBe(16850);
  });

  it('throws an explicit error in production when Vertex AI is not configured', async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    await expect(
      extractDocumentFindings('Sample land document', {
        id: 'src-test-02',
        name: 'Brochure.pdf',
        origin: 'Broker'
      })
    ).rejects.toThrow(/Google Cloud Vertex AI is not configured/);
  });
});
