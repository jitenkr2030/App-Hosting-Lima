import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware';
import { recordUsage, getUserUsage, getAppUsage, getUsageSummary } from '@/lib/billing';
import { z } from 'zod';

const recordUsageSchema = z.object({
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
  appId: z.string().optional(),
  recordedAt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user!;

    const body = await request.json();
    const { metric, value, unit, appId, recordedAt } = recordUsageSchema.parse(body);

    // Record usage
    await recordUsage({
      userId: user.id,
      appId,
      metric,
      value,
      unit,
      recordedAt: recordedAt ? new Date(recordedAt) : undefined,
    });

    return NextResponse.json({
      message: 'Usage recorded successfully',
    });
  } catch (error) {
    console.error('Record usage error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user!;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      // Get usage summary
      const usageSummary = await getUsageSummary(
        user.id,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      return NextResponse.json({
        summary: usageSummary,
      });
    }

    // Get detailed usage
    let usage;
    if (appId) {
      usage = await getAppUsage(
        appId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
    } else {
      usage = await getUserUsage(
        user.id,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
    }

    return NextResponse.json({
      usage,
    });
  } catch (error) {
    console.error('Get usage error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}