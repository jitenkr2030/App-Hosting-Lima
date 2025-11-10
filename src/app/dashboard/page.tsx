"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Search, Plus, Settings, Users, Database, Activity, DollarSign, Shield, Terminal, Monitor, Server, Globe, MoreHorizontal, Loader2 } from "lucide-react"
import CreateAppDialog from "@/components/create-app-dialog"
import AppDetailView from "@/components/app-detail-view"
import AuthWrapper from "@/components/auth-wrapper"

interface App {
  id: string
  name: string
  description?: string
  status: "running" | "stopped" | "deploying" | "error" | "CREATING" | "DELETING"
  template: string
  domain?: string
  createdAt: string
  config: {
    cpu: number
    memory: number
    disk: number
    dockerImage: string
    envVars?: Record<string, string>
    ports?: { guest: number; host: number; protocol: string }[]
  }
  deployments: any[]
  backupsCount: number
  snapshotsCount: number
}

const getStatusColor = (status: App["status"]) => {
  switch (status) {
    case "running":
    case "RUNNING":
      return "bg-green-500"
    case "stopped":
    case "STOPPED":
      return "bg-gray-500"
    case "deploying":
    case "DEPLOYING":
    case "CREATING":
      return "bg-blue-500"
    case "error":
    case "ERROR":
      return "bg-red-500"
    case "DELETING":
      return "bg-yellow-500"
    default:
      return "bg-gray-500"
  }
}

const getStatusText = (status: App["status"]) => {
  switch (status) {
    case "running":
    case "RUNNING":
      return "Running"
    case "stopped":
    case "STOPPED":
      return "Stopped"
    case "deploying":
    case "DEPLOYING":
    case "CREATING":
      return "Deploying"
    case "error":
    case "ERROR":
      return "Error"
    case "DELETING":
      return "Deleting"
    default:
      return "Unknown"
  }
}

