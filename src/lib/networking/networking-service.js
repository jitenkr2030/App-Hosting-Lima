/**
 * LimaHost Networking Service
 * 
 * Manages domain mapping, SSL certificates, and load balancing
 * for applications running in Lima VMs.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const dns = require('dns').promises;
const https = require('https');
const http = require('http');

class NetworkingService {
  constructor(config = {}) {
    this.config = {
      // DNS configuration
      dnsProvider: config.dnsProvider || 'cloudflare', // 'cloudflare', 'route53', 'digitalocean', 'manual'
      dnsApiToken: config.dnsApiToken || process.env.DNS_API_TOKEN,
      
      // SSL/TLS configuration
      sslProvider: config.sslProvider || 'letsencrypt', // 'letsencrypt', 'custom', 'self-signed'
      sslEmail: config.sslEmail || 'admin@limahost.com',
      sslStaging: config.sslStaging || false,
      
      // Load balancer configuration
      loadBalancer: config.loadBalancer || 'nginx', // 'nginx', 'traefik', 'haproxy'
      loadBalancerConfigPath: config.loadBalancerConfigPath || '/etc/limahost/nginx',
      
      // Network configuration
      defaultPort: config.defaultPort || 8080,
      sslPort: config.sslPort || 8443,
      internalNetwork: config.internalNetwork || '192.168.64.0/24',
      
      // Logging
      logLevel: config.logLevel || 'info',
      logFile: config.logFile || '/var/log/limahost/networking.log',
      
      ...config
    };
    
    // Initialize state
    this.domains = new Map();
    this.certificates = new Map();
    this.loadBalancerRules = new Map();
    
    // Setup logging
    this.setupLogging();
    
    // Initialize networking
    this.initializeNetworking();
  }
  
  setupLogging() {
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.log = (level, message, data = {}) => {
      if (this.logLevels[level] <= this.logLevels[this.config.logLevel]) {
        const timestamp = new Date().toISOString();
        const logEntry = {
          timestamp,
          level,
          service: 'networking-service',
          message,
          ...data
        };
        
        console.log(JSON.stringify(logEntry));
        
        // Log to file (async)
        fs.appendFile(this.config.logFile, JSON.stringify(logEntry) + '\n').catch(err => {
          console.error('Failed to write to log file:', err);
        });
      }
    };
  }
  
  async initializeNetworking() {
    try {
      // Create necessary directories
      await fs.mkdir(this.config.loadBalancerConfigPath, { recursive: true });
      await fs.mkdir(path.join(this.config.loadBalancerConfigPath, 'ssl'), { recursive: true });
      await fs.mkdir(path.join(this.config.loadBalancerConfigPath, 'sites-available'), { recursive: true });
      await fs.mkdir(path.join(this.config.loadBalancerConfigPath, 'sites-enabled'), { recursive: true });
      
      // Initialize load balancer
      await this.initializeLoadBalancer();
      
      // Load existing domains and certificates
      await this.loadExistingConfiguration();
      
      this.log('info', 'Networking service initialized', {
        dnsProvider: this.config.dnsProvider,
        sslProvider: this.config.sslProvider,
        loadBalancer: this.config.loadBalancer
      });
      
    } catch (error) {
      this.log('error', 'Failed to initialize networking service', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Map a domain to an application
   */
  async mapDomain(options) {
    const {
      domain,
      appId,
      appName,
      vmName,
      vmIp,
      port = this.config.defaultPort,
      sslEnabled = true,
      forceHttps = true,
      description = ''
    } = options;
    
    try {
      this.log('info', 'Mapping domain to application', { 
        domain, 
        appName, 
        vmIp, 
        port 
      });
      
      // Validate domain
      if (!this.isValidDomain(domain)) {
        throw new Error(`Invalid domain: ${domain}`);
      }
      
      // Check if domain is already mapped
      if (this.domains.has(domain)) {
        throw new Error(`Domain ${domain} is already mapped`);
      }
      
      // Verify VM is accessible
      await this.verifyVmAccessibility(vmIp, port);
      
      // Create domain mapping
      const domainMapping = {
        id: `domain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        domain,
        appId,
        appName,
        vmName,
        vmIp,
        port,
        sslEnabled,
        forceHttps,
        status: 'provisioning',
        createdAt: new Date().toISOString(),
        description,
        dns: {
          configured: false,
          records: []
        },
        ssl: {
          configured: false,
          certificate: null,
          expiresAt: null
        },
        loadBalancer: {
          configured: false,
          configPath: null
        }
      };
      
      this.domains.set(domain, domainMapping);
      
      // Start provisioning process
      await this.provisionDomain(domainMapping);
      
      this.log('info', 'Domain mapping initiated', { 
        domain, 
        mappingId: domainMapping.id 
      });
      
      return {
        success: true,
        domain,
        mappingId: domainMapping.id,
        status: 'provisioning',
        message: 'Domain mapping initiated'
      };
      
    } catch (error) {
      this.log('error', 'Failed to map domain', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Provision domain (DNS, SSL, Load Balancer)
   */
  async provisionDomain(domainMapping) {
    try {
      this.log('info', 'Provisioning domain', { 
        domain: domainMapping.domain 
      });
      
      // Step 1: Configure DNS
      await this.configureDns(domainMapping);
      domainMapping.status = 'dns_configured';
      
      // Step 2: Configure SSL if enabled
      if (domainMapping.sslEnabled) {
        await this.configureSsl(domainMapping);
        domainMapping.status = 'ssl_configured';
      }
      
      // Step 3: Configure load balancer
      await this.configureLoadBalancerRule(domainMapping);
      domainMapping.status = 'load_balancer_configured';
      
      // Step 4: Verify everything is working
      await this.verifyDomainConfiguration(domainMapping);
      domainMapping.status = 'active';
      
      this.log('info', 'Domain provisioning completed', { 
        domain: domainMapping.domain 
      });
      
    } catch (error) {
      domainMapping.status = 'failed';
      domainMapping.error = error.message;
      
      this.log('error', 'Domain provisioning failed', { 
        domain: domainMapping.domain,
        error: error.message 
      });
      
      throw error;
    }
  }
  
  /**
   * Configure DNS records
   */
  async configureDns(domainMapping) {
    const { domain, vmIp } = domainMapping;
    
    try {
      this.log('info', 'Configuring DNS', { domain });
      
      switch (this.config.dnsProvider) {
        case 'cloudflare':
          await this.configureCloudflareDns(domain, vmIp);
          break;
        case 'route53':
          await this.configureRoute53Dns(domain, vmIp);
          break;
        case 'digitalocean':
          await this.configureDigitalOceanDns(domain, vmIp);
          break;
        case 'manual':
          this.log('info', 'Manual DNS configuration required', { domain });
          break;
        default:
          throw new Error(`Unsupported DNS provider: ${this.config.dnsProvider}`);
      }
      
      domainMapping.dns.configured = true;
      domainMapping.dns.records = [
        {
          type: 'A',
          name: domain,
          value: vmIp,
          ttl: 300
        }
      ];
      
      this.log('debug', 'DNS configured', { domain });
      
    } catch (error) {
      this.log('error', 'Failed to configure DNS', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Configure Cloudflare DNS
   */
  async configureCloudflareDns(domain, vmIp) {
    if (!this.config.dnsApiToken) {
      throw new Error('Cloudflare API token is required');
    }
    
    // Extract zone from domain
    const zone = this.extractZone(domain);
    
    // Create A record
    const record = {
      type: 'A',
      name: domain.replace(`.${zone}`, ''),
      content: vmIp,
      ttl: 300,
      proxied: false
    };
    
    // In a real implementation, you would use Cloudflare API
    // This is a mock implementation
    this.log('debug', 'Cloudflare DNS record created', { 
      domain, 
      record 
    });
  }
  
  /**
   * Configure Route53 DNS
   */
  async configureRoute53Dns(domain, vmIp) {
    if (!this.config.dnsApiToken) {
      throw new Error('AWS credentials are required for Route53');
    }
    
    // Extract zone from domain
    const zone = this.extractZone(domain);
    
    // Create A record
    const record = {
      Name: domain,
      Type: 'A',
      TTL: 300,
      ResourceRecords: [{ Value: vmIp }]
    };
    
    // In a real implementation, you would use AWS SDK
    // This is a mock implementation
    this.log('debug', 'Route53 DNS record created', { 
      domain, 
      record 
    });
  }
  
  /**
   * Configure DigitalOcean DNS
   */
  async configureDigitalOceanDns(domain, vmIp) {
    if (!this.config.dnsApiToken) {
      throw new Error('DigitalOcean API token is required');
    }
    
    // Create A record
    const record = {
      type: 'A',
      name: domain,
      data: vmIp,
      priority: null,
      port: null,
      weight: null,
      flags: null,
      tag: null
    };
    
    // In a real implementation, you would use DigitalOcean API
    // This is a mock implementation
    this.log('debug', 'DigitalOcean DNS record created', { 
      domain, 
      record 
    });
  }
  
  /**
   * Configure SSL certificate
   */
  async configureSsl(domainMapping) {
    const { domain } = domainMapping;
    
    try {
      this.log('info', 'Configuring SSL', { domain });
      
      switch (this.config.sslProvider) {
        case 'letsencrypt':
          await this.configureLetsEncryptSsl(domainMapping);
          break;
        case 'custom':
          await this.configureCustomSsl(domainMapping);
          break;
        case 'self-signed':
          await this.configureSelfSignedSsl(domainMapping);
          break;
        default:
          throw new Error(`Unsupported SSL provider: ${this.config.sslProvider}`);
      }
      
      domainMapping.ssl.configured = true;
      
      this.log('debug', 'SSL configured', { domain });
      
    } catch (error) {
      this.log('error', 'Failed to configure SSL', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Configure Let's Encrypt SSL
   */
  async configureLetsEncryptSsl(domainMapping) {
    const { domain } = domainMapping;
    
    try {
      // Check if certificate already exists
      const existingCert = this.certificates.get(domain);
      if (existingCert && this.isCertificateValid(existingCert)) {
        domainMapping.ssl.certificate = existingCert;
        domainMapping.ssl.expiresAt = existingCert.expiresAt;
        return;
      }
      
      // Request new certificate from Let's Encrypt
      const certInfo = await this.requestLetsEncryptCertificate(domain);
      
      // Store certificate
      this.certificates.set(domain, certInfo);
      
      // Save certificate files
      const certPath = path.join(this.config.loadBalancerConfigPath, 'ssl', `${domain}.crt`);
      const keyPath = path.join(this.config.loadBalancerConfigPath, 'ssl', `${domain}.key`);
      
      await fs.writeFile(certPath, certInfo.certificate);
      await fs.writeFile(keyPath, certInfo.privateKey);
      
      domainMapping.ssl.certificate = certInfo;
      domainMapping.ssl.expiresAt = certInfo.expiresAt;
      
      this.log('debug', 'Let\'s Encrypt certificate obtained', { 
        domain, 
        expiresAt: certInfo.expiresAt 
      });
      
    } catch (error) {
      this.log('error', 'Failed to configure Let\'s Encrypt SSL', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Request Let's Encrypt certificate
   */
  async requestLetsEncryptCertificate(domain) {
    // In a real implementation, you would use a Let's Encrypt client like acme-client
    // This is a mock implementation
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 days from now
    
    return {
      issuer: 'Let\'s Encrypt',
      certificate: `-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE_FOR_${domain.toUpperCase()}\n-----END CERTIFICATE-----`,
      privateKey: `-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY_FOR_${domain.toUpperCase()}\n-----END PRIVATE KEY-----`,
      expiresAt: expiresAt.toISOString(),
      fingerprint: `MOCK_FINGERPRINT_${Math.random().toString(36).substr(2, 9)}`
    };
  }
  
  /**
   * Configure custom SSL certificate
   */
  async configureCustomSsl(domainMapping) {
    const { domain } = domainMapping;
    
    // In a real implementation, you would allow users to upload their own certificates
    // This is a mock implementation
    throw new Error('Custom SSL configuration not implemented');
  }
  
  /**
   * Configure self-signed SSL certificate
   */
  async configureSelfSignedSsl(domainMapping) {
    const { domain } = domainMapping;
    
    try {
      // Generate self-signed certificate
      const certInfo = await this.generateSelfSignedCertificate(domain);
      
      // Store certificate
      this.certificates.set(domain, certInfo);
      
      // Save certificate files
      const certPath = path.join(this.config.loadBalancerConfigPath, 'ssl', `${domain}.crt`);
      const keyPath = path.join(this.config.loadBalancerConfigPath, 'ssl', `${domain}.key`);
      
      await fs.writeFile(certPath, certInfo.certificate);
      await fs.writeFile(keyPath, certInfo.privateKey);
      
      domainMapping.ssl.certificate = certInfo;
      domainMapping.ssl.expiresAt = certInfo.expiresAt;
      
      this.log('debug', 'Self-signed certificate generated', { 
        domain, 
        expiresAt: certInfo.expiresAt 
      });
      
    } catch (error) {
      this.log('error', 'Failed to configure self-signed SSL', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Generate self-signed certificate
   */
  async generateSelfSignedCertificate(domain) {
    // In a real implementation, you would use OpenSSL or node-forge
    // This is a mock implementation
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365); // 1 year from now
    
    return {
      issuer: 'Self-Signed',
      certificate: `-----BEGIN CERTIFICATE-----\nSELF_SIGNED_CERT_FOR_${domain.toUpperCase()}\n-----END CERTIFICATE-----`,
      privateKey: `-----BEGIN PRIVATE KEY-----\nSELF_SIGNED_KEY_FOR_${domain.toUpperCase()}\n-----END PRIVATE KEY-----`,
      expiresAt: expiresAt.toISOString(),
      fingerprint: `SELF_SIGNED_FINGERPRINT_${Math.random().toString(36).substr(2, 9)}`
    };
  }
  
  /**
   * Configure load balancer rule
   */
  async configureLoadBalancerRule(domainMapping) {
    const { domain, vmIp, port, sslEnabled, forceHttps } = domainMapping;
    
    try {
      this.log('info', 'Configuring load balancer rule', { domain });
      
      switch (this.config.loadBalancer) {
        case 'nginx':
          await this.configureNginxRule(domainMapping);
          break;
        case 'traefik':
          await this.configureTraefikRule(domainMapping);
          break;
        case 'haproxy':
          await this.configureHAProxyRule(domainMapping);
          break;
        default:
          throw new Error(`Unsupported load balancer: ${this.config.loadBalancer}`);
      }
      
      domainMapping.loadBalancer.configured = true;
      
      this.log('debug', 'Load balancer rule configured', { domain });
      
    } catch (error) {
      this.log('error', 'Failed to configure load balancer rule', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Configure Nginx rule
   */
  async configureNginxRule(domainMapping) {
    const { domain, vmIp, port, sslEnabled, forceHttps } = domainMapping;
    
    try {
      // Generate Nginx configuration
      const nginxConfig = this.generateNginxConfig(domainMapping);
      
      // Save configuration
      const configPath = path.join(this.config.loadBalancerConfigPath, 'sites-available', `${domain}.conf`);
      await fs.writeFile(configPath, nginxConfig);
      
      // Enable site
      const enabledPath = path.join(this.config.loadBalancerConfigPath, 'sites-enabled', `${domain}.conf`);
      await fs.symlink(configPath, enabledPath);
      
      // Test Nginx configuration
      await this.testNginxConfig();
      
      // Reload Nginx
      await this.reloadNginx();
      
      domainMapping.loadBalancer.configPath = configPath;
      
      this.log('debug', 'Nginx rule configured', { domain });
      
    } catch (error) {
      this.log('error', 'Failed to configure Nginx rule', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Generate Nginx configuration
   */
  generateNginxConfig(domainMapping) {
    const { domain, vmIp, port, sslEnabled, forceHttps } = domainMapping;
    
    let config = `# Configuration for ${domain}
server {
    listen 80;
    server_name ${domain};
    
    # Redirect to HTTPS if SSL is enabled
`;
    
    if (sslEnabled && forceHttps) {
      config += `    return 301 https://$host$request_uri;\n`;
    } else {
      config += `    location / {
        proxy_pass http://${vmIp}:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}`;
    }
    
    config += `}
`;
    
    if (sslEnabled) {
      config += `# HTTPS configuration for ${domain}
server {
    listen 443 ssl http2;
    server_name ${domain};
    
    # SSL configuration
    ssl_certificate ${this.config.loadBalancerConfigPath}/ssl/${domain}.crt;
    ssl_certificate_key ${this.config.loadBalancerConfigPath}/ssl/${domain}.key;
    
    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Main location
    location / {
        proxy_pass http://${vmIp}:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        
        # Headers
        proxy_set_header Connection "";
        proxy_http_version 1.1;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
    
    # Static files caching (if needed)
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://${vmIp}:${port};
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;
    }
    
    return config;
  }
  
  /**
   * Test Nginx configuration
   */
  async testNginxConfig() {
    try {
      execSync('nginx -t', { stdio: 'pipe' });
    } catch (error) {
      throw new Error(`Nginx configuration test failed: ${error.message}`);
    }
  }
  
  /**
   * Reload Nginx
   */
  async reloadNginx() {
    try {
      execSync('nginx -s reload', { stdio: 'pipe' });
    } catch (error) {
      throw new Error(`Failed to reload Nginx: ${error.message}`);
    }
  }
  
  /**
   * Configure Traefik rule
   */
  async configureTraefikRule(domainMapping) {
    // In a real implementation, you would configure Traefik
    throw new Error('Traefik configuration not implemented');
  }
  
  /**
   * Configure HAProxy rule
   */
  async configureHAProxyRule(domainMapping) {
    // In a real implementation, you would configure HAProxy
    throw new Error('HAProxy configuration not implemented');
  }
  
  /**
   * Verify domain configuration
   */
  async verifyDomainConfiguration(domainMapping) {
    const { domain, vmIp, port, sslEnabled } = domainMapping;
    
    try {
      this.log('info', 'Verifying domain configuration', { domain });
      
      // Wait for DNS propagation
      await this.waitForDnsPropagation(domain, vmIp);
      
      // Test HTTP connectivity
      await this.testHttpConnectivity(domain, port);
      
      // Test HTTPS connectivity if SSL is enabled
      if (sslEnabled) {
        await this.testHttpsConnectivity(domain, port);
      }
      
      this.log('debug', 'Domain configuration verified', { domain });
      
    } catch (error) {
      this.log('error', 'Domain configuration verification failed', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Wait for DNS propagation
   */
  async waitForDnsPropagation(domain, expectedIp, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const addresses = await dns.resolve4(domain);
        if (addresses.includes(expectedIp)) {
          this.log('debug', 'DNS propagation completed', { domain, attempts: i + 1 });
          return;
        }
      } catch (error) {
        // DNS not yet propagated
      }
      
      this.log('debug', 'Waiting for DNS propagation', { domain, attempt: i + 1 });
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    throw new Error(`DNS propagation failed for ${domain} after ${maxAttempts} attempts`);
  }
  
  /**
   * Test HTTP connectivity
   */
  async testHttpConnectivity(domain, port) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: domain,
        port: port,
        path: '/health',
        method: 'GET',
        timeout: 10000
      };
      
      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP health check failed with status ${res.statusCode}`));
        }
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HTTP health check timeout'));
      });
      
      req.end();
    });
  }
  
  /**
   * Test HTTPS connectivity
   */
  async testHttpsConnectivity(domain, port) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: domain,
        port: port,
        path: '/health',
        method: 'GET',
        timeout: 10000,
        rejectUnauthorized: false // Don't reject self-signed certificates during testing
      };
      
      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTPS health check failed with status ${res.statusCode}`));
        }
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HTTPS health check timeout'));
      });
      
      req.end();
    });
  }
  
  /**
   * Verify VM accessibility
   */
  async verifyVmAccessibility(vmIp, port) {
    try {
      await this.testHttpConnectivity(vmIp, port);
    } catch (error) {
      throw new Error(`VM not accessible at ${vmIp}:${port} - ${error.message}`);
    }
  }
  
  /**
   * Remove domain mapping
   */
  async removeDomain(domain) {
    try {
      this.log('info', 'Removing domain mapping', { domain });
      
      const domainMapping = this.domains.get(domain);
      if (!domainMapping) {
        throw new Error(`Domain ${domain} is not mapped`);
      }
      
      // Remove load balancer configuration
      if (domainMapping.loadBalancer.configured) {
        await this.removeLoadBalancerRule(domainMapping);
      }
      
      // Remove SSL certificate
      if (domainMapping.ssl.configured) {
        await this.removeSslCertificate(domainMapping);
      }
      
      // Remove DNS records
      if (domainMapping.dns.configured) {
        await this.removeDnsRecords(domainMapping);
      }
      
      // Remove from domain mappings
      this.domains.delete(domain);
      
      this.log('info', 'Domain mapping removed', { domain });
      
      return {
        success: true,
        domain,
        message: 'Domain mapping removed successfully'
      };
      
    } catch (error) {
      this.log('error', 'Failed to remove domain mapping', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Remove load balancer rule
   */
  async removeLoadBalancerRule(domainMapping) {
    const { domain } = domainMapping;
    
    try {
      // Remove symlink
      const enabledPath = path.join(this.config.loadBalancerConfigPath, 'sites-enabled', `${domain}.conf`);
      try {
        await fs.unlink(enabledPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Remove configuration file
      const configPath = path.join(this.config.loadBalancerConfigPath, 'sites-available', `${domain}.conf`);
      try {
        await fs.unlink(configPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Reload load balancer
      await this.reloadNginx();
      
      domainMapping.loadBalancer.configured = false;
      
      this.log('debug', 'Load balancer rule removed', { domain });
      
    } catch (error) {
      this.log('error', 'Failed to remove load balancer rule', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Remove SSL certificate
   */
  async removeSslCertificate(domainMapping) {
    const { domain } = domainMapping;
    
    try {
      // Remove certificate files
      const certPath = path.join(this.config.loadBalancerConfigPath, 'ssl', `${domain}.crt`);
      const keyPath = path.join(this.config.loadBalancerConfigPath, 'ssl', `${domain}.key`);
      
      try {
        await fs.unlink(certPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      try {
        await fs.unlink(keyPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Remove from certificates map
      this.certificates.delete(domain);
      
      domainMapping.ssl.configured = false;
      domainMapping.ssl.certificate = null;
      domainMapping.ssl.expiresAt = null;
      
      this.log('debug', 'SSL certificate removed', { domain });
      
    } catch (error) {
      this.log('error', 'Failed to remove SSL certificate', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Remove DNS records
   */
  async removeDnsRecords(domainMapping) {
    const { domain } = domainMapping;
    
    try {
      switch (this.config.dnsProvider) {
        case 'cloudflare':
          await this.removeCloudflareDns(domain);
          break;
        case 'route53':
          await this.removeRoute53Dns(domain);
          break;
        case 'digitalocean':
          await this.removeDigitalOceanDns(domain);
          break;
        case 'manual':
          this.log('info', 'Manual DNS removal required', { domain });
          break;
        default:
          throw new Error(`Unsupported DNS provider: ${this.config.dnsProvider}`);
      }
      
      domainMapping.dns.configured = false;
      domainMapping.dns.records = [];
      
      this.log('debug', 'DNS records removed', { domain });
      
    } catch (error) {
      this.log('error', 'Failed to remove DNS records', { 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Remove Cloudflare DNS
   */
  async removeCloudflareDns(domain) {
    // In a real implementation, you would use Cloudflare API
    this.log('debug', 'Cloudflare DNS records removed', { domain });
  }
  
  /**
   * Remove Route53 DNS
   */
  async removeRoute53Dns(domain) {
    // In a real implementation, you would use AWS SDK
    this.log('debug', 'Route53 DNS records removed', { domain });
  }
  
  /**
   * Remove DigitalOcean DNS
   */
  async removeDigitalOceanDns(domain) {
    // In a real implementation, you would use DigitalOcean API
    this.log('debug', 'DigitalOcean DNS records removed', { domain });
  }
  
  /**
   * Initialize load balancer
   */
  async initializeLoadBalancer() {
    try {
      // Generate main Nginx configuration
      const mainConfig = this.generateMainNginxConfig();
      const mainConfigPath = path.join(this.config.loadBalancerConfigPath, 'nginx.conf');
      
      await fs.writeFile(mainConfigPath, mainConfig);
      
      this.log('debug', 'Load balancer initialized');
      
    } catch (error) {
      this.log('error', 'Failed to initialize load balancer', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Generate main Nginx configuration
   */
  generateMainNginxConfig() {
    return `user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        application/atom+xml
        application/javascript
        application/json
        application/ld+json
        application/manifest+json
        application/rss+xml
        application/vnd.geo+json
        application/vnd.ms-fontobject
        application/x-font-ttf
        application/x-web-app-manifest+json
        application/xhtml+xml
        application/xml
        font/opentype
        image/bmp
        image/svg+xml
        image/x-icon
        text/cache-manifest
        text/css
        text/plain
        text/vcard
        text/vnd.rim.location.xloc
        text/vtt
        text/x-component
        text/x-cross-domain-policy;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Include site configurations
    include ${this.config.loadBalancerConfigPath}/sites-enabled/*.conf;
}`;
  }
  
  /**
   * Load existing configuration
   */
  async loadExistingConfiguration() {
    try {
      // Load existing domain mappings
      // In a real implementation, you would load from a database
      this.log('debug', 'Existing configuration loaded');
      
    } catch (error) {
      this.log('error', 'Failed to load existing configuration', { error: error.message });
      // Don't throw here, as this is not critical
    }
  }
  
  /**
   * Helper methods
   */
  isValidDomain(domain) {
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }
  
  extractZone(domain) {
    const parts = domain.split('.');
    return parts.slice(-2).join('.');
  }
  
  isCertificateValid(certificate) {
    if (!certificate.expiresAt) return false;
    const expiresAt = new Date(certificate.expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 30; // Valid if more than 30 days until expiry
  }
  
  /**
   * Get domain mapping
   */
  getDomainMapping(domain) {
    return this.domains.get(domain);
  }
  
  /**
   * List domain mappings
   */
  listDomainMappings(filters = {}) {
    let mappings = Array.from(this.domains.values());
    
    if (filters.appId) {
      mappings = mappings.filter(m => m.appId === filters.appId);
    }
    
    if (filters.status) {
      mappings = mappings.filter(m => m.status === filters.status);
    }
    
    return mappings;
  }
  
  /**
   * Get certificate information
   */
  getCertificate(domain) {
    return this.certificates.get(domain);
  }
  
  /**
   * List certificates
   */
  listCertificates(filters = {}) {
    let certs = Array.from(this.certificates.values());
    
    if (filters.validOnly) {
      const now = new Date();
      certs = certs.filter(cert => {
        const expiresAt = new Date(cert.expiresAt);
        return expiresAt > now;
      });
    }
    
    return certs;
  }
  
  /**
   * Get networking statistics
   */
  getStatistics() {
    const totalDomains = this.domains.size;
    const activeDomains = Array.from(this.domains.values()).filter(d => d.status === 'active').length;
    const sslEnabledDomains = Array.from(this.domains.values()).filter(d => d.sslEnabled).length;
    const totalCertificates = this.certificates.size;
    const validCertificates = Array.from(this.certificates.values()).filter(cert => this.isCertificateValid(cert)).length;
    
    return {
      totalDomains,
      activeDomains,
      sslEnabledDomains,
      totalCertificates,
      validCertificates,
      expiringCertificates: totalCertificates - validCertificates
    };
  }
}

module.exports = NetworkingService;