import { NextRequest, NextResponse } from 'next/server'

// Mock agents data
let agents = [
  {
    id: "agent-1",
    name: "Primary Agent",
    host: "server1.example.com",
    ipAddress: "192.168.1.100",
    status: "healthy",
    version: "1.0.0",
    lastHeartbeat: new Date().toISOString(),
    totalVms: 4,
    runningVms: 3,
    cpuUsage: 45,
    memoryUsage: 60,
    diskUsage: 35,
    capabilities: ["qemu", "vz", "containerd"],
    location: "us-east-1",
    createdAt: "2024-01-01"
  },
  {
    id: "agent-2", 
    name: "Secondary Agent",
    host: "server2.example.com",
    ipAddress: "192.168.1.101",
    status: "healthy",
    version: "1.0.0",
    lastHeartbeat: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
    totalVms: 2,
    runningVms: 2,
    cpuUsage: 25,
    memoryUsage: 40,
    diskUsage: 20,
    capabilities: ["qemu", "containerd"],
    location: "us-west-1",
    createdAt: "2024-01-05"
  },
  {
    id: "agent-3",
    name: "Development Agent", 
    host: "dev-server.example.com",
    ipAddress: "192.168.1.102",
    status: "unhealthy",
    version: "0.9.0",
    lastHeartbeat: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    totalVms: 1,
    runningVms: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    capabilities: ["qemu"],
    location: "us-east-1",
    createdAt: "2024-01-10"
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const location = searchParams.get('location')

    let filteredAgents = agents

    // Filter by status if provided
    if (status) {
      filteredAgents = filteredAgents.filter(agent => agent.status === status)
    }

    // Filter by location if provided
    if (location) {
      filteredAgents = filteredAgents.filter(agent => agent.location === location)
    }

    // Calculate overall health metrics
    const totalAgents = agents.length
    const healthyAgents = agents.filter(a => a.status === "healthy").length
    const totalVms = agents.reduce((sum, agent) => sum + agent.totalVms, 0)
    const runningVms = agents.reduce((sum, agent) => sum + agent.runningVms, 0)
    const avgCpuUsage = agents.reduce((sum, agent) => sum + agent.cpuUsage, 0) / totalAgents
    const avgMemoryUsage = agents.reduce((sum, agent) => sum + agent.memoryUsage, 0) / totalAgents

    return NextResponse.json({
      success: true,
      data: filteredAgents,
      metadata: {
        totalAgents,
        healthyAgents,
        unhealthyAgents: totalAgents - healthyAgents,
        totalVms,
        runningVms,
        stoppedVms: totalVms - runningVms,
        avgCpuUsage: Math.round(avgCpuUsage),
        avgMemoryUsage: Math.round(avgMemoryUsage)
      }
    })
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['name', 'host', 'ipAddress', 'capabilities']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    // Check if agent with same host or IP already exists
    const existingAgent = agents.find(a => 
      a.host === body.host || a.ipAddress === body.ipAddress
    )
    
    if (existingAgent) {
      return NextResponse.json(
        { success: false, error: 'Agent with this host or IP already exists' },
        { status: 409 }
      )
    }

    // Create new agent
    const newAgent = {
      id: `agent-${Date.now()}`,
      name: body.name,
      host: body.host,
      ipAddress: body.ipAddress,
      status: "healthy",
      version: body.version || "1.0.0",
      lastHeartbeat: new Date().toISOString(),
      totalVms: 0,
      runningVms: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      capabilities: body.capabilities,
      location: body.location || "unknown",
      createdAt: new Date().toISOString().split('T')[0]
    }

    agents.push(newAgent)

    // In a real implementation, this would:
    // 1. Generate agent credentials/tokens
    // 2. Send configuration to the agent
    // 3. Establish secure communication channel
    // 4. Register agent with load balancer if needed

    return NextResponse.json({
      success: true,
      data: newAgent,
      message: 'Agent registered successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating agent:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create agent' },
      { status: 500 }
    )
  }
}