export default function Dashboard() {
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedApp, setSelectedApp] = useState<App | null>(null)

  const fetchApps = async () => {
    try {
      console.log("Dashboard: fetchApps called")
      setLoading(true)
      setError("")
      
      const token = localStorage.getItem("limahost_token")
      const user = localStorage.getItem("limahost_user")
      console.log("Dashboard: Token exists:", !!token)
      console.log("Dashboard: User exists:", !!user)
      
      if (!token) {
        throw new Error("No authentication token found")
      }

      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (searchTerm) {
        params.append("search", searchTerm)
      }

      console.log("Dashboard: Fetching apps from API...")
      const response = await fetch(`/api/apps?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })

      console.log("Dashboard: API response status:", response.status)

      if (!response.ok) {
        throw new Error("Failed to fetch apps")
      }

      const data = await response.json()
      console.log("Dashboard: API response data:", data)
      
      if (data.success) {
        setApps(data.data)
        console.log("Dashboard: Apps set successfully, count:", data.data.length)
      } else {
        throw new Error(data.error || "Failed to fetch apps")
      }
    } catch (err) {
      console.error("Dashboard: Error fetching apps:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch apps")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log("Dashboard: Component mounted, checking authentication...")
    fetchApps()
  }, [statusFilter, searchTerm])

  const handleAppClick = (app: App) => {
    setSelectedApp(app)
  }

  const handleBackToDashboard = () => {
    setSelectedApp(null)
    fetchApps() // Refresh apps list when going back
  }

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("limahost_token")
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })
      }
      
      // Clear localStorage
      localStorage.removeItem("limahost_token")
      localStorage.removeItem("limahost_user")
      
      // Redirect to login page
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout error:", error)
      // Still clear localStorage and redirect even if API call fails
      localStorage.removeItem("limahost_token")
      localStorage.removeItem("limahost_user")
      window.location.href = "/login"
    }
  }

  const handleAppCreated = () => {
    fetchApps() // Refresh the apps list after creating a new app
  }

  if (selectedApp) {
    return (
      <AuthWrapper>
        <AppDetailView app={selectedApp} onBack={handleBackToDashboard} />
      </AuthWrapper>
    )
  }

  return (
    <AuthWrapper>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <Sidebar>
            <SidebarHeader className="border-b">
              <div className="flex items-center gap-2">
                <Server className="h-6 w-6" />
                <h1 className="font-bold text-lg">LimaHost</h1>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Platform</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton isActive>
                        <Monitor className="h-4 w-4" />
                        <span>Apps</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <Server className="h-4 w-4" />
                        <span>Agents</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <Database className="h-4 w-4" />
                        <span>Templates</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <Activity className="h-4 w-4" />
                        <span>Backups</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel>Management</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <Users className="h-4 w-4" />
                        <span>Teams</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <DollarSign className="h-4 w-4" />
                        <span>Billing</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <Shield className="h-4 w-4" />
                        <span>Audit Logs</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="border-t p-4">
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src="/placeholder-avatar.jpg" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">John Doe</p>
                  <p className="text-xs text-muted-foreground">john@example.com</p>
                </div>
              </div>
            </SidebarFooter>
          </Sidebar>

          <div className="flex-1 flex flex-col">
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-14 items-center px-4 gap-4">
                <SidebarTrigger />
                <div className="flex-1">
                  <h1 className="text-lg font-semibold">Applications</h1>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search apps..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="RUNNING">Running</SelectItem>
                      <SelectItem value="STOPPED">Stopped</SelectItem>
                      <SelectItem value="DEPLOYING">Deploying</SelectItem>
                      <SelectItem value="ERROR">Error</SelectItem>
                    </SelectContent>
                  </Select>
                  <CreateAppDialog onAppCreated={handleAppCreated}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      New App
                    </Button>
                  </CreateAppDialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Organization</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Acme Corp</DropdownMenuItem>
                      <DropdownMenuItem>Development Team</DropdownMenuItem>
                      <DropdownMenuItem>Personal</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Settings</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>

            <main className="flex-1 p-6 overflow-auto">
              {loading && (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading applications...</span>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <p className="text-red-500 mb-4">Error: {error}</p>
                    <Button onClick={fetchApps}>Retry</Button>
                  </div>
                </div>
              )}

              {!loading && !error && (
                <>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {apps.map((app) => (
                      <Card 
                        key={app.id} 
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleAppClick(app)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-lg">{app.name}</CardTitle>
                              <CardDescription className="text-sm">{app.domain || 'No domain'}</CardDescription>
                            </div>
                            <Badge variant="secondary" className={`${getStatusColor(app.status)} text-white`}>
                              {getStatusText(app.status)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <p className="font-medium">{app.config.cpu} vCPU</p>
                              <p className="text-muted-foreground">CPU</p>
                            </div>
                            <div className="text-center">
                              <p className="font-medium">{app.config.memory} GB</p>
                              <p className="text-muted-foreground">Memory</p>
                            </div>
                            <div className="text-center">
                              <p className="font-medium">{app.config.disk} GB</p>
                              <p className="text-muted-foreground">Disk</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Template: {app.template}</span>
                            <span>Created: {app.createdAt}</span>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAppClick(app)
                              }}
                            >
                              <Terminal className="h-3 w-3 mr-1" />
                              Terminal
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe className="h-3 w-3 mr-1" />
                              Open
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {apps.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <Server className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No applications found</h3>
                      <p className="text-muted-foreground mb-4">
                        {searchTerm || statusFilter !== "all" 
                          ? "Try adjusting your search or filters"
                          : "Get started by creating your first application"
                        }
                      </p>
                      {(!searchTerm && statusFilter === "all") && (
                        <CreateAppDialog onAppCreated={handleAppCreated}>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Your First App
                          </Button>
                        </CreateAppDialog>
                      )}
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthWrapper>
  )
}