/**
 * Google GenAI & Vertex AI Configuration for SitePilot
 * 
 * Google technology implementation used by the hackathon project:
 * - Uses official Google GenAI SDK (@google/genai)
 * - Supports Vertex AI with IAM Application Default Credentials (ADC) on Google Cloud Run
 * - Supports Gemini API Key for local development
 * - Never silently substitutes fallback heuristics in production
 */

export interface AiConfig {
  provider: 'VERTEX_AI' | 'GEMINI_API' | 'LOCAL_DEVELOPMENT';
  model: string;
  projectId?: string;
  location?: string;
  apiKey?: string;
  isProduction: boolean;
}

export function getAiConfig(): AiConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || '';
  const location = process.env.VERTEX_AI_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_REGION || 'asia-southeast2';
  
  // Repository-wide configured model; live authenticated inference is verified separately.
  // Use the owner-selected GA Vertex model for the hackathon release. Hosted
  // promotion remains gated on a successful live request in this project.
  const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

  if (projectId) {
    return {
      provider: 'VERTEX_AI',
      model,
      projectId,
      location,
      isProduction
    };
  }

  if (apiKey) {
    return {
      provider: 'GEMINI_API',
      model,
      apiKey,
      isProduction
    };
  }

  return {
    provider: 'LOCAL_DEVELOPMENT',
    model,
    isProduction
  };
}
