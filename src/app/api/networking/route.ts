import { NextRequest, NextResponse } from 'next/server'

// Mock networking data
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
    updatedAt: "2024-01-20T15:30:00Z",
    dns: {
      provider: "cloudflare",
      configured: true,
      records: [
        {
          type: "A",
          name: "webapp.example.com",
          value: "192.168.64.2",
          ttl: 300
        }
      ]
    },
    ssl: {
      provider: "letsencrypt",
      configured: true,
      issuer: "Let's Encrypt",
      expiresAt: "2024-04-15T10:00:00Z",
      autoRenew: true
    },
    loadBalancer: {
      type: "nginx",
      configured: true,
      configPath: "/etc/limahost/nginx/sites-available/webapp.example.com.conf"
    }
  },
  {
    id: "network-2",
    domain: "api.example.com",
    appId: "2",
    appName: "API Service",
    vmName: "api-service",
    vmIp: "192.168.64.3",
    port: 3000,
    sslEnabled: true,
    forceHttps: true,
    status: "active",
    createdAt: "2024-01-10T15:00:00Z",
    updatedAt: "2024-01-18T12:00:00Z",
    dns: {
      provider: "route53",
      configured: true,
      records: [
        {
          type: "A",
          name: "api.example.com",
          value: "192.168.64.3",
          ttl: 300
        }
      ]
    },
    ssl: {
      provider: "letsencrypt",
      configured: true,
      issuer: "Let's Encrypt",
      expiresAt: "2024-04-10T15:00:00Z",
      autoRenew: true
    },
    loadBalancer: {
      type: "nginx",
      configured: true,
      configPath: "/etc/limahost/nginx/sites-available/api.example.com.conf"
    }
  }
]

// Mock SSL certificates
let certificates = [
  {
    id: "cert-1",
    domain: "webapp.example.com",
    issuer: "Let's Encrypt",
    validFrom: "2024-01-15T10:00:00Z",
    validTo: "2024-04-15T10:00:00Z",
    status: "active",
    autoRenew: true,
    fingerprint: "ABC123DEF456GHI789",
    dnsNames: ["webapp.example.com", "www.webapp.example.com"]
  },
  {
    id: "cert-2",
    domain: "api.example.com",
    issuer: "Let's Encrypt",
    validFrom: "2024-01-10T15:00:00Z",
    validTo: "2024-04-10T15:00:00Z",
    status: "active",
    autoRenew: true,
    fingerprint: "XYZ987ABC654DEF321",
    dnsNames: ["api.example.com"]
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const appId = searchParams.get('appId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let filteredConfigs = networkConfigs

    // Filter by app ID if provided
    if (appId) {
      filteredConfigs = filteredConfigs.filter(config => config.appId === appId)
    }

    // Filter by status if provided
    if (status) {
      filteredConfigs = filteredConfigs.filter(config => config.status === status)
    }

    // Apply pagination
    const paginatedConfigs = filteredConfigs.slice(offset, offset + limit)

    // Calculate statistics
    const totalConfigs = networkConfigs.length
    const activeConfigs = networkConfigs.filter(c => c.status === 'active').length
    const sslEnabledConfigs = networkConfigs.filter(c => c.sslEnabled).length
    const dnsConfiguredConfigs = networkConfigs.filter(c => c.dns.configured).length

    return NextResponse.json({
      success: true,
      data: paginatedConfigs,
      metadata: {
        total: filteredConfigs.length,
        limit,
        offset,
        hasMore: offset + limit < filteredConfigs.length,
        statistics: {
          totalConfigs,
          activeConfigs,
          sslEnabledConfigs,
          dnsConfiguredConfigs,
          loadBalancerTypes: {
            nginx: networkConfigs.filter(c => c.loadBalancer.type === 'nginx').length,
            traefik: networkConfigs.filter(c => c.loadBalancer.type === 'traefik').length,
            haproxy: networkConfigs.filter(c => c.loadBalancer.type === 'haproxy').length
          },
          dnsProviders: {
            cloudflare: networkConfigs.filter(c => c.dns.provider === 'cloudflare').length,
            route53: networkConfigs.filter(c => c.dns.provider === 'route53').length,
            digitalocean: networkConfigs.filter(c => c.dns.provider === 'digitalocean').length,
            manual: networkConfigs.filter(c => c.dns.provider === 'manual').length
          }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching network configs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch network configs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['domain', 'appId', 'appName', 'vmName', 'vmIp', 'port']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    // Validate domain format
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
    if (!domainRegex.test(body.domain)) {
      return NextResponse.json(
        { success: false, error: 'Invalid domain format' },
        { status: 400 }
      )
    }

    // Check if domain is already configured
    const existingConfig = networkConfigs.find(c => c.domain === body.domain)
    if (existingConfig) {
      return NextResponse.json(
        { success: false, error: 'Domain is already configured' },
        { status: 409 }
      )
    }

    // Create new network configuration
    const newConfig = {
      id: `network-${Date.now()}`,
      domain: body.domain,
      appId: body.appId,
      appName: body.appName,
      vmName: body.vmName,
      vmIp: body.vmIp,
      port: body.port,
      sslEnabled: body.sslEnabled !== false, // Default to true
      forceHttps: body.forceHttps !== false, // Default to true
      status: "provisioning",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dns: {
        provider: body.dnsProvider || "cloudflare",
        configured: false,
        records: []
      },
      ssl: {
        provider: body.sslProvider || "letsencrypt",
        configured: false,
        issuer: null,
        expiresAt: null,
        autoRenew: body.autoRenew !== false
      },
      loadBalancer: {
        type: body.loadBalancerType || "nginx",
        configured: false,
        configPath: null
      }
    }

    networkConfigs.push(newConfig)

    // In a real implementation, this would:
    // 1. Validate VM accessibility
    // 2. Configure DNS records
    // 3. Request SSL certificate
    // 4. Configure load balancer
    // 5. Test connectivity
    // 6. Update status to active

    // Simulate provisioning process
    setTimeout(() => {
      const configIndex = networkConfigs.findIndex(c => c.id === newConfig.id)
      if (configIndex !== -1) {
        const config = networkConfigs[configIndex]
        config.status = "active"
        config.dns.configured = true
        config.dns.records = [
          {
            type: "A",
            name: config.domain,
            value: config.vmIp,
            ttl: 300
          }
        ]
        config.ssl.configured = true
        config.ssl.issuer = "Let's Encrypt"
        config.ssl.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days from now
        config.loadBalancer.configured = true
        config.loadBalancer.configPath = `/etc/limahost/nginx/sites-available/${config.domain}.conf`
        config.updatedAt = new Date().toISOString()
      }
    }, 30000) // Simulate 30 second provisioning

    return NextResponse.json({
      success: true,
      data: newConfig,
      message: 'Network configuration started successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating network config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create network config' },
      { status: 500 }
    )
  }
}