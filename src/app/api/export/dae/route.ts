import { NextRequest, NextResponse } from 'next/server';
import { exportToColladaDAE } from '@/lib/geometry/engine';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { BuildingMass } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('scenarioId') || GOLDEN_PROJECT.scenarios[1].id;
    const floorsParam = searchParams.get('floors');
    const setbackParam = searchParams.get('setback');
    const siteAreaParam = searchParams.get('siteArea');

    const scenario = GOLDEN_PROJECT.scenarios.find(s => s.id === scenarioId) || GOLDEN_PROJECT.scenarios[1];
    const siteArea = siteAreaParam ? parseFloat(siteAreaParam) : GOLDEN_PROJECT.site.grossSiteArea;
    const frontSetback = setbackParam ? parseFloat(setbackParam) : scenario.assumptionsUsed.setbacks.front;
    const effectiveSetbacks = { ...scenario.assumptionsUsed.setbacks, front: frontSetback };

    let masses: BuildingMass[] = scenario.masses;

    if (floorsParam) {
      const floors = parseInt(floorsParam, 10);
      masses = masses.map(m => {
        const newFloors = m.type === 'PODIUM' ? Math.min(2, floors) : Math.max(1, floors - (scenario.masses.some(x => x.type === 'PODIUM') ? 2 : 0));
        const h = newFloors * (m.floorToFloorHeight || 3.5);
        return {
          ...m,
          floors: newFloors,
          height: h,
          gfa: m.footprintArea * newFloors,
          dimensions: { ...m.dimensions, height: h }
        };
      });
    }

    const originalFloors = scenario.id === 'scen-001' ? 4 : scenario.id === 'scen-002' ? 8 : 12;
    const currentFloors = floorsParam ? parseInt(floorsParam, 10) : scenario.metrics.totalFloors;
    const isOverridden = currentFloors !== originalFloors;

    const baseName = scenario.name.split(':')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `SitePilot_${baseName}_${currentFloors}Fl${isOverridden ? '_Override' : ''}.dae`;

    const daeXml = exportToColladaDAE(
      { ...GOLDEN_PROJECT.site, grossSiteArea: siteArea, setbacks: effectiveSetbacks },
      masses,
      filename.replace('.dae', ''),
      effectiveSetbacks
    );

    return new NextResponse(daeXml, {
      status: 200,
      headers: {
        'Content-Type': 'model/vnd.collada+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('Error exporting DAE via GET:', error);
    return NextResponse.json({ error: 'Failed to generate COLLADA DAE export' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { site, masses, scenarioName, setbacks } = body;

    const exportName = scenarioName || 'SitePilot_Scenario';
    const filename = `${exportName}.dae`;

    const daeXml = exportToColladaDAE(
      site || GOLDEN_PROJECT.site,
      masses || GOLDEN_PROJECT.scenarios[1].masses,
      exportName,
      setbacks
    );

    return new NextResponse(daeXml, {
      status: 200,
      headers: {
        'Content-Type': 'model/vnd.collada+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('Error exporting DAE via POST:', error);
    return NextResponse.json({ error: 'Failed to generate COLLADA DAE export' }, { status: 500 });
  }
}
