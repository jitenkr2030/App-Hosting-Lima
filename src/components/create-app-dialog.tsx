"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Server, Globe, Database, Code, Settings, Loader2 } from "lucide-react"

interface Template {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  defaultCpu: number
  defaultMemory: number
  defaultDisk: number
  category: string
  features: string[]
  defaultDockerImage: string
}

const templates: Template[] = [
  {
    id: "webapp",
    name: "Web Application",
    description: "Perfect for modern web applications with Node.js, Python, or other runtimes",
    icon: <Globe className="h-5 w-5" />,
    defaultCpu: 2,
    defaultMemory: 4,
    defaultDisk: 20,
    category: "Web",
    features: ["Nginx", "Container Runtime", "Port 80/443", "SSL Ready"],
    defaultDockerImage: "nginx:latest"
  },
  {
    id: "api",
    name: "API Service",
    description: "Optimized for REST APIs and microservices",
    icon: <Code className="h-5 w-5" />,
    defaultCpu: 1,
    defaultMemory: 2,
    defaultDisk: 10,
    category: "API",
    features: ["Container Runtime", "Port 8080", "Health Checks", "Metrics"],
    defaultDockerImage: "node:18-alpine"
  },
  {
    id: "database",
    name: "Database Server",
    description: "For PostgreSQL, MySQL, MongoDB and other databases",
    icon: <Database className="h-5 w-5" />,
    defaultCpu: 4,
    defaultMemory: 8,
    defaultDisk: 50,
    category: "Database",
    features: ["Persistent Storage", "Backup Ready", "Port 5432", "Monitoring"],
    defaultDockerImage: "postgres:15"
  },
  {
    id: "dev",
    name: "Development Environment",
    description: "Complete development setup with common tools",
    icon: <Settings className="h-5 w-5" />,
    defaultCpu: 1,
    defaultMemory: 2,
    defaultDisk: 15,
    category: "Development",
    features: ["VS Code Server", "Git", "Node.js", "Python", "Docker"],
    defaultDockerImage: "ubuntu:22.04"
  }
]

interface CreateAppDialogProps {
  children: React.ReactNode
  onAppCreated?: () => void
}

