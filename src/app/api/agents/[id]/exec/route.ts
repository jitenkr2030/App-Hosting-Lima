import { NextRequest, NextResponse } from 'next/server'

// Mock agents data - in a real app, this would be shared
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
    lastHeartbeat: new Date(Date.now() - 30000).toISOString(),
    totalVms: 2,
    runningVms: 2,
    cpuUsage: 25,
    memoryUsage: 40,
    diskUsage: 20,
    capabilities: ["qemu", "containerd"],
    location: "us-west-1",
    createdAt: "2024-01-05"
  }
]

// Mock command executions storage
let commandHistory = []

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const agent = agents.find(a => a.id === params.id)
    
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    if (agent.status !== "healthy") {
      return NextResponse.json(
        { success: false, error: 'Agent is not healthy' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.command) {
      return NextResponse.json(
        { success: false, error: 'Command is required' },
        { status: 400 }
      )
    }

    // Create command execution record
    const execution = {
      id: `exec-${Date.now()}`,
      agentId: params.id,
      agentName: agent.name,
      command: body.command,
      workingDirectory: body.workingDirectory || "/tmp",
      environment: body.environment || {},
      timeout: body.timeout || 30000, // 30 seconds default
      status: "running",
      startTime: new Date().toISOString(),
      endTime: null,
      exitCode: null,
      stdout: "",
      stderr: "",
      user: body.user || "root"
    }

    commandHistory.push(execution)

    // In a real implementation, this would:
    // 1. Authenticate the request
    // 2. Validate the command against a whitelist
    // 3. Send the command to the agent via secure channel
    // 4. Stream the output back to the client
    // 5. Handle timeouts and process termination

    // Simulate command execution
    setTimeout(() => {
      const executionIndex = commandHistory.findIndex(e => e.id === execution.id)
      if (executionIndex !== -1) {
        const exec = commandHistory[executionIndex]
        exec.status = "completed"
        exec.endTime = new Date().toISOString()
        
        // Simulate different command outputs
        if (exec.command.includes("limactl")) {
          exec.exitCode = 0
          exec.stdout = `Command executed successfully on ${agent.name}\nVM status: running\nCPU: 2 cores\nMemory: 4GB\nDisk: 20GB`
        } else if (exec.command.includes("docker")) {
          exec.exitCode = 0
          exec.stdout = `CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES\nabc123def   nginx:latest  "nginx -g 'daemon off'"   2 hours ago   Up 2 hours   0.0.0.0:80->80/tcp   web-app`
        } else if (exec.command.includes("ps")) {
          exec.exitCode = 0
          exec.stdout = `PID   TTY      TIME     CMD\n1     ?        00:00:01 init\n123   ?        00:00:00 containerd\n456   ?        00:00:01 nginx`
        } else {
          exec.exitCode = 0
          exec.stdout = `Command '${exec.command}' executed successfully\nOutput from ${agent.name}`
        }
      }
    }, 2000) // Simulate 2 second execution

    return NextResponse.json({
      success: true,
      message: 'Command execution started',
      data: {
        executionId: execution.id,
        agentId: params.id,
        command: body.command,
        status: "running",
        estimatedDuration: 2000
      }
    })
  } catch (error) {
    console.error('Error executing command:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute command' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const executionId = searchParams.get('executionId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const agent = agents.find(a => a.id === params.id)
    
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get command history for this agent
    let agentCommands = commandHistory.filter(cmd => cmd.agentId === params.id)
    
    // Filter by specific execution if requested
    if (executionId) {
      agentCommands = agentCommands.filter(cmd => cmd.id === executionId)
    }

    // Apply pagination
    const paginatedCommands = agentCommands.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: executionId ? paginatedCommands[0] || null : paginatedCommands,
      metadata: {
        total: agentCommands.length,
        limit,
        offset,
        hasMore: offset + limit < agentCommands.length
      }
    })
  } catch (error) {
    console.error('Error fetching command history:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch command history' },
      { status: 500 }
    )
  }
}