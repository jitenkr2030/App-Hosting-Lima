import { db } from '../src/lib/db';
import { UserRole, BillingPlan, BillingCycle, AppStatus, DeploymentStatus, BackupStatus, SnapshotStatus } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

async function seedDemoData() {
  console.log('🌱 Seeding demo data...');

  try {
    // Create demo users
    const users = await Promise.all([
      db.user.create({
        data: {
          email: 'admin@limahost.com',
          name: 'Admin User',
          password: await hashPassword('admin123'),
          role: UserRole.SUPER_ADMIN,
          isActive: true,
          emailVerified: true,
        },
      }),
      db.user.create({
        data: {
          email: 'john@example.com',
          name: 'John Doe',
          password: await hashPassword('john123'),
          role: UserRole.USER,
          isActive: true,
          emailVerified: true,
        },
      }),
      db.user.create({
        data: {
          email: 'sarah@techstart.com',
          name: 'Sarah Johnson',
          password: await hashPassword('sarah123'),
          role: UserRole.ADMIN,
          isActive: true,
          emailVerified: true,
        },
      }),
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create billing info for users
    const billingInfo = await Promise.all([
      db.billingInfo.create({
        data: {
          userId: users[0].id,
          plan: BillingPlan.ENTERPRISE,
          billingCycle: BillingCycle.YEARLY,
          isActive: true,
        },
      }),
      db.billingInfo.create({
        data: {
          userId: users[1].id,
          plan: BillingPlan.BASIC,
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
      }),
      db.billingInfo.create({
        data: {
          userId: users[2].id,
          plan: BillingPlan.PRO,
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
      }),
    ]);

    console.log(`✅ Created billing info for ${billingInfo.length} users`);

    // Create demo apps
    const apps = await Promise.all([
      db.app.create({
        data: {
          name: 'Web App Production',
          description: 'Main production web application',
          status: AppStatus.RUNNING,
          template: 'webapp',
          domain: 'webapp.example.com',
          config: JSON.stringify({
            cpu: 2,
            memory: 4,
            disk: 20,
            dockerImage: 'nginx:latest',
            envVars: {
              NODE_ENV: 'production',
              PORT: '8080',
            },
            ports: [
              { guest: 80, host: 8080, protocol: 'http' },
              { guest: 443, host: 8443, protocol: 'https' },
            ],
          }),
          userId: users[1].id,
        },
      }),
      db.app.create({
        data: {
          name: 'API Service',
          description: 'REST API for mobile applications',
          status: AppStatus.RUNNING,
          template: 'api',
          domain: 'api.example.com',
          config: JSON.stringify({
            cpu: 1,
            memory: 2,
            disk: 10,
            dockerImage: 'node:18-alpine',
            envVars: {
              NODE_ENV: 'production',
              PORT: '3000',
              API_VERSION: 'v1',
            },
            ports: [
              { guest: 3000, host: 3000, protocol: 'http' },
            ],
          }),
          userId: users[1].id,
        },
      }),
      db.app.create({
        data: {
          name: 'Database Server',
          description: 'PostgreSQL database for applications',
          status: AppStatus.RUNNING,
          template: 'database',
          domain: 'db.example.com',
          config: JSON.stringify({
            cpu: 4,
            memory: 8,
            disk: 50,
            dockerImage: 'postgres:15',
            envVars: {
              POSTGRES_DB: 'appdb',
              POSTGRES_USER: 'admin',
              POSTGRES_PASSWORD: 'secret',
            },
            ports: [
              { guest: 5432, host: 5432, protocol: 'tcp' },
            ],
          }),
          userId: users[2].id,
        },
      }),
      db.app.create({
        data: {
          name: 'Development Environment',
          description: 'Development and testing environment',
          status: AppStatus.RUNNING,
          template: 'dev',
          domain: 'dev.example.com',
          config: JSON.stringify({
            cpu: 1,
            memory: 2,
            disk: 15,
            dockerImage: 'ubuntu:22.04',
            envVars: {
              DEV_USER: 'developer',
              DEV_MODE: 'true',
            },
            ports: [
              { guest: 22, host: 2222, protocol: 'ssh' },
              { guest: 8080, host: 8081, protocol: 'http' },
            ],
          }),
          userId: users[2].id,
        },
      }),
    ]);

    console.log(`✅ Created ${apps.length} applications`);

    // Create deployments
    const deployments = await Promise.all([
      db.deployment.create({
        data: {
          appId: apps[0].id,
          status: DeploymentStatus.SUCCESS,
          version: 'v1.2.3',
          logs: 'Deployment completed successfully',
        },
      }),
      db.deployment.create({
        data: {
          appId: apps[1].id,
          status: DeploymentStatus.SUCCESS,
          version: 'v2.1.0',
          logs: 'API deployment successful',
        },
      }),
      db.deployment.create({
        data: {
          appId: apps[2].id,
          status: DeploymentStatus.SUCCESS,
          version: 'v15.0',
          logs: 'Database initialized and running',
        },
      }),
    ]);

    console.log(`✅ Created ${deployments.length} deployments`);

    // Create backups
    const backups = await Promise.all([
      db.backup.create({
        data: {
          appId: apps[0].id,
          filename: 'webapp-backup-2024-01-15.tar.gz',
          size: 1024 * 1024 * 100, // 100MB
          status: BackupStatus.COMPLETED,
        },
      }),
      db.backup.create({
        data: {
          appId: apps[2].id,
          filename: 'database-backup-2024-01-15.sql',
          size: 1024 * 1024 * 500, // 500MB
          status: BackupStatus.COMPLETED,
        },
      }),
    ]);

    console.log(`✅ Created ${backups.length} backups`);

    // Create snapshots
    const snapshots = await Promise.all([
      db.snapshot.create({
        data: {
          appId: apps[3].id,
          name: 'Development Environment Snapshot',
          size: 1024 * 1024 * 200, // 200MB
          status: SnapshotStatus.COMPLETED,
        },
      }),
    ]);

    console.log(`✅ Created ${snapshots.length} snapshots`);

    // Create usage records
    const usageRecords = await Promise.all([
      // App count usage
      db.usageRecord.create({
        data: {
          userId: users[1].id,
          appId: apps[0].id,
          metric: 'app_count',
          value: 2,
          unit: 'count',
        },
      }),
      db.usageRecord.create({
        data: {
          userId: users[2].id,
          appId: apps[2].id,
          metric: 'app_count',
          value: 2,
          unit: 'count',
        },
      }),
      // Storage usage
      db.usageRecord.create({
        data: {
          userId: users[1].id,
          appId: apps[0].id,
          metric: 'storage_gb',
          value: 20,
          unit: 'GB',
        },
      }),
      db.usageRecord.create({
        data: {
          userId: users[1].id,
          appId: apps[1].id,
          metric: 'storage_gb',
          value: 10,
          unit: 'GB',
        },
      }),
      db.usageRecord.create({
        data: {
          userId: users[2].id,
          appId: apps[2].id,
          metric: 'storage_gb',
          value: 50,
          unit: 'GB',
        },
      }),
      // CPU usage
      db.usageRecord.create({
        data: {
          userId: users[1].id,
          appId: apps[0].id,
          metric: 'cpu_cores',
          value: 2,
          unit: 'cores',
        },
      }),
      db.usageRecord.create({
        data: {
          userId: users[2].id,
          appId: apps[2].id,
          metric: 'cpu_cores',
          value: 4,
          unit: 'cores',
        },
      }),
      // Memory usage
      db.usageRecord.create({
        data: {
          userId: users[1].id,
          appId: apps[0].id,
          metric: 'memory_gb',
          value: 4,
          unit: 'GB',
        },
      }),
      db.usageRecord.create({
        data: {
          userId: users[2].id,
          appId: apps[2].id,
          metric: 'memory_gb',
          value: 8,
          unit: 'GB',
        },
      }),
    ]);

    console.log(`✅ Created ${usageRecords.length} usage records`);

    // Create audit logs
    const auditLogs = await Promise.all([
      // User registration logs
      db.auditLog.create({
        data: {
          userId: users[0].id,
          action: 'user.register',
          resource: 'user',
          resourceId: users[0].id,
          details: 'Super admin user registered',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }),
      db.auditLog.create({
        data: {
          userId: users[1].id,
          action: 'user.register',
          resource: 'user',
          resourceId: users[1].id,
          details: 'Regular user registered',
          ipAddress: '192.168.1.2',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }),
      // App creation logs
      db.auditLog.create({
        data: {
          userId: users[1].id,
          appId: apps[0].id,
          action: 'app.create',
          resource: 'app',
          resourceId: apps[0].id,
          details: 'Created Web App Production',
          ipAddress: '192.168.1.2',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }),
      db.auditLog.create({
        data: {
          userId: users[2].id,
          appId: apps[2].id,
          action: 'app.create',
          resource: 'app',
          resourceId: apps[2].id,
          details: 'Created Database Server',
          ipAddress: '192.168.1.3',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        },
      }),
      // Deployment logs
      db.auditLog.create({
        data: {
          userId: users[1].id,
          appId: apps[0].id,
          action: 'app.deploy',
          resource: 'deployment',
          resourceId: deployments[0].id,
          details: 'Deployed Web App Production v1.2.3',
          ipAddress: '192.168.1.2',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }),
      // Backup logs
      db.auditLog.create({
        data: {
          userId: users[1].id,
          appId: apps[0].id,
          action: 'backup.create',
          resource: 'backup',
          resourceId: backups[0].id,
          details: 'Created backup for Web App Production',
          ipAddress: '192.168.1.2',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }),
    ]);

    console.log(`✅ Created ${auditLogs.length} audit logs`);

    // Create sessions
    const sessions = await Promise.all([
      db.session.create({
        data: {
          userId: users[0].id,
          token: 'demo-token-admin',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      }),
      db.session.create({
        data: {
          userId: users[1].id,
          token: 'demo-token-john',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      }),
      db.session.create({
        data: {
          userId: users[2].id,
          token: 'demo-token-sarah',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      }),
    ]);

    console.log(`✅ Created ${sessions.length} sessions`);

    console.log('🎉 Demo data seeded successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('Super Admin: admin@limahost.com / admin123');
    console.log('Regular User: john@example.com / john123');
    console.log('Admin User: sarah@techstart.com / sarah123');
    console.log('\n🔑 Demo Tokens (for testing):');
    console.log('Admin: demo-token-admin');
    console.log('John: demo-token-john');
    console.log('Sarah: demo-token-sarah');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  }
}

// Run the seeding
seedDemoData()
  .catch((error) => {
    console.error('Failed to seed demo data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });