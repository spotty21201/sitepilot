import { GoogleGenAI, Type } from '@google/genai';
import { calculateDevelopmentMetrics, calculatePolygonAreaM2, checkConstraintViolations } from '@/lib/geometry/engine';
import { extractDocumentFindings } from '@/lib/ai/gemini';
import { BuildingMass, Contradiction, EvidenceCategory, EvidenceClassification, Finding, GeoPolygon, Setbacks } from '@/types';

export const runtime = 'nodejs';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const DEFAULT_SETBACKS: Setbacks = { front: 0, rear: 0, sideLeft: 0, sideRight: 0 };
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

type JsonRecord = Record<string, unknown>;
type Source = { id: string; name: string; origin: string };
type MediaPart = { mimeType: string; data: string };
type GeometryInput = { grossSiteArea?: unknown; boundary?: unknown; setbacks?: unknown; masses?: unknown; constraints?: unknown };

class RequestValidationError extends Error {}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function makeId(prefix: string): string {
  return prefix + '-' + crypto.randomUUID();
}

function parseJsonField(value: FormDataEntryValue | null): unknown {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try { return JSON.parse(value); } catch { throw new RequestValidationError('JSON form fields must contain valid JSON.'); }
}

function stripDataUrl(value: string): string {
  const match = value.match(/^data:[^;]+;base64,([\s\S]*)$/);
  return match ? match[1] : value;
}

function supportedMediaType(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

function base64Size(value: string): number {
  const data = stripDataUrl(value).replace(/\s/g, '');
  return Math.max(0, Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0));
}

async function parseRequest(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  let body: JsonRecord = {};
  let content = '';
  const media: MediaPart[] = [];

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    body = {
      projectId: formData.get('projectId'), sourceId: formData.get('sourceId'), sourceName: formData.get('sourceName'), origin: formData.get('origin'),
      source: parseJsonField(formData.get('source')),
      existingFindings: parseJsonField(formData.get('existingFindings') ?? formData.get('findings')),
      geometry: parseJsonField(formData.get('geometry')), constraints: parseJsonField(formData.get('constraints'))
    };
    const text = formData.get('content') ?? formData.get('text');
    if (typeof text === 'string') content = text;
    const entry = formData.get('file') ?? formData.get('document');
    if (typeof File !== 'undefined' && entry instanceof File && entry.size > 0) {
      if (entry.size > MAX_DOCUMENT_BYTES) throw new RequestValidationError('Document exceeds the 20 MB upload limit.');
      const mimeType = entry.type || 'application/octet-stream';
      const bytes = new Uint8Array(await entry.arrayBuffer());
      if (mimeType.startsWith('text/')) content = content || new TextDecoder().decode(bytes);
      else if (supportedMediaType(mimeType)) media.push({ mimeType, data: Buffer.from(bytes).toString('base64') });
      else throw new RequestValidationError('Only PDF, image, or text documents are supported.');
      body.fileName = entry.name;
    }
  } else {
    try {
      const parsed = await request.json();
      if (!isRecord(parsed)) throw new RequestValidationError('Request body must be a JSON object.');
      body = parsed;
    } catch (error) {
      if (error instanceof RequestValidationError) throw error;
      throw new RequestValidationError('Request body must be valid JSON.');
    }
    content = stringValue(body.content) || stringValue(body.text) || '';
    const document = isRecord(body.document) ? body.document : isRecord(body.file) ? body.file : undefined;
    if (document) {
      const data = stringValue(document.data);
      const mimeType = stringValue(document.mimeType) || 'application/pdf';
      if (!data) throw new RequestValidationError('document.data is required when a document is supplied.');
      if (!supportedMediaType(mimeType)) throw new RequestValidationError('Only PDF or image document data is supported.');
      if (base64Size(data) > MAX_DOCUMENT_BYTES) throw new RequestValidationError('Document exceeds the 20 MB upload limit.');
      media.push({ mimeType, data: stripDataUrl(data) });
    }
    if (Array.isArray(body.media)) {
      for (const item of body.media) {
        if (!isRecord(item)) throw new RequestValidationError('Each media item must be an object.');
        const data = stringValue(item.data); const mimeType = stringValue(item.mimeType);
        if (!data || !mimeType || !supportedMediaType(mimeType)) throw new RequestValidationError('Each media item requires supported mimeType and base64 data.');
        if (base64Size(data) > MAX_DOCUMENT_BYTES) throw new RequestValidationError('Document exceeds the 20 MB upload limit.');
        media.push({ mimeType, data: stripDataUrl(data) });
      }
    }
  }

  const sourceRecord = isRecord(body.source) ? body.source : {};
  const source: Source = {
    id: stringValue(sourceRecord.id) || stringValue(body.sourceId) || makeId('src'),
    name: stringValue(sourceRecord.name) || stringValue(body.sourceName) || stringValue(body.fileName) || 'Untitled evidence',
    origin: stringValue(sourceRecord.origin) || stringValue(body.origin) || 'User upload'
  };
  const projectId = stringValue(body.projectId) || 'unassigned-project';
  const existingFindings = Array.isArray(body.existingFindings) ? body.existingFindings : Array.isArray(body.findings) ? body.findings : [];
  if (!content && media.length === 0 && !body.geometry) throw new RequestValidationError('Provide document content, a PDF/image document, or geometry input.');
  return { body, projectId, source, content, media, existingFindings };
}

