import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { plotPointId: string } }
) {
  try {
    const { plotPointId } = params;

    const subNarratives = db
      .prepare('SELECT * FROM narratives WHERE plot_point_id = ? AND narrative_type = ? ORDER BY created_at ASC')
      .all(plotPointId, 'sub');

    return NextResponse.json({ subNarratives });
  } catch (error) {
    console.error('GET /api/plot-points/[id]/sub-narratives error:', error);
    return NextResponse.json({ error: 'Failed to fetch sub-narratives' }, { status: 500 });
  }
}
