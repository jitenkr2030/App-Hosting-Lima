import { NextRequest, NextResponse } from 'next/server'

// Mock certificates data
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
    dnsNames: ["webapp.example.com", "www.webapp.example.com"],
    keyAlgorithm: "RSA",
    keySize: 2048,
    signatureAlgorithm: "SHA256-RSA"
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
    dnsNames: ["api.example.com"],
    keyAlgorithm: "RSA",
    keySize: 2048,
    signatureAlgorithm: "SHA256-RSA"
  },
  {
    id: "cert-3",
    domain: "db.example.com",
    issuer: "Self-Signed",
    validFrom: "2024-01-05T09:00:00Z",
    validTo: "2025-01-05T09:00:00Z",
    status: "active",
    autoRenew: false,
    fingerprint: "SELF123SIGNED456CERT789",
    dnsNames: ["db.example.com"],
    keyAlgorithm: "RSA",
    keySize: 4096,
    signatureAlgorithm: "SHA256-RSA"
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const status = searchParams.get('status')
    const issuer = searchParams.get('issuer')
    const expiringSoon = searchParams.get('expiringSoon') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let filteredCerts = certificates

    // Filter by domain if provided
    if (domain) {
      filteredCerts = filteredCerts.filter(cert => 
        cert.dnsNames.includes(domain) || cert.domain === domain
      )
    }

    // Filter by status if provided
    if (status) {
      filteredCerts = filteredCerts.filter(cert => cert.status === status)
    }

    // Filter by issuer if provided
    if (issuer) {
      filteredCerts = filteredCerts.filter(cert => cert.issuer.toLowerCase().includes(issuer.toLowerCase()))
    }

    // Filter by expiring soon if requested
    if (expiringSoon) {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      filteredCerts = filteredCerts.filter(cert => {
        const expiryDate = new Date(cert.validTo)
        return expiryDate <= thirtyDaysFromNow && cert.status === 'active'
      })
    }

    // Apply pagination
    const paginatedCerts = filteredCerts.slice(offset, offset + limit)

    // Calculate statistics
    const totalCerts = certificates.length
    const activeCerts = certificates.filter(c => c.status === 'active').length
    const expiringCerts = certificates.filter(c => {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const expiryDate = new Date(c.validTo)
      return expiryDate <= thirtyDaysFromNow && c.status === 'active'
    }).length
    const autoRenewCerts = certificates.filter(c => c.autoRenew).length

    return NextResponse.json({
      success: true,
      data: paginatedCerts,
      metadata: {
        total: filteredCerts.length,
        limit,
        offset,
        hasMore: offset + limit < filteredCerts.length,
        statistics: {
          totalCerts,
          activeCerts,
          expiringCerts,
          autoRenewCerts,
          issuers: {
            "Let's Encrypt": certificates.filter(c => c.issuer === "Let's Encrypt").length,
            "Self-Signed": certificates.filter(c => c.issuer === "Self-Signed").length,
            "Custom": certificates.filter(c => !["Let's Encrypt", "Self-Signed"].includes(c.issuer)).length
          },
          keyAlgorithms: {
            "RSA": certificates.filter(c => c.keyAlgorithm === "RSA").length,
            "ECDSA": certificates.filter(c => c.keyAlgorithm === "ECDSA").length
          }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching certificates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['domain', 'dnsNames']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    // Check if certificate already exists for this domain
    const existingCert = certificates.find(cert => 
      cert.dnsNames.some(name => body.dnsNames.includes(name)) || 
      cert.domain === body.domain
    )
    
    if (existingCert) {
      return NextResponse.json(
        { success: false, error: 'Certificate already exists for this domain' },
        { status: 409 }
      )
    }

    // Create new certificate record
    const newCert = {
      id: `cert-${Date.now()}`,
      domain: body.domain,
      dnsNames: body.dnsNames,
      issuer: body.issuer || "Let's Encrypt",
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
      status: "provisioning",
      autoRenew: body.autoRenew !== false,
      fingerprint: `FINGERPRINT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      keyAlgorithm: body.keyAlgorithm || "RSA",
      keySize: body.keySize || 2048,
      signatureAlgorithm: body.signatureAlgorithm || "SHA256-RSA"
    }

    certificates.push(newCert)

    // In a real implementation, this would:
    // 1. Validate domain ownership
    // 2. Generate CSR (Certificate Signing Request)
    // 3. Request certificate from CA (Let's Encrypt, custom CA, etc.)
    // 4. Install certificate
    // 5. Configure auto-renewal if enabled
    // 6. Update status to active

    // Simulate certificate provisioning
    setTimeout(() => {
      const certIndex = certificates.findIndex(c => c.id === newCert.id)
      if (certIndex !== -1) {
        const cert = certificates[certIndex]
        cert.status = "active"
        cert.issuer = "Let's Encrypt"
        cert.fingerprint = `REAL-FINGERPRINT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      }
    }, 60000) // Simulate 60 second provisioning

    return NextResponse.json({
      success: true,
      data: newCert,
      message: 'Certificate provisioning started successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating certificate:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create certificate' },
      { status: 500 }
    )
  }
}