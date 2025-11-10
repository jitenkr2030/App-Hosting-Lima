import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from './auth';
import { UserRole } from '@prisma/client';
import { db } from './db';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export async function authenticate(request: NextRequest): Promise<AuthenticatedRequest | NextResponse> {
  const token = extractTokenFromHeader(request.headers.get('authorization'));
  
  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Verify user exists and is active
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, role: true, isActive: true }
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'User not found or inactive' }, { status: 401 });
  }

  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.user = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  return authenticatedRequest;
}

export function authorize(requiredRole: UserRole) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const authResult = await authenticate(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const authenticatedRequest = authResult as AuthenticatedRequest;
    
    if (!hasPermission(authenticatedRequest.user!.role, requiredRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    return null;
  };
}

function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.USER]: 0,
    [UserRole.ADMIN]: 1,
    [UserRole.SUPER_ADMIN]: 2,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}