export default function CreateAppDialog({ children, onAppCreated }: CreateAppDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    domain: "",
    cpu: 1,
    memory: 1,
    disk: 10,
    dockerImage: "",
    envVars: "",
    sshKey: ""
  })

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    setFormData(prev => ({
      ...prev,
      cpu: template.defaultCpu,
      memory: template.defaultMemory,
      disk: template.defaultDisk,
      dockerImage: template.defaultDockerImage
    }))
  }

  const parseEnvVars = (envVarsString: string): Record<string, string> => {
    const envVars: Record<string, string> = {}
    if (!envVarsString.trim()) return envVars

    envVarsString.split('\n').forEach(line => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
    return envVars
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedTemplate || !formData.name || !formData.dockerImage) {
      setError("Please fill in all required fields")
      return
    }

    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("limahost_token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const envVars = parseEnvVars(formData.envVars)

      const appData = {
        name: formData.name,
        description: formData.description || undefined,
        domain: formData.domain || undefined,
        template: selectedTemplate.id,
        config: {
          cpu: formData.cpu,
          memory: formData.memory,
          disk: formData.disk,
          dockerImage: formData.dockerImage,
          envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
          ports: selectedTemplate.id === "webapp" ? [
            { guest: 80, host: 8080, protocol: "http" },
            { guest: 443, host: 8443, protocol: "https" }
          ] : selectedTemplate.id === "api" ? [
            { guest: 3000, host: 3000, protocol: "http" }
          ] : selectedTemplate.id === "database" ? [
            { guest: 5432, host: 5432, protocol: "tcp" }
          ] : selectedTemplate.id === "dev" ? [
            { guest: 22, host: 2222, protocol: "ssh" },
            { guest: 8080, host: 8081, protocol: "http" }
          ] : []
        }
      }

      const response = await fetch("/api/apps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(appData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setOpen(false)
        onAppCreated?.()
        
        // Reset form
        setFormData({
          name: "",
          description: "",
          domain: "",
          cpu: 1,
          memory: 1,
          disk: 10,
          dockerImage: "",
          envVars: "",
          sshKey: ""
        })
        setSelectedTemplate(null)
      } else {
        throw new Error(data.error || "Failed to create application")
      }
    } catch (err) {
      console.error("Error creating app:", err)
      setError(err instanceof Error ? err.message : "Failed to create application")
    } finally {
      setLoading(false)
    }
  }

  const categories = Array.from(new Set(templates.map(t => t.category)))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Application</DialogTitle>
          <DialogDescription>
            Deploy a new application in its own isolated Lima VM. Choose a template to get started quickly.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="template" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="template">Template</TabsTrigger>
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
              <TabsTrigger value="deployment">Deployment</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-4">
              <div className="space-y-4">
                <Label className="text-base font-medium">Choose a Template</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  {templates.map((template) => (
                    <Card 
                      key={template.id}
                      className={`cursor-pointer transition-all ${
                        selectedTemplate?.id === template.id 
                          ? 'ring-2 ring-primary border-primary' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          {template.icon}
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                        </div>
                        <CardDescription>{template.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-1">
                          {template.features.map((feature, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Default: {template.defaultCpu} vCPU, {template.defaultMemory}GB RAM, {template.defaultDisk}GB Disk
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="configuration" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Application Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="my-awesome-app"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="My awesome application description"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Domain Name (Optional)</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                  placeholder="app.example.com"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="cpu">vCPU Cores *</Label>
                  <Select value={formData.cpu.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, cpu: parseInt(value) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 vCPU</SelectItem>
                      <SelectItem value="2">2 vCPU</SelectItem>
                      <SelectItem value="4">4 vCPU</SelectItem>
                      <SelectItem value="8">8 vCPU</SelectItem>
                      <SelectItem value="16">16 vCPU</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memory">Memory (GB) *</Label>
                  <Select value={formData.memory.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, memory: parseInt(value) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 GB</SelectItem>
                      <SelectItem value="2">2 GB</SelectItem>
                      <SelectItem value="4">4 GB</SelectItem>
                      <SelectItem value="8">8 GB</SelectItem>
                      <SelectItem value="16">16 GB</SelectItem>
                      <SelectItem value="32">32 GB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disk">Disk Size (GB) *</Label>
                  <Select value={formData.disk.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, disk: parseInt(value) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 GB</SelectItem>
                      <SelectItem value="20">20 GB</SelectItem>
                      <SelectItem value="50">50 GB</SelectItem>
                      <SelectItem value="100">100 GB</SelectItem>
                      <SelectItem value="200">200 GB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="deployment" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dockerImage">Docker Image *</Label>
                <Input
                  id="dockerImage"
                  value={formData.dockerImage}
                  onChange={(e) => setFormData(prev => ({ ...prev, dockerImage: e.target.value }))}
                  placeholder="nginx:latest or your-registry/app:tag"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  The Docker image to deploy inside the Lima VM
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="envVars">Environment Variables (Optional)</Label>
                <Textarea
                  id="envVars"
                  value={formData.envVars}
                  onChange={(e) => setFormData(prev => ({ ...prev, envVars: e.target.value }))}
                  placeholder="NODE_ENV=production&#10;PORT=8080&#10;DATABASE_URL=postgresql://..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  One variable per line in KEY=VALUE format
                </p>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sshKey">SSH Public Key (Optional)</Label>
                <Textarea
                  id="sshKey"
                  value={formData.sshKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, sshKey: e.target.value }))}
                  placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ..."
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  Add an SSH public key for direct access to the VM
                </p>
              </div>

              {selectedTemplate && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      Template Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p><strong>Template:</strong> {selectedTemplate.name}</p>
                      <p><strong>Category:</strong> {selectedTemplate.category}</p>
                      <p><strong>Features:</strong> {selectedTemplate.features.join(", ")}</p>
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <p className="font-medium mb-1">Lima YAML Configuration Preview:</p>
                        <pre className="text-xs overflow-x-auto">
{`name: ${formData.name || "app"}
arch: "x86_64"
cpus: ${formData.cpu}
memory: "${formData.memory}GiB"
disk: "${formData.disk}GiB"
containerd:
  user: true
  system: false
provision:
  - mode: system
    script: |
      #!/bin/bash
      apt-get update
      apt-get install -y containerd curl
      systemctl enable --now containerd
ports:
  - guest: 80
    host: 0`}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedTemplate || !formData.name || !formData.dockerImage || loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Application"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}