const categories: EvidenceCategory[] = ['LEGAL_TITLE', 'PHYSICAL_SURVEY', 'ZONING_PLANNING', 'ENVIRONMENTAL_TOPOGRAPHY', 'INFRASTRUCTURE_UTILITIES', 'ACCESS_TRAFFIC', 'MARKET_COMMERCIAL', 'GENERAL_NOTE'];
const classifications: EvidenceClassification[] = ['FACT', 'CLAIM', 'ASSUMPTION', 'INFERENCE', 'RECOMMENDATION', 'USER_OVERRIDE'];

function normalizeKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().replace(/[\s/-]+/g, '_');
  const aliases: Record<string, string> = { site_area: 'gross_site_area', land_area: 'gross_site_area', area: 'gross_site_area', max_height: 'max_height_floors', maximum_height: 'max_height_floors', floors: 'max_height_floors', far: 'max_far', klb: 'max_far', kdb: 'max_coverage_pct', coverage: 'max_coverage_pct', max_coverage: 'max_coverage_pct' };
  return aliases[key] || key;
}

function normalizeFinding(value: unknown, projectId: string, source: Source): Finding | undefined {
  if (!isRecord(value) || !stringValue(value.statement)) return undefined;
  const extracted = isRecord(value.extractedValue) ? value.extractedValue : undefined;
  const numericValue = finiteNumber(extracted?.numericValue);
  const extractedKey = normalizeKey(stringValue(extracted?.key));
  const category = stringValue(value.category) as EvidenceCategory;
  const classification = stringValue(value.classification) as EvidenceClassification;
  const confidence = stringValue(value.confidence);
  return {
    id: stringValue(value.id) || makeId('fnd'), projectId,
    sourceId: stringValue(value.sourceId) || source.id, sourceName: stringValue(value.sourceName) || source.name,
    pageLocation: stringValue(value.pageLocation), statement: stringValue(value.statement) as string,
    category: categories.includes(category) ? category : 'GENERAL_NOTE',
    classification: classifications.includes(classification) ? classification : 'CLAIM',
    confidence: confidence === 'HIGH' || confidence === 'MEDIUM' || confidence === 'LOW' || confidence === 'UNVERIFIED' ? confidence : 'UNVERIFIED',
    extractedValue: numericValue === undefined && !extractedKey ? undefined : { numericValue, unit: stringValue(extracted?.unit), key: extractedKey },
    createdAt: stringValue(value.createdAt) || new Date().toISOString(), userOverridden: value.userOverridden === true
  };
}

