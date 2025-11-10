#!/usr/bin/env node

/**
 * LimaHost Backup Service Installation Script
 * 
 * This script installs the LimaHost backup service as a system service
 * and sets up the necessary configuration.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

class BackupServiceInstaller {
  constructor() {
    this.platform = os.platform();
    this.isRoot = process.getuid && process.getuid() === 0;
    this.installDir = '/opt/limahost-backup';
    this.configDir = '/etc/limahost';
    this.logDir = '/var/log/limahost';
    this.dataDir = '/var/lib/limahost/backups';
    this.serviceName = 'limahost-backup';
    
    this.checkRequirements();
  }
  
  checkRequirements() {
    console.log('🔍 Checking requirements...');
    
    // Check if running as root
    if (!this.isRoot) {
      console.error('❌ This script must be run as root (sudo)');
      process.exit(1);
    }
    
    // Check platform
    if (this.platform !== 'linux') {
      console.error('❌ This installer only supports Linux');
      process.exit(1);
    }
    
    // Check if Node.js is installed
    try {
      execSync('node --version', { stdio: 'pipe' });
      console.log('✅ Node.js is installed');
    } catch (error) {
      console.error('❌ Node.js is required but not installed');
      process.exit(1);
    }
    
    // Check if Lima is installed
    try {
      execSync('limactl --version', { stdio: 'pipe' });
      console.log('✅ Lima is installed');
    } catch (error) {
      console.error('❌ Lima is required but not installed');
      console.error('Please install Lima from: https://github.com/lima-vm/lima');
      process.exit(1);
    }
    
    // Check if rsync is installed (required for efficient backups)
    try {
      execSync('rsync --version', { stdio: 'pipe' });
      console.log('✅ rsync is installed');
    } catch (error) {
      console.error('❌ rsync is required but not installed');
      console.error('Please install rsync: apt-get install rsync');
      process.exit(1);
    }
    
    console.log('✅ All requirements met\n');
  }
  
  async install() {
    console.log('🚀 Starting LimaHost Backup Service installation...\n');
    
    try {
      // Create directories
      await this.createDirectories();
      
      // Copy files
      await this.copyFiles();
      
      // Install dependencies
      await this.installDependencies();
      
      // Create configuration
      await this.createConfiguration();
      
      // Install system service
      await this.installService();
      
      // Start service
      await this.startService();
      
      console.log('🎉 Installation completed successfully!');
      this.showNextSteps();
      
    } catch (error) {
      console.error('❌ Installation failed:', error.message);
      process.exit(1);
    }
  }
  
  async createDirectories() {
    console.log('📁 Creating directories...');
    
    const directories = [
      this.installDir,
      this.configDir,
      this.logDir,
      this.dataDir,
      path.join(this.dataDir, 'metadata'),
      path.join(this.dataDir, 'chunks'),
      path.join(this.dataDir, 'indexes'),
      path.join(this.configDir, 'backup-templates')
    ];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        console.log(`  Created: ${dir}`);
      }
    }
    
    // Set proper permissions for data directory
    fs.chmodSync(this.dataDir, 0o750);
    
    console.log('✅ Directories created\n');
  }
  
  async copyFiles() {
    console.log('📋 Copying files...');
    
    const sourceDir = path.dirname(__dirname);
    
    // Copy service files
    const filesToCopy = [
      'backup-service.js',
      'package.json'
    ];
    
    for (const file of filesToCopy) {
      const source = path.join(sourceDir, file);
      const dest = path.join(this.installDir, file);
      
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, dest);
        fs.chmodSync(dest, 0o644);
        console.log(`  Copied: ${file}`);
      }
    }
    
    // Make backup-service.js executable
    const servicePath = path.join(this.installDir, 'backup-service.js');
    if (fs.existsSync(servicePath)) {
      fs.chmodSync(servicePath, 0o755);
      console.log('  Made backup-service.js executable');
    }
    
    console.log('✅ Files copied\n');
  }
  
  async installDependencies() {
    console.log('📦 Installing dependencies...');
    
    try {
      process.chdir(this.installDir);
      execSync('npm install --production', { 
        stdio: 'inherit',
        env: { ...process.env, PATH: '/usr/local/bin:' + process.env.PATH }
      });
      console.log('✅ Dependencies installed\n');
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  }
  
  async createConfiguration() {
    console.log('⚙️  Creating configuration...');
    
    const configTemplate = {
      serviceName: 'limahost-backup',
      dataDir: this.dataDir,
      logDir: this.logDir,
      tempDir: '/tmp/limahost-backup',
      
      // Storage configuration
      storageBackend: 'local',
      storageConfig: {
        local: {
          basePath: '/backups/limahost'
        },
        s3: {
          bucket: 'limahost-backups',
          region: 'us-east-1'
        },
        minio: {
          endPoint: 'localhost:9000',
          bucket: 'limahost-backups',
          useSSL: false
        }
      },
      
      // Backup settings
      defaultCompression: 'gzip',
      defaultEncryption: 'none',
      compressionLevel: 6,
      chunkSize: 64 * 1024 * 1024, // 64MB
      
      // Retention policies
      retention: {
        daily: 7,
        weekly: 4,
        monthly: 12,
        yearly: 3
      },
      
      // Scheduling
      schedules: {
        daily: '0 2 * * *',     // 2 AM daily
        weekly: '0 3 * * 0',   // 3 AM Sunday
        monthly: '0 4 1 * *'    // 4 AM 1st of month
      },
      
      // Performance
      maxConcurrentBackups: 3,
      maxConcurrentRestores: 2,
      timeout: 3600000, // 1 hour
      
      // Security
      requireIntegrityCheck: true,
      
      // Monitoring
      healthCheckInterval: 300000, // 5 minutes
      metricsInterval: 60000, // 1 minute
      
      // Logging
      logLevel: 'info',
      logRetention: 30
    };
    
    const configFile = path.join(this.configDir, 'backup-config.json');
    fs.writeFileSync(configFile, JSON.stringify(configTemplate, null, 2));
    console.log(`  Created: ${configFile}`);
    
    // Create backup templates
    const templates = {
      'quick-backup': {
        description: 'Quick backup with minimal compression',
        compression: 'none',
        encryption: 'none',
        stopVm: false,
        timeout: 1800000 // 30 minutes
      },
      'full-backup': {
        description: 'Full backup with compression and encryption',
        compression: 'gzip',
        encryption: 'aes256',
        stopVm: true,
        timeout: 7200000 // 2 hours
      },
      'incremental': {
        description: 'Incremental backup (if supported)',
        compression: 'gzip',
        encryption: 'none',
        stopVm: false,
        timeout: 3600000 // 1 hour
      }
    };
    
    const templatesDir = path.join(this.configDir, 'backup-templates');
    for (const [name, template] of Object.entries(templates)) {
      const templateFile = path.join(templatesDir, `${name}.json`);
      fs.writeFileSync(templateFile, JSON.stringify(template, null, 2));
      console.log(`  Created template: ${name}`);
    }
    
    // Create logrotate configuration
    const logrotateConfig = `
${this.logDir}/backup-service.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        systemctl reload ${this.serviceName} || true
    endscript
}`;
    
    const logrotateFile = path.join('/etc/logrotate.d', 'limahost-backup');
    fs.writeFileSync(logrotateFile, logrotateConfig.trim());
    console.log(`  Created: ${logrotateFile}`);
    
    // Create systemd tmpfiles configuration for temp directory
    const tmpfilesConfig = `d /tmp/limahost-backup 0755 root root -`;
    const tmpfilesFile = path.join('/etc/tmpfiles.d', 'limahost-backup.conf');
    fs.writeFileSync(tmpfilesFile, tmpfilesConfig);
    console.log(`  Created: ${tmpfilesFile}`);
    
    console.log('✅ Configuration created\n');
  }
  
  async installService() {
    console.log('🔧 Installing system service...');
    
    const serviceContent = `[Unit]
Description=LimaHost Backup Service - VM Backup and Snapshot Management
After=network.target limahost-agent.service
Requires=limahost-agent.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node ${path.join(this.installDir, 'backup-service.js')}
WorkingDirectory=${this.installDir}
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=BACKUP_SERVICE_CONFIG=${path.join(this.configDir, 'backup-config.json')}
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${this.installDir} ${this.configDir} ${this.logDir} ${this.dataDir}
ReadOnlyPaths=/usr /etc /boot

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryMax=2G

# Capability settings
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE

# Sandboxing
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictSUIDSGID=true
RemoveIPC=true
PrivateMounts=true
SystemCallFilter=@system-service

[Install]
WantedBy=multi-user.target`;
    
    // Determine init system
    const serviceFile = path.join('/etc/systemd/system', `${this.serviceName}.service`);
    fs.writeFileSync(serviceFile, serviceContent);
    console.log(`  Created: ${serviceFile}`);
    
    // Reload systemd
    execSync('systemctl daemon-reload');
    console.log('  Reloaded systemd');
    
    // Enable service
    execSync(`systemctl enable ${this.serviceName}`);
    console.log(`  Enabled ${this.serviceName} service`);
    
    // Create tmpfiles
    execSync('systemd-tmpfiles --create /etc/tmpfiles.d/limahost-backup.conf');
    console.log('  Created temporary files directory');
    
    console.log('✅ System service installed\n');
  }
  
  async startService() {
    console.log('▶️  Starting service...');
    
    try {
      execSync(`systemctl start ${this.serviceName}`);
      console.log(`✅ ${this.serviceName} service started`);
      
      // Check status
      const status = execSync(`systemctl is-active ${this.serviceName}`, { encoding: 'utf8' }).trim();
      console.log(`  Status: ${status}`);
      
      // Check if service is healthy
      setTimeout(async () => {
        try {
          const health = await this.checkServiceHealth();
          if (health) {
            console.log('✅ Service health check passed');
          } else {
            console.log('⚠️  Service health check failed');
          }
        } catch (error) {
          console.log('⚠️  Could not verify service health:', error.message);
        }
      }, 5000);
      
    } catch (error) {
      throw new Error(`Failed to start service: ${error.message}`);
    }
    
    console.log('');
  }
  
  async checkServiceHealth() {
    try {
      const response = execSync(`curl -s http://localhost:8081/health`, { 
        encoding: 'utf8',
        timeout: 5000
      });
      const health = JSON.parse(response);
      return health.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
  
  showNextSteps() {
    console.log('📋 Next steps:');
    console.log('');
    console.log('1. Configure your backup service by editing:');
    console.log(`   ${path.join(this.configDir, 'backup-config.json')}`);
    console.log('');
    console.log('2. Configure storage backend (if using S3/MinIO):');
    console.log('   - Set AWS credentials for S3');
    console.log('   - Set MinIO credentials for MinIO');
    console.log('   - Configure bucket settings');
    console.log('');
    console.log('3. Set up encryption key (optional but recommended):');
    console.log('   export BACKUP_ENCRYPTION_KEY="your-encryption-key-here"');
    console.log('   systemctl restart limahost-backup');
    console.log('');
    console.log('4. Configure backup schedules:');
    console.log('   Edit the schedules section in the configuration file');
    console.log('   systemctl restart limahost-backup');
    console.log('');
    console.log('5. Test backup creation:');
    console.log('   sudo systemctl status limahost-backup');
    console.log('   curl -X POST http://localhost:8081/backups -d \'{"vmName":"your-vm"}\'');
    console.log('');
    console.log('6. Monitor service:');
    console.log('   sudo journalctl -u limahost-backup -f');
    console.log('   curl -s http://localhost:8081/metrics');
    console.log('');
    console.log('📚 Documentation:');
    console.log('   https://docs.limahost.com/backup-service');
    console.log('');
    console.log('🔧 Useful commands:');
    console.log('   # Service management');
    console.log('   sudo systemctl start limahost-backup');
    console.log('   sudo systemctl stop limahost-backup');
    console.log('   sudo systemctl restart limahost-backup');
    console.log('   sudo systemctl status limahost-backup');
    console.log('');
    console.log('   # Manual backup creation');
    console.log('   curl -X POST http://localhost:8081/backups \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"vmName":"my-app","type":"manual"}\'');
    console.log('');
    console.log('   # List backups');
    console.log('   curl -s http://localhost:8081/backups');
    console.log('');
    console.log('   # Get service metrics');
    console.log('   curl -s http://localhost:8081/metrics');
    console.log('');
  }
  
  async uninstall() {
    console.log('🗑️  Uninstalling LimaHost Backup Service...\n');
    
    try {
      // Stop and disable service
      console.log('🛑 Stopping service...');
      try {
        execSync(`systemctl stop ${this.serviceName}`);
        execSync(`systemctl disable ${this.serviceName}`);
        console.log('✅ Service stopped and disabled');
      } catch (error) {
        console.log('⚠️  Service was not running or not installed');
      }
      
      // Remove service files
      console.log('🗑️  Removing service files...');
      const serviceFile = path.join('/etc/systemd/system', `${this.serviceName}.service`);
      if (fs.existsSync(serviceFile)) {
        fs.unlinkSync(serviceFile);
        console.log(`  Removed: ${serviceFile}`);
      }
      
      const logrotateFile = path.join('/etc/logrotate.d', 'limahost-backup');
      if (fs.existsSync(logrotateFile)) {
        fs.unlinkSync(logrotateFile);
        console.log(`  Removed: ${logrotateFile}`);
      }
      
      const tmpfilesFile = path.join('/etc/tmpfiles.d', 'limahost-backup.conf');
      if (fs.existsSync(tmpfilesFile)) {
        fs.unlinkSync(tmpfilesFile);
        console.log(`  Removed: ${tmpfilesFile}`);
      }
      
      // Reload systemd
      execSync('systemctl daemon-reload');
      console.log('✅ Reloaded systemd');
      
      // Remove installation directory
      console.log('🗑️  Removing installation files...');
      if (fs.existsSync(this.installDir)) {
        fs.rmSync(this.installDir, { recursive: true, force: true });
        console.log(`  Removed: ${this.installDir}`);
      }
      
      // Remove configuration directory (preserve data)
      if (fs.existsSync(this.configDir)) {
        const configFiles = ['backup-config.json'];
        for (const file of configFiles) {
          const filePath = path.join(this.configDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`  Removed: ${filePath}`);
          }
        }
        
        // Remove templates directory
        const templatesDir = path.join(this.configDir, 'backup-templates');
        if (fs.existsSync(templatesDir)) {
          fs.rmSync(templatesDir, { recursive: true, force: true });
          console.log(`  Removed: ${templatesDir}`);
        }
        
        // Remove config directory if empty
        try {
          const remainingFiles = await fs.readdir(this.configDir);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(this.configDir);
            console.log(`  Removed: ${this.configDir}`);
          }
        } catch (error) {
          console.log(`  Left configuration directory: ${this.configDir}`);
        }
      }
      
      // Remove log directory (preserve logs)
      if (fs.existsSync(this.logDir)) {
        try {
          const logFiles = await fs.readdir(this.logDir);
          if (logFiles.length === 0) {
            fs.rmdirSync(this.logDir);
            console.log(`  Removed: ${this.logDir}`);
          } else {
            console.log(`  Left log directory with existing logs: ${this.logDir}`);
          }
        } catch (error) {
          console.log(`  Left log directory: ${this.logDir}`);
        }
      }
      
      // Ask about data directory
      console.log('');
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Remove backup data directory? [y/N]: ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        if (fs.existsSync(this.dataDir)) {
          fs.rmSync(this.dataDir, { recursive: true, force: true });
          console.log(`  Removed: ${this.dataDir}`);
        }
      } else {
        console.log(`  Preserved: ${this.dataDir}`);
      }
      
      console.log('');
      console.log('🎉 Uninstallation completed successfully!');
      
    } catch (error) {
      console.error('❌ Uninstallation failed:', error.message);
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const installer = new BackupServiceInstaller();
  
  if (args.includes('--uninstall') || args.includes('-u')) {
    installer.uninstall();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
LimaHost Backup Service Installer

Usage: node install-service.js [options]

Options:
  --uninstall, -u    Uninstall the backup service
  --help, -h         Show this help message

Examples:
  sudo node install-service.js     # Install backup service
  sudo node install-service.js -u  # Uninstall backup service
`);
  } else {
    installer.install();
  }
}

module.exports = BackupServiceInstaller;