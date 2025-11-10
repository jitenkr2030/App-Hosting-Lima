import { NextRequest, NextResponse } from 'next/server';
import { authenticate, authorize } from '@/lib/middleware';
import { getAuditLogs } from '@/lib/audit';
import { UserRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const authError = await authorize(UserRole.USER)(request);
    if (authError) {
      return authError;
    }

    const authRequest = request as any;
    const user = authRequest.user!;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const appId = searchParams.get('appId');
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build filters
    const filters: any = {
      limit,
      offset,
    };

    // Regular users can only see their own logs
    if (user.role === UserRole.USER) {
      filters.userId = user.id;
    }

    // Admins can filter by user or app
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      if (appId) filters.appId = appId;
    }

    if (action) filters.action = action;
    if (resource) filters.resource = resource;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const { logs, total } = await getAuditLogs(filters);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}