function numericFindingValue(finding: Finding): { key: string; value: number } | undefined {
  const key = normalizeKey(finding.extractedValue?.key);
  const value = finiteNumber(finding.extractedValue?.numericValue);
  if (!key || value === undefined) return undefined;
  const areaInM2 = key === 'gross_site_area' && /^(ha|hectare)s?$/i.test(finding.extractedValue?.unit || '') ? value * 10000 : value;
  return { key, value: areaInM2 };
}

function conflicting(left: number, right: number): boolean {
  return Math.abs(left - right) > Math.max(0.01, Math.max(Math.abs(left), Math.abs(right)) * 0.005);
}

function detectContradictions(findings: Finding[], projectId: string): Contradiction[] {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const value = numericFindingValue(finding);
    if (value) groups.set(value.key, [...(groups.get(value.key) || []), finding]);
  }
  const result: Contradiction[] = [];
  const labels: Record<string, string> = { gross_site_area: 'Site Area', max_height_floors: 'Maximum Height', max_far: 'FAR / KLB', max_coverage_pct: 'Site Coverage / KDB' };
  for (const [topic, topicFindings] of groups) {
    const values = topicFindings.map(numericFindingValue).filter((item): item is { key: string; value: number } => !!item).map(item => item.value);
    if (!values.some((value, index) => values.some((other, otherIndex) => index !== otherIndex && conflicting(value, other)))) continue;
    const confidence = { HIGH: 4, MEDIUM: 3, LOW: 2, UNVERIFIED: 1 };
    const classification = { USER_OVERRIDE: 5, FACT: 4, CLAIM: 3, INFERENCE: 2, ASSUMPTION: 1, RECOMMENDATION: 0 };
    const preferred = [...topicFindings].sort((a, b) => confidence[b.confidence] - confidence[a.confidence] || classification[b.classification] - classification[a.classification])[0];
    const label = labels[topic] || topic.replace(/_/g, ' ');
    result.push({
      id: makeId('ctr'), projectId, title: label + ' Discrepancy', topic,
      severity: topic === 'gross_site_area' ? 'CRITICAL' : topic === 'max_height_floors' || topic === 'max_far' || topic === 'max_coverage_pct' ? 'IMPORTANT' : 'MODERATE',
      findings: topicFindings,
      impactStatement: topic === 'gross_site_area' ? 'Changes the basis for buildable area, development yield, FAR and land price per m².' : 'Conflicting ' + label.toLowerCase() + ' values change the validity of development scenarios and planning conclusions.',
      recommendedAction: topic === 'gross_site_area' ? 'Request an official cadastral or topographic boundary survey and select a documented working value.' : 'Verify the ' + label.toLowerCase() + ' against the applicable planning instrument or specialist report.',
      resolved: false, workingValueSelected: numericFindingValue(preferred)?.value
    });
  }
  return result;
}

function parseBoundary(value: unknown): GeoPolygon | undefined {
  if (!isRecord(value) || value.type !== 'Polygon' || !Array.isArray(value.coordinates)) return undefined;
  return value as unknown as GeoPolygon;
}

function parseSetbacks(value: unknown): Setbacks {
  if (!isRecord(value)) return DEFAULT_SETBACKS;
  return { front: Math.max(0, finiteNumber(value.front) || 0), rear: Math.max(0, finiteNumber(value.rear) || 0), sideLeft: Math.max(0, finiteNumber(value.sideLeft) || 0), sideRight: Math.max(0, finiteNumber(value.sideRight) || 0) };
}

