import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware';
import { getUserBillingInfo, getUsageSummary } from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user!;

    // Get billing info
    const billingInfo = await getUserBillingInfo(user.id);
    
    // Get current usage summary
    const usageSummary = await getUsageSummary(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      billing: billingInfo,
      usage: usageSummary,
    });
  } catch (error) {
    console.error('Get user info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}