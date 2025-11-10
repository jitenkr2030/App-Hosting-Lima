#!/usr/bin/env node

/**
 * LimaHost Agent Service Installation Script
 * 
 * This script installs the LimaHost agent as a system service
 * on Linux systems using systemd.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

class AgentInstaller {
  constructor() {
    this.platform = os.platform();
    this.isRoot = process.getuid && process.getuid() === 0;
    
    if (this.platform !== 'linux') {
      console.error('This installer is only supported on Linux systems.');
      process.exit(1);
    }
    
    if (!this.isRoot) {
      console.error('This installer must be run as root.');
      process.exit(1);
    }
    
    this.agentDir = '/opt/limahost-agent';
    this.configDir = '/etc/limahost';
    this.logDir = '/var/log/limahost';
    this.serviceFile = '/etc/systemd/system/limahost-agent.service';
  }
  
  async install() {
    try {
      console.log('Installing LimaHost Agent...');
      
      // Create directories
      await this.createDirectories();
      
      // Copy agent files
      await this.copyAgentFiles();
      
      // Install dependencies
      await this.installDependencies();
      
      // Create default configuration
      await this.createDefaultConfig();
      
      // Create systemd service
      await this.createSystemService();
      
      // Enable and start service
      await this.enableAndStartService();
      
      console.log('✅ LimaHost Agent installed successfully!');
      console.log('');
      console.log('Service status:');
      execSync('systemctl status limahost-agent', { stdio: 'inherit' });
      console.log('');
      console.log('To view logs:');
      console.log('  journalctl -u limahost-agent -f');
      console.log('');
      console.log('To configure the agent:');
      console.log('  Edit /etc/limahost/config.json');
      console.log('  Then restart: systemctl restart limahost-agent');
      
    } catch (error) {
      console.error('❌ Installation failed:', error.message);
      process.exit(1);
    }
  }
  
  async createDirectories() {
    console.log('Creating directories...');
    
    const directories = [
      this.agentDir,
      this.configDir,
      this.logDir,
      path.join(this.agentDir, 'scripts')
    ];
    
    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`  Created: ${dir}`);
      }
    }
  }
  
  async copyAgentFiles() {
    console.log('Copying agent files...');
    
    const sourceDir = path.dirname(__dirname);
    const files = [
      'agent.js',
      'package.json',
      'config.json'
    ];
    
    for (const file of files) {
      const source = path.join(sourceDir, file);
      const dest = path.join(this.agentDir, file);
      
      try {
        await fs.copyFile(source, dest);
        console.log(`  Copied: ${file}`);
      } catch (error) {
        throw new Error(`Failed to copy ${file}: ${error.message}`);
      }
    }
    
    // Copy scripts directory
    const scriptsSource = path.join(sourceDir, 'scripts');
    const scriptsDest = path.join(this.agentDir, 'scripts');
    
    try {
      const scriptFiles = await fs.readdir(scriptsSource);
      for (const scriptFile of scriptFiles) {
        const source = path.join(scriptsSource, scriptFile);
        const dest = path.join(scriptsDest, scriptFile);
        await fs.copyFile(source, dest);
      }
      console.log('  Copied: scripts/');
    } catch (error) {
      console.warn('  Warning: Could not copy scripts directory');
    }
  }
  
  async installDependencies() {
    console.log('Installing Node.js dependencies...');
    
    try {
      process.chdir(this.agentDir);
      execSync('npm install --production', { stdio: 'inherit' });
      console.log('  Dependencies installed successfully');
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  }
  
  async createDefaultConfig() {
    console.log('Creating default configuration...');
    
    const configPath = path.join(this.configDir, 'config.json');
    
    try {
      await fs.access(configPath);
      console.log('  Configuration already exists, skipping...');
    } catch {
      const defaultConfig = {
        agentId: `agent-${os.hostname()}`,
        agentName: os.hostname(),
        controlPlaneUrl: "https://api.limahost.com",
        controlPlaneApiKey: "CHANGE_ME",
        heartbeatInterval: 30000,
        metricsInterval: 10000,
        vmDataDir: path.join(os.homedir(), '.lima'),
        maxConcurrentOperations: 3,
        allowedCommands: [
          "limactl",
          "docker", 
          "nerdctl",
          "ssh",
          "rsync",
          "tar"
        ],
        logLevel: "info",
        logFile: path.join(this.logDir, 'agent.log')
      };
      
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
      console.log(`  Created: ${configPath}`);
      console.log('  ⚠️  IMPORTANT: Edit the configuration file and set your API key!');
    }
  }
  
  async createSystemService() {
    console.log('Creating systemd service...');
    
    const serviceContent = `[Unit]
Description=LimaHost Agent
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${this.agentDir}
ExecStart=/usr/bin/node ${this.agentDir}/agent.js --config ${this.configDir}/config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${this.agentDir} ${this.configDir} ${this.logDir}
ReadOnlyPaths=/usr /etc /opt

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
`;
    
    await fs.writeFile(this.serviceFile, serviceContent);
    console.log(`  Created: ${this.serviceFile}`);
    
    // Reload systemd
    execSync('systemctl daemon-reload');
  }
  
  async enableAndStartService() {
    console.log('Enabling and starting service...');
    
    try {
      execSync('systemctl enable limahost-agent');
      console.log('  Service enabled');
      
      execSync('systemctl start limahost-agent');
      console.log('  Service started');
      
      // Wait a moment and check status
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const status = execSync('systemctl is-active limahost-agent').toString().trim();
      if (status === 'active') {
        console.log('  ✅ Service is running');
      } else {
        console.log('  ⚠️  Service may not be running properly');
      }
      
    } catch (error) {
      throw new Error(`Failed to enable/start service: ${error.message}`);
    }
  }
}

// Run installer
if (require.main === module) {
  const installer = new AgentInstaller();
  installer.install();
}

module.exports = AgentInstaller;