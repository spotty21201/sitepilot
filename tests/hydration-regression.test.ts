import { beforeEach, describe, expect, it } from 'vitest';
import { getHydrationSafeInitialCases } from '@/app/page';
import { createCase } from '@/lib/storage/case-repository';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';

describe('decision-room hydration boundary', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the first browser render identical to SSR even when browser cases exist', () => {
    createCase({ name: 'Stored browser case', address: 'Synthetic address', grossSiteArea: 12_000 });
    const initial = getHydrationSafeInitialCases();
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({ id: GOLDEN_PROJECT.id, name: GOLDEN_PROJECT.name });
    expect(JSON.stringify(initial)).not.toContain('Stored browser case');
  });
});
