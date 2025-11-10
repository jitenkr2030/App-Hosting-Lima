"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RotateCcw, 
  Trash2, 
  Download, 
  Upload, 
  Terminal, 
  Activity, 
  HardDrive, 
  Wifi, 
  Cpu, 
  MemoryStick, 
  Settings, 
  Globe,
  Clock,
  AlertCircle,
  CheckCircle
} from "lucide-react"

interface AppDetail {
  id: string
  name: string
  status: "running" | "stopped" | "deploying" | "error"
  cpu: number
  memory: number
  disk: number
  domain: string
  template: string
  createdAt: string
  ipAddress: string
  dockerImage: string
  envVars: Record<string, string>
  ports: { guest: number; host: number; protocol: string }[]
}

interface MetricData {
  timestamp: string
  cpu: number
  memory: number
  disk: number
  networkIn: number
  networkOut: number
}

interface LogEntry {
  timestamp: string
  level: "info" | "warn" | "error" | "debug"
  message: string
  source: string
}

const mockAppDetail: AppDetail = {
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
}

const mockMetrics: MetricData[] = [
  { timestamp: "10:00", cpu: 25, memory: 60, disk: 45, networkIn: 1024, networkOut: 2048 },
  { timestamp: "10:05", cpu: 30, memory: 65, disk: 45, networkIn: 1536, networkOut: 2560 },
  { timestamp: "10:10", cpu: 45, memory: 70, disk: 46, networkIn: 2048, networkOut: 3072 },
  { timestamp: "10:15", cpu: 35, memory: 68, disk: 46, networkIn: 1792, networkOut: 2816 },
  { timestamp: "10:20", cpu: 40, memory: 72, disk: 47, networkIn: 2304, networkOut: 3328 }
]

const mockLogs: LogEntry[] = [
  { timestamp: "10:20:15", level: "info", message: "Starting nginx server...", source: "nginx" },
  { timestamp: "10:20:16", level: "info", message: "nginx started successfully", source: "nginx" },
  { timestamp: "10:20:17", level: "info", message: "Health check passed", source: "healthcheck" },
  { timestamp: "10:20:20", level: "info", message: "New connection from 192.168.1.100", source: "nginx" },
  { timestamp: "10:20:21", level: "warn", message: "High memory usage detected: 85%", source: "monitor" },
  { timestamp: "10:20:25", level: "info", message: "Request processed: GET /api/users", source: "app" },
  { timestamp: "10:20:26", level: "error", message: "Database connection timeout", source: "app" },
  { timestamp: "10:20:30", level: "info", message: "Database connection restored", source: "app" }
]

interface AppDetailViewProps {
  app: AppDetail
  onBack: () => void
}

