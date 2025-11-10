import { NextRequest, NextResponse } from 'next/server'

// Mock domains data
let domains = [
  {
    id: "domain-1",
    domain: "webapp.example.com",
    appId: "1",
    appName: "Web App Production",
    status: "active",
    sslEnabled: true,
    sslExpiry: "2024-07-15",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-20",
    dnsProvider: "cloudflare",
    ipAddresses: ["192.168.64.2"],
    ports: [80, 443]
  },
  {
    id: "domain-2",
    domain: "api.example.com", 
    appId: "2",
    appName: "API Service",
    status: "active",
    sslEnabled: true,
    sslExpiry: "2024-08-10",
    createdAt: "2024-01-10",
    updatedAt: "2024-01-18",
    dnsProvider: "route53",
    ipAddresses: ["192.168.64.3"],
    ports: [3000]
  }
]

// Mock SSL certificates
let certificates = [
  {
    id: "cert-1",
    domainId: "domain-1",
    domain: "webapp.example.com",
    issuer: "Let's Encrypt",
    validFrom: "2024-01-15",
    validTo: "2024-07-15",
    status: "active",
    autoRenew: true,
    certificate: "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKHV4HjGzj5FMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX\naWRnaXRzIFB0eSBMdGQwHhcNMjQwMTE1MDAwMDAwWhcNMjQwNzE1MDAwMDAwWjBF\nMQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50\nZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\nCgKCAQEAyGQz8DbGVfI3WI6Qz5lKzJQrz3xJhO7Qp1pKqMQY2Xv6QK8sJQqKzGlT\n-----END CERTIFICATE-----",
    privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDIZDPwNsZV8jdY\njpDPmUrMlCvPfEmE7tCnWkqoxBjZe/pAryylCorMaVMJ4F7lJQqKzGlT...\n-----END PRIVATE KEY-----"
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const appId = searchParams.get('appId')
    const status = searchParams.get('status')

    let filteredDomains = domains

    // Filter by app ID if provided
    if (appId) {
      filteredDomains = filteredDomains.filter(domain => domain.appId === appId)
    }

    // Filter by status if provided
    if (status) {
      filteredDomains = filteredDomains.filter(domain => domain.status === status)
    }

    return NextResponse.json({
      success: true,
      data: filteredDomains,
      total: filteredDomains.length
    })
  } catch (error) {
    console.error('Error fetching domains:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch domains' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['domain', 'appId']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    // Check if domain already exists
    const existingDomain = domains.find(d => d.domain === body.domain)
    if (existingDomain) {
      return NextResponse.json(
        { success: false, error: 'Domain already exists' },
        { status: 409 }
      )
    }

    // Create new domain mapping
    const newDomain = {
      id: `domain-${Date.now()}`,
      domain: body.domain,
      appId: body.appId,
      appName: body.appName || "Unknown App",
      status: "provisioning",
      sslEnabled: body.sslEnabled !== false, // Default to true
      sslExpiry: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dnsProvider: body.dnsProvider || "manual",
      ipAddresses: body.ipAddresses || [],
      ports: body.ports || [80, 443]
    }

    domains.push(newDomain)

    // In a real implementation, this would:
    // 1. Validate domain ownership
    // 2. Configure DNS records (A, CNAME, etc.)
    // 3. Set up reverse proxy/load balancer
    // 4. Request SSL certificate from Let's Encrypt or other CA
    // 5. Configure automatic renewal
    // 6. Set up monitoring and health checks

    // Simulate domain provisioning
    setTimeout(() => {
      const domainIndex = domains.findIndex(d => d.id === newDomain.id)
      if (domainIndex !== -1) {
        domains[domainIndex].status = "active"
        if (newDomain.sslEnabled) {
          domains[domainIndex].sslExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 90 days from now
          
          // Create SSL certificate record
          const certificate = {
            id: `cert-${Date.now()}`,
            domainId: newDomain.id,
            domain: newDomain.domain,
            issuer: "Let's Encrypt",
            validFrom: new Date().toISOString().split('T')[0],
            validTo: newDomain.sslExpiry,
            status: "active",
            autoRenew: true,
            certificate: "-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE_DATA\n-----END CERTIFICATE-----",
            privateKey: "-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY_DATA\n-----END PRIVATE KEY-----"
          }
          certificates.push(certificate)
        }
      }
    }, 10000) // Simulate 10 second provisioning

    return NextResponse.json({
      success: true,
      data: newDomain,
      message: 'Domain mapping created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating domain mapping:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create domain mapping' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domainId = searchParams.get('domainId')
    
    if (!domainId) {
      return NextResponse.json(
        { success: false, error: 'domainId is required' },
        { status: 400 }
      )
    }

    const domainIndex = domains.findIndex(d => d.id === domainId)
    
    if (domainIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Domain not found' },
        { status: 404 }
      )
    }

    const deletedDomain = domains[domainIndex]
    domains.splice(domainIndex, 1)

    // Remove associated certificates
    const certIndex = certificates.findIndex(c => c.domainId === domainId)
    if (certIndex !== -1) {
      certificates.splice(certIndex, 1)
    }

    // In a real implementation, this would:
    // 1. Remove DNS records
    // 2. Remove from reverse proxy/load balancer
    // 3. Revoke SSL certificate
    // 4. Clean up monitoring and health checks

    return NextResponse.json({
      success: true,
      message: 'Domain mapping deleted successfully',
      data: deletedDomain
    })
  } catch (error) {
    console.error('Error deleting domain mapping:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete domain mapping' },
      { status: 500 }
    )
  }
}