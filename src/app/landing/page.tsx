"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  Server, 
  Globe, 
  Shield, 
  Zap, 
  Users, 
  Database, 
  Activity, 
  DollarSign, 
  CheckCircle, 
  ArrowRight,
  Star,
  TrendingUp,
  Lock,
  Rocket,
  Code,
  Monitor,
  Cloud,
  Cpu,
  HardDrive
} from "lucide-react"

export default function LandingPage() {
  const [email, setEmail] = useState("")

  const features = [
    {
      icon: <Server className="h-8 w-8 text-blue-600" />,
      title: "Lima VM Integration",
      description: "Seamless integration with Lima virtual machines for consistent development environments"
    },
    {
      icon: <Globe className="h-8 w-8 text-green-600" />,
      title: "Custom Domains & HTTPS",
      description: "Automatic SSL certificates and custom domain mapping for professional deployments"
    },
    {
      icon: <Shield className="h-8 w-8 text-purple-600" />,
      title: "Enterprise Security",
      description: "Role-based access control, audit logs, and secure authentication"
    },
    {
      icon: <Zap className="h-8 w-8 text-yellow-600" />,
      title: "Lightning Fast",
      description: "Optimized performance with SSD storage and global CDN integration"
    },
    {
      icon: <Database className="h-8 w-8 text-red-600" />,
      title: "Automated Backups",
      description: "Scheduled backups and one-click restore functionality"
    },
    {
      icon: <Activity className="h-8 w-8 text-indigo-600" />,
      title: "Real-time Monitoring",
      description: "Live metrics, logs, and performance monitoring for all applications"
    }
  ]

  const templates = [
    {
      name: "Web Application",
      description: "Perfect for React, Vue, Angular, and static sites",
      icon: <Globe className="h-6 w-6" />,
      tech: ["Node.js", "Nginx", "React"]
    },
    {
      name: "API Service",
      description: "Ideal for REST APIs, GraphQL, and microservices",
      icon: <Code className="h-6 w-6" />,
      tech: ["Node.js", "Python", "Go"]
    },
    {
      name: "Database",
      description: "Managed PostgreSQL, MySQL, and MongoDB instances",
      icon: <Database className="h-6 w-6" />,
      tech: ["PostgreSQL", "MySQL", "MongoDB"]
    },
    {
      name: "Development Environment",
      description: "Complete development setup with SSH access",
      icon: <Monitor className="h-6 w-6" />,
      tech: ["Ubuntu", "Docker", "VS Code"]
    }
  ]

  const pricingPlans = [
    {
      name: "Free",
      price: "$0",
      description: "Perfect for getting started",
      features: [
        "1 Application",
        "1 GB Storage",
        "10 GB Bandwidth",
        "1 vCPU, 1 GB RAM",
        "Community Support"
      ],
      cta: "Get Started",
      popular: false
    },
    {
      name: "Basic",
      price: "$19",
      period: "/month",
      description: "Great for small projects",
      features: [
        "3 Applications",
        "5 GB Storage",
        "50 GB Bandwidth",
        "2 vCPU, 2 GB RAM",
        "Custom Domains",
        "SSL Certificates",
        "Automated Backups",
        "Email Support"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Pro",
      price: "$49",
      period: "/month",
      description: "For growing businesses",
      features: [
        "10 Applications",
        "20 GB Storage",
        "200 GB Bandwidth",
        "4 vCPU, 4 GB RAM",
        "Custom Domains",
        "SSL Certificates",
        "Automated Backups",
        "Priority Support",
        "Advanced Analytics"
      ],
      cta: "Start Free Trial",
      popular: false
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large organizations",
      features: [
        "Unlimited Applications",
        "Unlimited Storage",
        "Unlimited Bandwidth",
        "Dedicated Resources",
        "Custom Domains",
        "SSL Certificates",
        "Automated Backups",
        "24/7 Dedicated Support",
        "Custom Integrations",
        "SLA Guarantee"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ]

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "CTO at TechStart",
      content: "LimaHost has transformed our deployment process. What used to take days now takes minutes. The Lima VM integration is seamless!",
      avatar: "SJ"
    },
    {
      name: "Mike Chen",
      role: "Lead Developer",
      content: "The best platform I've used for app hosting. The monitoring tools are incredible and the support team is always helpful.",
      avatar: "MC"
    },
    {
      name: "Emily Rodriguez",
      role: "DevOps Engineer",
      content: "Finally, a platform that understands developers' needs. The template system saves us hours of setup time.",
      avatar: "ER"
    }
  ]

  const stats = [
    { label: "Applications Deployed", value: "50K+", icon: <Rocket className="h-6 w-6" /> },
    { label: "Active Developers", value: "10K+", icon: <Users className="h-6 w-6" /> },
    { label: "Uptime", value: "99.9%", icon: <TrendingUp className="h-6 w-6" /> },
    { label: "Global Regions", value: "15+", icon: <Globe className="h-6 w-6" /> }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold">LimaHost</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-blue-600 transition-colors">Features</a>
            <a href="#templates" className="text-sm font-medium hover:text-blue-600 transition-colors">Templates</a>
            <a href="#pricing" className="text-sm font-medium hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm font-medium hover:text-blue-600 transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => window.location.href = '/login'}>Sign In</Button>
            <Button onClick={() => window.location.href = '/login'}>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <Star className="h-4 w-4 mr-1" />
            New: Enterprise-Grade App Hosting
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Deploy Applications with Lima VM Power
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience the future of application hosting with seamless Lima VM integration, 
            enterprise-grade security, and developer-friendly tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="text-lg px-8" onClick={() => window.location.href = '/login'}>
              Start Free Trial
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              View Demo
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  {stat.icon}
                </div>
                <div className="text-3xl font-bold text-blue-600">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Deploy with Confidence</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built by developers, for developers. Every feature designed to make your life easier.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section id="templates" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Start with Pre-built Templates</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get up and running in minutes with our optimized application templates.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {templates.map((template, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {template.icon}
                    </div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {template.description}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2">
                    {template.tech.map((tech, techIndex) => (
                      <Badge key={techIndex} variant="secondary" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the perfect plan for your needs. Upgrade or downgrade at any time.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-blue-500 shadow-lg' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="text-3xl font-bold">
                    {plan.price}
                    <span className="text-lg font-normal text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full mt-6 ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by Developers Worldwide</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of developers who have transformed their deployment workflow.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>{testimonial.avatar}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                  <p className="text-muted-foreground italic">
                    "{testimonial.content}"
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Transform Your Deployment Process?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of developers who have already made the switch to LimaHost.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8" onClick={() => window.location.href = '/login'}>
              Start Free Trial
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 border-white text-white hover:bg-white hover:text-blue-600">
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Server className="h-6 w-6 text-blue-600" />,
                <span className="text-lg font-bold">LimaHost</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Enterprise-grade application hosting powered by Lima VM technology.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-blue-600">Features</a></li>
                <li><a href="#" className="hover:text-blue-600">Templates</a></li>
                <li><a href="#" className="hover:text-blue-600">Pricing</a></li>
                <li><a href="#" className="hover:text-blue-600">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-blue-600">About</a></li>
                <li><a href="#" className="hover:text-blue-600">Blog</a></li>
                <li><a href="#" className="hover:text-blue-600">Careers</a></li>
                <li><a href="#" className="hover:text-blue-600">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-blue-600">Help Center</a></li>
                <li><a href="#" className="hover:text-blue-600">Status</a></li>
                <li><a href="#" className="hover:text-blue-600">API</a></li>
                <li><a href="#" className="hover:text-blue-600">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 LimaHost. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}