export default function AppDetailView({ app, onBack }: AppDetailViewProps) {
  const [metrics] = useState<MetricData[]>(mockMetrics)
  const [logs] = useState<LogEntry[]>(mockLogs)
  const [terminalInput, setTerminalInput] = useState("")
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "Welcome to Lima VM Terminal",
    "Connected to app-1 (192.168.64.2)",
    "Type 'help' for available commands",
    ""
  ])
  const [isTerminalFocused, setIsTerminalFocused] = useState(false)
  const terminalEndRef = useRef<HTMLDivElement>(null)

  const getStatusColor = (status: AppDetail["status"]) => {
    switch (status) {
      case "running": return "bg-green-500"
      case "stopped": return "bg-gray-500"
      case "deploying": return "bg-blue-500"
      case "error": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusText = (status: AppDetail["status"]) => {
    switch (status) {
      case "running": return "Running"
      case "stopped": return "Stopped"
      case "deploying": return "Deploying"
      case "error": return "Error"
      default: return "Unknown"
    }
  }

  const getLogLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "info": return "text-blue-600"
      case "warn": return "text-yellow-600"
      case "error": return "text-red-600"
      case "debug": return "text-gray-600"
      default: return "text-gray-600"
    }
  }

  const handleTerminalInput = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && terminalInput.trim()) {
      const command = terminalInput.trim()
      const newOutput = [...terminalOutput, `$ ${command}`]
      
      // Simulate command response
      setTimeout(() => {
        let response = ""
        switch (command.toLowerCase()) {
          case "help":
            response = "Available commands:\n  help     - Show this help\n  status   - Show app status\n  logs     - Show recent logs\n  restart  - Restart the app\n  exit     - Exit terminal"
            break
          case "status":
            response = `App Status: ${app.status}\nCPU: ${app.cpu} cores\nMemory: ${app.memory} GB\nDisk: ${app.disk} GB\nUptime: 5 days, 2 hours`
            break
          case "logs":
            response = "Recent logs:\n[INFO] App is running normally\n[INFO] Health check passed\n[WARN] High memory usage detected"
            break
          case "restart":
            response = "Restarting application...\nApplication restarted successfully"
            break
          case "exit":
            response = "Goodbye!"
            break
          default:
            response = `Command not found: ${command}. Type 'help' for available commands.`
        }
        
        setTerminalOutput(prev => [...prev, ...response.split("\n"), ""])
        setTerminalInput("")
      }, 500)
      
      setTerminalOutput(newOutput)
      setTerminalInput("")
    }
  }

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [terminalOutput])

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-6 gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Apps
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">{app.name}</h1>
                <Badge variant="secondary" className={`${getStatusColor(app.status)} text-white`}>
                  {getStatusText(app.status)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{app.domain} • {app.ipAddress}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={app.status === "running"}>
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
              <Button size="sm" variant="outline" disabled={app.status !== "running"}>
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </Button>
              <Button size="sm" variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Restart
              </Button>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Backup
              </Button>
              <Button size="sm" variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Deploy
              </Button>
              <Button size="sm" variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Info and Configuration */}
            <div className="lg:col-span-1 space-y-6">
              {/* App Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Application Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Template</Label>
                      <p className="font-medium">{app.template}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Created</Label>
                      <p className="font-medium">{app.createdAt}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">IP Address</Label>
                      <p className="font-medium">{app.ipAddress}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Docker Image</Label>
                      <p className="font-medium text-xs break-all">{app.dockerImage}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resource Usage */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Resource Usage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        <span className="text-sm">CPU</span>
                      </div>
                      <span className="text-sm font-medium">{app.cpu} cores</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MemoryStick className="h-4 w-4" />
                        <span className="text-sm">Memory</span>
                      </div>
                      <span className="text-sm font-medium">{app.memory} GB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        <span className="text-sm">Disk</span>
                      </div>
                      <span className="text-sm font-medium">{app.disk} GB</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Environment Variables */}
              <Card>
                <CardHeader>
                  <CardTitle>Environment Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {Object.entries(app.envVars).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium">{key}:</span>
                          <span className="text-muted-foreground ml-2">{value}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Main Content */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="logs" className="h-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                  <TabsTrigger value="metrics">Metrics</TabsTrigger>
                  <TabsTrigger value="terminal">Terminal</TabsTrigger>
                </TabsList>

                <TabsContent value="logs" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Application Logs
                      </CardTitle>
                      <CardDescription>Real-time logs from your application</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96 w-full border rounded-md p-4">
                        <div className="space-y-1 font-mono text-sm">
                          {logs.map((log, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <span className="text-muted-foreground text-xs min-w-[70px]">
                                {log.timestamp}
                              </span>
                              <span className={`min-w-[20px] ${getLogLevelColor(log.level)}`}>
                                [{log.level.toUpperCase()}]
                              </span>
                              <span className="text-muted-foreground text-xs min-w-[80px]">
                                {log.source}:
                              </span>
                              <span className={log.level === "error" ? "text-red-600" : ""}>
                                {log.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="metrics" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Cpu className="h-5 w-5" />
                          CPU Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {metrics.map((metric, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{metric.timestamp}</span>
                              <span>{metric.cpu}%</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MemoryStick className="h-5 w-5" />
                          Memory Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {metrics.map((metric, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{metric.timestamp}</span>
                              <span>{metric.memory}%</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <HardDrive className="h-5 w-5" />
                          Disk Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {metrics.map((metric, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{metric.timestamp}</span>
                              <span>{metric.disk}%</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wifi className="h-5 w-5" />
                          Network I/O
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {metrics.map((metric, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{metric.timestamp}</span>
                              <span>↓{metric.networkIn}KB/s ↑{metric.networkOut}KB/s</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="terminal" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Terminal className="h-5 w-5" />
                        VM Terminal
                      </CardTitle>
                      <CardDescription>Direct terminal access to your Lima VM</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="h-96 w-full bg-black text-green-400 font-mono text-sm p-4 rounded-md overflow-hidden flex flex-col"
                        onClick={() => setIsTerminalFocused(true)}
                      >
                        <ScrollArea className="flex-1 mb-2">
                          <div className="space-y-1">
                            {terminalOutput.map((line, index) => (
                              <div key={index}>{line}</div>
                            ))}
                            <div ref={terminalEndRef} />
                          </div>
                        </ScrollArea>
                        <div className="flex items-center gap-2">
                          <span>$</span>
                          <Input
                            value={terminalInput}
                            onChange={(e) => setTerminalInput(e.target.value)}
                            onKeyDown={handleTerminalInput}
                            className="flex-1 bg-transparent border-none text-green-400 focus-visible:ring-0"
                            placeholder={isTerminalFocused ? "" : "Click to focus..."}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Type 'help' for available commands. Press Enter to execute.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}