function recalculateGeometry(geometryValue: unknown, rootConstraints: unknown) {
  if (!isRecord(geometryValue)) return undefined;
  const geometry = geometryValue as GeometryInput;
  const boundary = parseBoundary(geometry.boundary);
  const grossSiteArea = finiteNumber(geometry.grossSiteArea) ?? (boundary ? calculatePolygonAreaM2(boundary.coordinates[0]) : undefined);
  if (grossSiteArea === undefined || grossSiteArea < 0) throw new RequestValidationError('geometry.grossSiteArea or a valid Polygon boundary is required.');
  if (geometry.masses !== undefined && !Array.isArray(geometry.masses)) throw new RequestValidationError('geometry.masses must be an array.');
  const metrics = calculateDevelopmentMetrics(grossSiteArea, (geometry.masses || []) as BuildingMass[], parseSetbacks(geometry.setbacks));
  const constraints = isRecord(geometry.constraints) ? geometry.constraints : isRecord(rootConstraints) ? rootConstraints : {};
  const constraintCheck = checkConstraintViolations(metrics, { maxHeightFloors: finiteNumber(constraints.maxHeightFloors), maxFAR: finiteNumber(constraints.maxFAR), maxCoveragePct: finiteNumber(constraints.maxCoveragePct) });
  return { grossSiteArea: metrics.grossSiteArea, buildableArea: metrics.netBuildableArea, metrics, constraintCheck, recalculatedAt: new Date().toISOString() };
}

async function multimodalExtract(content: string, source: Source, media: MediaPart[]): Promise<Partial<Finding>[]> {
  if (!media.length || !apiKey) return extractDocumentFindings(content, source);
  try {
    const prompt = "You are SitePilot's Evidence Intelligence Engine. Extract only traceable findings from the attached document(s). Classify each item as FACT, CLAIM, ASSUMPTION, or INFERENCE. Never invent missing values or arithmetic. Source: " + source.origin + '; File: ' + source.name + '. Additional text: ' + content.slice(0, 15000);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }, ...media.map(part => ({ inlineData: part }))] }],
      config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { statement: { type: Type.STRING }, pageLocation: { type: Type.STRING }, category: { type: Type.STRING, enum: categories }, classification: { type: Type.STRING, enum: ['FACT', 'CLAIM', 'ASSUMPTION', 'INFERENCE'] }, confidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED'] }, extractedNumericValue: { type: Type.NUMBER }, extractedUnit: { type: Type.STRING }, extractedKey: { type: Type.STRING } }, required: ['statement', 'category', 'classification', 'confidence'] } } }
    });
    const parsed = JSON.parse(response.text || '[]') as Array<JsonRecord>;
    return parsed.map((item, index) => ({ id: 'fnd-' + Date.now() + '-' + index, sourceId: source.id, sourceName: source.name, pageLocation: stringValue(item.pageLocation) || 'Page 1', statement: stringValue(item.statement), category: item.category as EvidenceCategory, classification: item.classification as EvidenceClassification, confidence: item.confidence as Finding['confidence'], extractedValue: finiteNumber(item.extractedNumericValue) === undefined ? undefined : { numericValue: finiteNumber(item.extractedNumericValue), unit: stringValue(item.extractedUnit), key: normalizeKey(stringValue(item.extractedKey)) }, createdAt: new Date().toISOString() }));
  } catch (error) {
    console.error('[SitePilot AI] multimodal extraction error:', error);
    return extractDocumentFindings(content, source);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await parseRequest(request);
    const extracted = await multimodalExtract(input.content, input.source, input.media);
    const existing = input.existingFindings.map(value => normalizeFinding(value, input.projectId, input.source)).filter((value): value is Finding => !!value);
    const findings = extracted.map(value => normalizeFinding(value, input.projectId, input.source)).filter((value): value is Finding => !!value);
    return Response.json({ projectId: input.projectId, source: input.source, findings, contradictions: detectContradictions([...existing, ...findings], input.projectId), geometry: recalculateGeometry(input.body.geometry, input.body.constraints), processedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof RequestValidationError) return Response.json({ error: error.message }, { status: 400 });
    console.error('[SitePilot Evidence API] extraction failed', error);
    return Response.json({ error: 'Evidence extraction failed.' }, { status: 500 });
  }
}
