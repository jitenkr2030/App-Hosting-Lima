import { NextRequest, NextResponse } from 'next/server'

// Mock network configs - in a real app, this would be shared
let networkConfigs = [
  {
    id: "network-1",
    domain: "webapp.example.com",
    appId: "1",
    appName: "Web App Production",
    vmName: "webapp-prod",
    vmIp: "192.168.64.2",
    port: 8080,
    sslEnabled: true,
    forceHttps: true,
    status: "active",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-20T15:30:00Z"
  }
]

export async function GET(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const config = networkConfigs.find(c => c.domain === params.domain)
    
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Network configuration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('Error fetching network config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch network config' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const body = await request.json()
    const configIndex = networkConfigs.findIndex(c => c.domain === params.domain)
    
    if (configIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Network configuration not found' },
        { status: 404 }
      )
    }

    const config = networkConfigs[configIndex]
    
    // Update allowed fields
    const allowedFields = ['vmIp', 'port', 'sslEnabled', 'forceHttps', 'status']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        config[field] = body[field]
      }
    }

    config.updatedAt = new Date().toISOString()

    // In a real implementation, this would:
    // 1. Reconfigure load balancer if settings changed
    // 2. Update SSL certificate if SSL settings changed
    // 3. Test connectivity
    // 4. Update DNS records if needed

    return NextResponse.json({
      success: true,
      data: config,
      message: 'Network configuration updated successfully'
    })
  } catch (error) {
    console.error('Error updating network config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update network config' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const configIndex = networkConfigs.findIndex(c => c.domain === params.domain)
    
    if (configIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Network configuration not found' },
        { status: 404 }
      )
    }

    const deletedConfig = networkConfigs[configIndex]
    networkConfigs.splice(configIndex, 1)

    // In a real implementation, this would:
    // 1. Remove load balancer configuration
    // 2. Remove SSL certificate
    // 3. Remove DNS records
    // 4. Clean up any related resources

    return NextResponse.json({
      success: true,
      message: 'Network configuration deleted successfully',
      data: deletedConfig
    })
  } catch (error) {
    console.error('Error deleting network config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete network config' },
      { status: 500 }
    )
  }
}