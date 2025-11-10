import { db } from './db';
import { UserRole } from '@prisma/client';

export interface AuditLogData {
  userId?: string;
  appId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogData) {
  try {
    await db.auditLog.create({
      data: {
        userId: data.userId,
        appId: data.appId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid disrupting the main operation
  }
}

export async function getAuditLogs(filters?: {
  userId?: string;
  appId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (filters?.userId) where.userId = filters.userId;
  if (filters?.appId) where.appId = filters.appId;
  if (filters?.action) where.action = filters.action;
  if (filters?.resource) where.resource = filters.resource;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true }
        },
        app: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    }),
    db.auditLog.count({ where })
  ]);

  return { logs, total };
}

export async function getUserActivity(userId: string, limit: number = 20) {
  return getAuditLogs({ userId, limit });
}

export async function getAppActivity(appId: string, limit: number = 20) {
  return getAuditLogs({ appId, limit });
}

// Common audit actions
export const AuditActions = {
  // User actions
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_REGISTER: 'user.register',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  
  // App actions
  APP_CREATE: 'app.create',
  APP_UPDATE: 'app.update',
  APP_DELETE: 'app.delete',
  APP_DEPLOY: 'app.deploy',
  APP_START: 'app.start',
  APP_STOP: 'app.stop',
  APP_RESTART: 'app.restart',
  
  // Backup actions
  BACKUP_CREATE: 'backup.create',
  BACKUP_RESTORE: 'backup.restore',
  BACKUP_DELETE: 'backup.delete',
  
  // Snapshot actions
  SNAPSHOT_CREATE: 'snapshot.create',
  SNAPSHOT_RESTORE: 'snapshot.restore',
  SNAPSHOT_DELETE: 'snapshot.delete',
  
  // Billing actions
  BILLING_UPDATE: 'billing.update',
  BILLING_CANCEL: 'billing.cancel',
  BILLING_REACTIVATE: 'billing.reactivate',
  
  // Admin actions
  ADMIN_USER_UPDATE: 'admin.user.update',
  ADMIN_USER_DELETE: 'admin.user.delete',
  ADMIN_APP_UPDATE: 'admin.app.update',
  ADMIN_APP_DELETE: 'admin.app.delete',
} as const;