import { db } from './db';
import { BillingPlan, BillingCycle } from '@prisma/client';

export interface UsageData {
  userId: string;
  appId?: string;
  metric: string;
  value: number;
  unit: string;
  recordedAt?: Date;
}

export interface BillingInfo {
  userId: string;
  plan: BillingPlan;
  billingCycle: BillingCycle;
  stripeCustomerId?: string;
  isActive: boolean;
}

export interface UsageLimits {
  maxApps: number;
  maxStorage: number; // in GB
  maxBandwidth: number; // in GB
  maxCpu: number; // in cores
  maxMemory: number; // in GB
  customDomains: boolean;
  ssl: boolean;
  backups: boolean;
  support: string;
}

export const PLAN_LIMITS: Record<BillingPlan, UsageLimits> = {
  [BillingPlan.FREE]: {
    maxApps: 1,
    maxStorage: 1,
    maxBandwidth: 10,
    maxCpu: 1,
    maxMemory: 1,
    customDomains: false,
    ssl: false,
    backups: false,
    support: 'community',
  },
  [BillingPlan.BASIC]: {
    maxApps: 3,
    maxStorage: 5,
    maxBandwidth: 50,
    maxCpu: 2,
    maxMemory: 2,
    customDomains: true,
    ssl: true,
    backups: true,
    support: 'email',
  },
  [BillingPlan.PRO]: {
    maxApps: 10,
    maxStorage: 20,
    maxBandwidth: 200,
    maxCpu: 4,
    maxMemory: 4,
    customDomains: true,
    ssl: true,
    backups: true,
    support: 'priority',
  },
  [BillingPlan.ENTERPRISE]: {
    maxApps: -1, // unlimited
    maxStorage: -1,
    maxBandwidth: -1,
    maxCpu: -1,
    maxMemory: -1,
    customDomains: true,
    ssl: true,
    backups: true,
    support: 'dedicated',
  },
};

export async function recordUsage(data: UsageData) {
  try {
    await db.usageRecord.create({
      data: {
        userId: data.userId,
        appId: data.appId,
        metric: data.metric,
        value: data.value,
        unit: data.unit,
        recordedAt: data.recordedAt || new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to record usage:', error);
  }
}

export async function getUserUsage(userId: string, startDate?: Date, endDate?: Date) {
  const where: any = { userId };
  
  if (startDate || endDate) {
    where.recordedAt = {};
    if (startDate) where.recordedAt.gte = startDate;
    if (endDate) where.recordedAt.lte = endDate;
  }

  return db.usageRecord.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
  });
}

export async function getAppUsage(appId: string, startDate?: Date, endDate?: Date) {
  const where: any = { appId };
  
  if (startDate || endDate) {
    where.recordedAt = {};
    if (startDate) where.recordedAt.gte = startDate;
    if (endDate) where.recordedAt.lte = endDate;
  }

  return db.usageRecord.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
  });
}

export async function getUsageSummary(userId: string, startDate?: Date, endDate?: Date) {
  const usage = await getUserUsage(userId, startDate, endDate);
  
  const summary = {
    totalApps: 0,
    totalStorage: 0,
    totalBandwidth: 0,
    totalCpu: 0,
    totalMemory: 0,
  };

  usage.forEach(record => {
    switch (record.metric) {
      case 'app_count':
        summary.totalApps += record.value;
        break;
      case 'storage_gb':
        summary.totalStorage += record.value;
        break;
      case 'bandwidth_gb':
        summary.totalBandwidth += record.value;
        break;
      case 'cpu_cores':
        summary.totalCpu += record.value;
        break;
      case 'memory_gb':
        summary.totalMemory += record.value;
        break;
    }
  });

  return summary;
}

export async function getUserBillingInfo(userId: string): Promise<BillingInfo | null> {
  const billing = await db.billingInfo.findUnique({
    where: { userId },
  });

  if (!billing) return null;

  return {
    userId: billing.userId,
    plan: billing.plan,
    billingCycle: billing.billingCycle,
    stripeCustomerId: billing.stripeCustomerId || undefined,
    isActive: billing.isActive,
  };
}

export async function updateUserBillingInfo(userId: string, updates: Partial<BillingInfo>) {
  return db.billingInfo.upsert({
    where: { userId },
    update: updates,
    create: {
      userId,
      plan: updates.plan || BillingPlan.FREE,
      billingCycle: updates.billingCycle || BillingCycle.MONTHLY,
      stripeCustomerId: updates.stripeCustomerId,
      isActive: updates.isActive ?? true,
    },
  });
}

export async function checkUsageLimits(userId: string): Promise<{
  withinLimits: boolean;
  violations: string[];
  currentUsage: any;
  limits: UsageLimits;
}> {
  const billingInfo = await getUserBillingInfo(userId);
  if (!billingInfo) {
    return {
      withinLimits: false,
      violations: ['No billing information found'],
      currentUsage: {},
      limits: PLAN_LIMITS[BillingPlan.FREE],
    };
  }

  const limits = PLAN_LIMITS[billingInfo.plan];
  const currentUsage = await getUsageSummary(userId);
  const violations: string[] = [];

  if (limits.maxApps !== -1 && currentUsage.totalApps > limits.maxApps) {
    violations.push(`App limit exceeded: ${currentUsage.totalApps}/${limits.maxApps}`);
  }
  if (limits.maxStorage !== -1 && currentUsage.totalStorage > limits.maxStorage) {
    violations.push(`Storage limit exceeded: ${currentUsage.totalStorage}GB/${limits.maxStorage}GB`);
  }
  if (limits.maxBandwidth !== -1 && currentUsage.totalBandwidth > limits.maxBandwidth) {
    violations.push(`Bandwidth limit exceeded: ${currentUsage.totalBandwidth}GB/${limits.maxBandwidth}GB`);
  }
  if (limits.maxCpu !== -1 && currentUsage.totalCpu > limits.maxCpu) {
    violations.push(`CPU limit exceeded: ${currentUsage.totalCpu}/${limits.maxCpu} cores`);
  }
  if (limits.maxMemory !== -1 && currentUsage.totalMemory > limits.maxMemory) {
    violations.push(`Memory limit exceeded: ${currentUsage.totalMemory}GB/${limits.maxMemory}GB`);
  }

  return {
    withinLimits: violations.length === 0,
    violations,
    currentUsage,
    limits,
  };
}

export async function getMonthlyUsageReport(userId: string, year?: number, month?: number) {
  const now = new Date();
  const reportYear = year || now.getFullYear();
  const reportMonth = month || now.getMonth();
  
  const startDate = new Date(reportYear, reportMonth, 1);
  const endDate = new Date(reportYear, reportMonth + 1, 0);

  const usage = await getUserUsage(userId, startDate, endDate);
  const summary = await getUsageSummary(userId, startDate, endDate);

  return {
    period: {
      year: reportYear,
      month: reportMonth,
      startDate,
      endDate,
    },
    summary,
    detailedUsage: usage,
  };
}