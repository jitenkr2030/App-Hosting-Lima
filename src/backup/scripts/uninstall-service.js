#!/usr/bin/env node

/**
 * LimaHost Backup Service Uninstallation Script
 * 
 * This script uninstalls the LimaHost backup service
 * and removes all related files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BackupServiceUninstaller {
  constructor() {
    this.isRoot = process.getuid && process.getuid() === 0;
    this.serviceName = 'limahost-backup';
    this.installDir = '/opt/limahost-backup';
    this.configDir = '/etc/limahost';
    this.logDir = '/var/log/limahost';
    this.dataDir = '/var/lib/limahost/backups';
    
    this.checkRequirements();
  }
  
  checkRequirements() {
    console.log('🔍 Checking requirements...');
    
    // Check if running as root
    if (!this.isRoot) {
      console.error('❌ This script must be run as root (sudo)');
      process.exit(1);
    }
    
    console.log('✅ Requirements met\n');
  }
  
  async uninstall() {
    console.log('🗑️  Uninstalling LimaHost Backup Service...\n');
    
    try {
      // Stop and disable service
      await this.stopService();
      
      // Remove service files
      await this.removeServiceFiles();
      
      // Remove installation files
      await this.removeInstallationFiles();
      
      // Remove configuration and logs
      await this.removeDataFiles();
      
      console.log('🎉 Uninstallation completed successfully!');
      
    } catch (error) {
      console.error('❌ Uninstallation failed:', error.message);
      process.exit(1);
    }
  }
  
  async stopService() {
    console.log('🛑 Stopping service...');
    
    try {
      // Check if service exists
      const serviceFile = path.join('/etc/systemd/system', `${this.serviceName}.service`);
      if (!fs.existsSync(serviceFile)) {
        console.log('⚠️  Service is not installed');
        return;
      }
      
      // Stop service
      try {
        execSync(`systemctl stop ${this.serviceName}`, { stdio: 'pipe' });
        console.log('  Service stopped');
      } catch (error) {
        console.log('⚠️  Service was not running');
      }
      
      // Disable service
      try {
        execSync(`systemctl disable ${this.serviceName}`, { stdio: 'pipe' });
        console.log('  Service disabled');
      } catch (error) {
        console.log('⚠️  Service was not enabled');
      }
      
    } catch (error) {
      throw new Error(`Failed to stop service: ${error.message}`);
    }
  }
  
  async removeServiceFiles() {
    console.log('🗑️  Removing service files...');
    
    const filesToRemove = [
      path.join('/etc/systemd/system', `${this.serviceName}.service`),
      path.join('/etc/logrotate.d', 'limahost-backup'),
      path.join('/etc/tmpfiles.d', 'limahost-backup.conf')
    ];
    
    for (const file of filesToRemove) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`  Removed: ${file}`);
      }
    }
    
    // Reload systemd
    try {
      execSync('systemctl daemon-reload', { stdio: 'pipe' });
      console.log('  Reloaded systemd');
    } catch (error) {
      console.log('⚠️  Failed to reload systemd');
    }
    
    console.log('✅ Service files removed');
  }
  
  async removeInstallationFiles() {
    console.log('🗑️  Removing installation files...');
    
    if (fs.existsSync(this.installDir)) {
      fs.rmSync(this.installDir, { recursive: true, force: true });
      console.log(`  Removed: ${this.installDir}`);
    } else {
      console.log('⚠️  Installation directory not found');
    }
    
    console.log('✅ Installation files removed');
  }
  
  async removeDataFiles() {
    console.log('🗑️  Removing data files...');
    
    // Remove configuration directory
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
        } else {
          console.log(`  Left configuration directory: ${this.configDir}`);
        }
      } catch (error) {
        console.log(`  Left configuration directory: ${this.configDir}`);
      }
    } else {
      console.log('⚠️  Configuration directory not found');
    }
    
    // Remove log directory
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
    } else {
      console.log('⚠️  Log directory not found');
    }
    
    // Ask about data directory
    console.log('');
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('Remove backup data directory? This will delete all backups! [y/N]: ', resolve);
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
    
    console.log('✅ Data files removed');
  }
}

// Main execution
if (require.main === module) {
  const uninstaller = new BackupServiceUninstaller();
  uninstaller.uninstall();
}

module.exports = BackupServiceUninstaller;