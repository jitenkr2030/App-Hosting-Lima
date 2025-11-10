import { NextRequest, NextResponse } from 'next/server'

// Mock database - in a real app, this would be shared with the main apps route
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const app = apps.find(a => a.id === params.id)
    
    if (!app) {
      return NextResponse.json(
        { success: false, error: 'App not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: app
    })
  } catch (error) {
    console.error('Error fetching app:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch app' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const appIndex = apps.findIndex(a => a.id === params.id)
    
    if (appIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'App not found' },
        { status: 404 }
      )
    }

    const deletedApp = apps[appIndex]
    apps.splice(appIndex, 1)

    // In a real implementation, this would:
    // 1. Stop the VM
    // 2. Remove VM files
    // 3. Clean up networking
    // 4. Remove from load balancer

    return NextResponse.json({
      success: true,
      message: 'App deleted successfully',
      data: deletedApp
    })
  } catch (error) {
    console.error('Error deleting app:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete app' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const appIndex = apps.findIndex(a => a.id === params.id)
    
    if (appIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'App not found' },
        { status: 404 }
      )
    }

    const app = apps[appIndex]
    
    // Update allowed fields
    const allowedFields = ['name', 'domain', 'envVars']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        app[field] = body[field]
      }
    }

    // In a real implementation, this would update the VM configuration
    // and potentially restart the VM if needed

    return NextResponse.json({
      success: true,
      data: app,
      message: 'App updated successfully'
    })
  } catch (error) {
    console.error('Error updating app:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update app' },
      { status: 500 }
    )
  }
}