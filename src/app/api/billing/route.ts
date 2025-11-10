import { NextRequest, NextResponse } from 'next/server';
import { authenticate, authorize } from '@/lib/middleware';
import { getUserBillingInfo, updateUserBillingInfo, checkUsageLimits, getMonthlyUsageReport } from '@/lib/billing';
import { BillingPlan, BillingCycle, UserRole } from '@prisma/client';
import { z } from 'zod';

const updateBillingSchema = z.object({
  plan: z.enum(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']).optional(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
  stripeCustomerId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user!;

    // Get billing info
    const billingInfo = await getUserBillingInfo(user.id);
    
    // Check usage limits
    const usageCheck = await checkUsageLimits(user.id);
    
    // Get monthly usage report
    const monthlyReport = await getMonthlyUsageReport(user.id);

    return NextResponse.json({
      billing: billingInfo,
      usage: usageCheck,
      monthlyReport,
    });
  } catch (error) {
    console.error('Get billing info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user!;

    // Only admins can update billing plans
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { plan, billingCycle, stripeCustomerId } = updateBillingSchema.parse(body);

    // Update billing info
    const updatedBilling = await updateUserBillingInfo(user.id, {
      plan: plan as BillingPlan,
      billingCycle: billingCycle as BillingCycle,
      stripeCustomerId,
    });

    return NextResponse.json({
      billing: updatedBilling,
      message: 'Billing information updated successfully',
    });
  } catch (error) {
    console.error('Update billing info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}