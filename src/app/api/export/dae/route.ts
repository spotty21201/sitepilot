import { NextRequest, NextResponse } from 'next/server';
import { exportToColladaDAE } from '@/lib/geometry/engine';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { BuildingMass, SiteGeometry } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('scenarioId') || GOLDEN_PROJECT.scenarios[1].id;
    const floorsParam = searchParams.get('floors');
    const setbackParam = searchParams.get('setback');
    const siteAreaParam = searchParams.get('siteArea');
    const projectNameParam = searchParams.get('projectName');
    const addressParam = searchParams.get('address');

    // Only fallback to Golden Project if specifically requesting a Golden Project scenario ID
    const isGoldenScenario = GOLDEN_PROJECT.scenarios.some(s => s.id === scenarioId);
    const scenario = isGoldenScenario
      ? (GOLDEN_PROJECT.scenarios.find(s => s.id === scenarioId) || GOLDEN_PROJECT.scenarios[1])
      : null;

    const siteArea = siteAreaParam ? parseFloat(siteAreaParam) : (scenario ? GOLDEN_PROJECT.site.grossSiteArea : 10000);
    const frontSetback = setbackParam ? parseFloat(setbackParam) : (scenario ? scenario.assumptionsUsed.setbacks.front : 8);
    const effectiveSetbacks = scenario 
      ? { ...scenario.assumptionsUsed.setbacks, front: frontSetback }
      : { front: frontSetback, rear: 5, sideLeft: 4, sideRight: 4 };

    let masses: BuildingMass[] = scenario ? scenario.masses : [
      {
        id: 'mass-export-01',
        name: 'Main Block',
        type: 'GENERAL',
        footprintArea: Math.round(siteArea * 0.4),
        floors: floorsParam ? parseInt(floorsParam, 10) : 4,
        floorToFloorHeight: 3.5,
        height: (floorsParam ? parseInt(floorsParam, 10) : 4) * 3.5,
        gfa: Math.round(siteArea * 0.4) * (floorsParam ? parseInt(floorsParam, 10) : 4),
        program: 'COMMERCIAL',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { width: 50, length: 80, height: (floorsParam ? parseInt(floorsParam, 10) : 4) * 3.5 }
      }
    ];

    if (scenario && floorsParam) {
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

    const currentFloors = floorsParam ? parseInt(floorsParam, 10) : (scenario ? scenario.metrics.totalFloors : 4);
    const baseName = projectNameParam 
      ? projectNameParam.replace(/[^a-zA-Z0-9_-]/g, '_')
      : (scenario ? scenario.name.split(':')[0].replace(/[^a-zA-Z0-9_-]/g, '_') : 'Scenario');
    const filename = `SitePilot_${baseName}_${currentFloors}Fl.dae`;

    const targetSite: SiteGeometry = isGoldenScenario 
      ? { ...GOLDEN_PROJECT.site, grossSiteArea: siteArea, setbacks: effectiveSetbacks }
      : { 
          boundary: { type: 'Polygon', coordinates: [[[0,0], [100,0], [100,100], [0,100], [0,0]]] },
          grossSiteArea: siteArea, 
          buildableArea: siteArea * 0.8,
          coordinateSystem: 'WGS84',
          address: addressParam || 'Site Parcel', 
          setbacks: effectiveSetbacks 
        };

    const daeXml = exportToColladaDAE(
      targetSite,
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

    if (!site || !masses || !Array.isArray(masses)) {
      return NextResponse.json(
        { error: 'Invalid request: "site" and "masses" are required for dynamic DAE export.' },
        { status: 400 }
      );
    }

    const exportName = scenarioName || 'SitePilot_Scenario';
    const filename = `${exportName.replace(/[^a-zA-Z0-9_-]/g, '_')}.dae`;

    const daeXml = exportToColladaDAE(
      site,
      masses,
      exportName,
      setbacks || site.setbacks
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
