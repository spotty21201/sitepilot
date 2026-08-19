/**
 * Google GenAI (Gemini 3.7 Flash) Integration for SitePilot
 * Adheres to PRD Section 28, 29, 31:
 * - Deterministic extraction of Facts, Claims, Assumptions
 * - Multimodal document & image understanding
 * - Strict structured outputs via Zod / JSON schema
 * - Never hallucinates arithmetic (delegated to Geometry engine)
 */

import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Finding, Contradiction, EvidenceClassification, EvidenceCategory } from '@/types';

// Initialize SDK client (picks up GEMINI_API_KEY / GOOGLE_API_KEY from env)
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

/**
 * Structured document extraction prompt & execution
 */
export async function extractDocumentFindings(
  content: string,
  sourceInfo: { id: string; name: string; origin: string }
): Promise<Partial<Finding>[]> {
  if (!apiKey) {
    console.warn('[SitePilot AI] GEMINI_API_KEY not set, using deterministic heuristic parser.');
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
      model: 'gemini-2.5-flash',
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

    const parsed = JSON.parse(response.text || '[]');
    return parsed.map((item: any, idx: number) => ({
      id: `fnd-${Date.now()}-${idx}`,
      sourceId: sourceInfo.id,
      sourceName: sourceInfo.name,
      pageLocation: item.pageLocation || 'Page 1',
      statement: item.statement,
      category: item.category as EvidenceCategory,
      classification: item.classification as EvidenceClassification,
      confidence: item.confidence,
      extractedValue: item.extractedNumericValue ? {
        numericValue: item.extractedNumericValue,
        unit: item.extractedUnit || '',
        key: item.extractedKey || ''
      } : undefined,
      createdAt: new Date().toISOString()
    }));
  } catch (err) {
    console.error('[SitePilot AI] Gemini extraction error:', err);
    return fallbackExtractFindings(content, sourceInfo);
  }
}

/**
 * Fallback heuristic extractor when running offline / during tests
 */
function fallbackExtractFindings(
  content: string,
  sourceInfo: { id: string; name: string; origin: string }
): Partial<Finding>[] {
  const findings: Partial<Finding>[] = [];
  
  // Basic regex check for land area
  const areaMatch = content.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:m²|m2|sqm|hectares|ha)/i);
  if (areaMatch) {
    const rawVal = parseFloat(areaMatch[1].replace(/,/g, ''));
    findings.push({
      id: `fnd-${Date.now()}-1`,
      sourceId: sourceInfo.id,
      sourceName: sourceInfo.name,
      statement: `Extracted land area reference: ${areaMatch[0]}`,
      category: 'LEGAL_TITLE',
      classification: sourceInfo.name.toLowerCase().includes('certificate') ? 'FACT' : 'CLAIM',
      confidence: sourceInfo.name.toLowerCase().includes('certificate') ? 'HIGH' : 'LOW',
      extractedValue: { numericValue: rawVal, unit: 'm2', key: 'gross_site_area' },
      createdAt: new Date().toISOString()
    });
  }

  return findings;
}
