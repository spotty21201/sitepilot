export const STREET_NAME_FALLBACK = 'Street name not provided';

export function deriveStreetName(
  address: string | undefined,
  manualStreetName?: string,
): { value: string; source: 'ADDRESS_DERIVED' | 'USER_ENTERED' | 'NOT_PROVIDED' } {
  const manual = manualStreetName?.trim();
  if (manual) return { value: manual, source: 'USER_ENTERED' };

  const firstSegment = address?.split(',')[0]?.trim() ?? '';
  const streetPattern = /\b(jl\.?|jalan|street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?)\b/i;
  if (!firstSegment || !streetPattern.test(firstSegment)) {
    return { value: STREET_NAME_FALLBACK, source: 'NOT_PROVIDED' };
  }

  const cleaned = firstSegment
    .replace(/\s+(no\.?|number|#)\s*[\w/-]+.*$/i, '')
    .trim();
  const descriptivePart = cleaned.replace(streetPattern, '').replace(/[.\s]/g, '');
  return descriptivePart
    ? { value: cleaned, source: 'ADDRESS_DERIVED' }
    : { value: STREET_NAME_FALLBACK, source: 'NOT_PROVIDED' };
}
