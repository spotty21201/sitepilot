/**
 * Google GenAI (Vertex AI & Gemini API) Integration for SitePilot
 * 
 * Google technology implementation used by the hackathon project:
 * - Deterministic extraction of Facts, Claims, Assumptions
 * - Multimodal document & image understanding
 * - Strict structured outputs via Zod / JSON schema
 * - Explicit error reporting without silent fallback in production
 */

import { GoogleGenAI, Type } from '@google/genai';
import { Finding, EvidenceClassification, EvidenceCategory } from '@/types';
import { getAiConfig } from './config';

/**
 * Initialize Google GenAI client based on environment
 */
export function createAiClient(): { ai: GoogleGenAI; model: string; provider: string } {
  const config = getAiConfig();

  if (config.provider === 'VERTEX_AI' && config.projectId) {
    return {
      ai: new GoogleGenAI({
        vertexai: true,
        project: config.projectId,
        location: config.location || 'asia-southeast2',
        // @google/genai 2.17.1 otherwise defaults Vertex requests to v1beta1.
        // SitePilot uses the stable v1 generateContent contract explicitly.
        httpOptions: { apiVersion: 'v1' },
      }),
      model: config.model,
      provider: 'VERTEX_AI'
    };
  }

  if (config.provider === 'GEMINI_API' && config.apiKey) {
    return {
      ai: new GoogleGenAI({ apiKey: config.apiKey }),
      model: config.model,
      provider: 'GEMINI_API'
    };
  }

  // Local fallback client
  return {
    ai: new GoogleGenAI({ apiKey: 'dummy-local-key' }),
    model: config.model,
    provider: 'LOCAL_DEVELOPMENT'
  };
}

/**
 * Structured document extraction prompt & execution
 */
export async function extractDocumentFindings(
  content: string,
  sourceInfo: { id: string; name: string; origin: string }
): Promise<Partial<Finding>[]> {
  const config = getAiConfig();
  const { ai, model, provider } = createAiClient();

  if (provider === 'LOCAL_DEVELOPMENT') {
    if (config.isProduction) {
      throw new Error(
        'Google Cloud Vertex AI is not configured. Set GOOGLE_CLOUD_PROJECT to enable Vertex AI in production.'
      );
    }
    console.warn('[SitePilot AI] No Vertex AI / Gemini API key configured. Using local developmental heuristic parser.');
    return fallbackExtractFindings(content, sourceInfo);
  }

  try {
    const prompt = `You are the Evidence Intelligence Engine for SitePilot (intelligent site due diligence workspace).
Analyze the provided property document/text and extract structured findings.

Classify each finding strictly according to these definitions:
- FACT: Supported by official legal certificates or verified surveys.
- CLAIM: Stated by a seller, broker, or unverified brochure.
- ASSUMPTION: Standard rule of thumb or working hypothesis.
- INFERENCE: System deduction regarding site constraints.

DOCUMENT ORIGIN: "${sourceInfo.origin}"
FILE NAME: "${sourceInfo.name}"
DOCUMENT CONTENT:
${content.slice(0, 15000)}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              statement: { type: Type.STRING },
              pageLocation: { type: Type.STRING },
              category: { 
                type: Type.STRING,
                enum: [
                  'LEGAL_TITLE',
                  'PHYSICAL_SURVEY',
                  'ZONING_PLANNING',
                  'ENVIRONMENTAL_TOPOGRAPHY',
                  'INFRASTRUCTURE_UTILITIES',
                  'ACCESS_TRAFFIC',
                  'MARKET_COMMERCIAL',
                  'GENERAL_NOTE'
                ]
              },
              classification: { 
                type: Type.STRING,
                enum: ['FACT', 'CLAIM', 'ASSUMPTION', 'INFERENCE']
              },
              confidence: {
                type: Type.STRING,
                enum: ['HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED']
              },
              extractedNumericValue: { type: Type.NUMBER },
              extractedUnit: { type: Type.STRING },
              extractedKey: { type: Type.STRING }
            },
            required: ['statement', 'category', 'classification', 'confidence']
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || '[]') as Array<Record<string, unknown>>;
    return parsed.map((item, idx: number) => ({
      id: `fnd-${Date.now()}-${idx}`,
      sourceId: sourceInfo.id,
      sourceName: sourceInfo.name,
      pageLocation: typeof item.pageLocation === 'string' ? item.pageLocation : 'Page 1',
      statement: String(item.statement || ''),
      category: item.category as EvidenceCategory,
      classification: item.classification as EvidenceClassification,
      confidence: item.confidence as Finding['confidence'],
      extractedValue: typeof item.extractedNumericValue === 'number' ? {
        numericValue: item.extractedNumericValue,
        unit: typeof item.extractedUnit === 'string' ? item.extractedUnit : '',
        key: typeof item.extractedKey === 'string' ? item.extractedKey : ''
      } : undefined,
      createdAt: new Date().toISOString()
    }));
  } catch (err) {
    console.error(`[SitePilot AI] ${provider} extraction error:`, err);
    if (config.isProduction) {
      throw new Error(`AI extraction failed under ${provider}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return fallbackExtractFindings(content, sourceInfo);
  }
}

/**
 * Fallback heuristic extractor when running offline / in local development
 */
function fallbackExtractFindings(
  content: string,
  sourceInfo: { id: string; name: string; origin: string }
): Partial<Finding>[] {
  const findings: Partial<Finding>[] = [];
  
  // Regex check for land area in development mode
  const areaMatch = content.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:m²|m2|sqm|hectares|ha)/i);
  if (areaMatch) {
    const rawVal = parseFloat(areaMatch[1].replace(/,/g, ''));
    findings.push({
      id: `fnd-dev-${Date.now()}-1`,
      sourceId: sourceInfo.id,
      sourceName: sourceInfo.name,
      statement: `[DEV HEURISTIC] Extracted land area reference: ${areaMatch[0]}`,
      category: 'LEGAL_TITLE',
      classification: sourceInfo.name.toLowerCase().includes('certificate') ? 'FACT' : 'CLAIM',
      confidence: 'LOW',
      extractedValue: { numericValue: rawVal, unit: 'm2', key: 'gross_site_area' },
      createdAt: new Date().toISOString()
    });
  }

  return findings;
}
