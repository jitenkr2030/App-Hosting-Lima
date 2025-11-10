import { NextRequest, NextResponse } from 'next/server'

// Mock database - in a real app, this would be shared
let apps = [
  {
    id: "1",
    name: "Web App Production",
    status: "running",
    cpu: 2,
    memory: 4,
    disk: 20,
    domain: "webapp.example.com",
    template: "webapp-template",
    createdAt: "2024-01-15",
    ipAddress: "192.168.64.2",
    dockerImage: "nginx:latest",
    envVars: {
      "NODE_ENV": "production",
      "PORT": "8080",
      "DATABASE_URL": "postgresql://user:pass@db:5432/app"
    },
    ports: [
      { guest: 80, host: 8080, protocol: "http" },
      { guest: 443, host: 8443, protocol: "https" }
    ]
  },
  {
    id: "2", 
    name: "API Service",
    status: "running",
    cpu: 1,
    memory: 2,
    disk: 10,
    domain: "api.example.com",
    template: "api-template",
    createdAt: "2024-01-10",
    ipAddress: "192.168.64.3",
    dockerImage: "node:18-alpine",
    envVars: {
      "NODE_ENV": "production",
      "PORT": "3000",
      "API_VERSION": "v1"
    },
    ports: [
      { guest: 3000, host: 3000, protocol: "http" }
    ]
  }
]

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const app = apps.find(a => a.id === params.id)
    
    if (!app) {
      return NextResponse.json(
        { success: false, error: 'App not found' },
        { status: 404 }
      )
    }

    // Validate required fields
    if (!body.cpu && !body.memory && !body.disk) {
      return NextResponse.json(
        { success: false, error: 'At least one of cpu, memory, or disk must be specified' },
        { status: 400 }
      )
    }

    const oldResources = { cpu: app.cpu, memory: app.memory, disk: app.disk }
    
    // Update resources
    if (body.cpu) app.cpu = body.cpu
    if (body.memory) app.memory = body.memory
    if (body.disk) app.disk = body.disk

    // Update status to indicate scaling is in progress
    app.status = "deploying" // In a real app, you might have a "scaling" status

    // In a real implementation, this would:
    // 1. Generate new Lima YAML with updated resources
    // 2. Stop the current VM
    // 3. Create new VM with new configuration
    // 4. Restore data from backup if needed
    // 5. Deploy the application again

    // Simulate scaling process
    setTimeout(() => {
      app.status = "running"
    }, 10000) // Simulate 10 second scaling process

    return NextResponse.json({
      success: true,
      message: 'Scaling started successfully',
      data: {
        appId: params.id,
        oldResources,
        newResources: { cpu: app.cpu, memory: app.memory, disk: app.disk },
        status: "scaling",
        estimatedDuration: 10000,
        scalingId: `scale-${Date.now()}`
      }
    })
  } catch (error) {
    console.error('Error scaling app:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to scale app' },
      { status: 500 }
    )
  }
}