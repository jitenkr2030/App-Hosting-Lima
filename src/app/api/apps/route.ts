import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/middleware'
import { createAuditLog, AuditActions } from '@/lib/audit'
import { AppStatus } from '@prisma/client'
import { z } from 'zod'

const createAppSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  domain: z.string().optional(),
  template: z.string().min(1),
  config: z.object({
    cpu: z.number().min(1).max(16),
    memory: z.number().min(1).max(64),
    disk: z.number().min(1).max(1000),
    dockerImage: z.string().min(1),
    envVars: z.record(z.string()).optional(),
    ports: z.array(z.object({
      guest: z.number(),
      host: z.number(),
      protocol: z.string()
    })).optional()
  })
})

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const authenticatedRequest = authResult as any
    const user = authenticatedRequest.user

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let whereClause: any = { userId: user.id }

    // Filter by status if provided
    if (status && status !== 'all') {
      whereClause.status = status
    }

    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase()
      whereClause.OR = [
        { name: { contains: searchLower } },
        { domain: { contains: searchLower } }
      ]
    }

    const apps = await db.app.findMany({
      where: whereClause,
      include: {
        deployments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: {
            backups: true,
            snapshots: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform the data to match the expected format
    const transformedApps = apps.map(app => ({
      id: app.id,
      name: app.name,
      description: app.description,
      status: app.status,
      template: app.template,
      domain: app.domain,
      createdAt: app.createdAt.toISOString().split('T')[0],
      config: JSON.parse(app.config),
      deployments: app.deployments,
      backupsCount: app._count.backups,
      snapshotsCount: app._count.snapshots
    }))

    return NextResponse.json({
      success: true,
      data: transformedApps,
      total: transformedApps.length
    })
  } catch (error) {
    console.error('Error fetching apps:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch apps' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const authenticatedRequest = authResult as any
    const user = authenticatedRequest.user

    const body = await request.json()
    const validatedData = createAppSchema.parse(body)

    // Check user's current app count against their plan limits
    const userAppsCount = await db.app.count({
      where: { userId: user.id }
    })

    // Get user's billing info to check limits
    const billingInfo = await db.billingInfo.findUnique({
      where: { userId: user.id }
    })

    // Define plan limits (in a real app, this would come from a config or database)
    const planLimits = {
      FREE: 1,
      BASIC: 3,
      PRO: 10,
      ENTERPRISE: Infinity
    }

    const userLimit = planLimits[billingInfo?.plan || 'FREE']

    if (userAppsCount >= userLimit) {
      return NextResponse.json(
        { 
          success: false, 
          error: `App limit reached. Your ${billingInfo?.plan || 'FREE'} plan allows ${userLimit} apps.` 
        },
        { status: 403 }
      )
    }

    // Create new app
    const newApp = await db.app.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        domain: validatedData.domain,
        template: validatedData.template,
        status: AppStatus.CREATING,
        config: JSON.stringify(validatedData.config),
        userId: user.id
      },
      include: {
        deployments: true,
        backups: true,
        snapshots: true
      }
    })

    // Create initial deployment record
    await db.deployment.create({
      data: {
        appId: newApp.id,
        status: 'PENDING',
        version: 'v1.0.0',
        logs: 'Deployment queued...'
      }
    })

    // Log audit
    await createAuditLog({
      userId: user.id,
      appId: newApp.id,
      action: AuditActions.APP_CREATE,
      resource: 'app',
      resourceId: newApp.id,
      details: `Created app: ${validatedData.name} with template: ${validatedData.template}`,
      ipAddress: request.headers.get('x-forwarded-for') || request.ip,
      userAgent: request.headers.get('user-agent'),
    })

    // TODO: In a real implementation, this would trigger:
    // 1. Generate Lima YAML based on template
    // 2. Send command to agent to create VM
    // 3. Deploy Docker image inside VM
    // 4. Set up networking and domain

    // Transform the response to match expected format
    const transformedApp = {
      id: newApp.id,
      name: newApp.name,
      description: newApp.description,
      status: newApp.status,
      template: newApp.template,
      domain: newApp.domain,
      createdAt: newApp.createdAt.toISOString().split('T')[0],
      config: JSON.parse(newApp.config),
      deployments: newApp.deployments,
      backupsCount: newApp.backups.length,
      snapshotsCount: newApp.snapshots.length
    }

    return NextResponse.json({
      success: true,
      data: transformedApp,
      message: 'App created successfully and deployment queued'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating app:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create app' },
      { status: 500 }
    )
  }
}