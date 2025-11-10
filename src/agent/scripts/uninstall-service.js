#!/usr/bin/env node

/**
 * LimaHost Agent Service Uninstallation Script
 * 
 * This script removes the LimaHost agent service and files.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

class AgentUninstaller {
  constructor() {
    this.platform = os.platform();
    this.isRoot = process.getuid && process.getuid() === 0;
    
    if (this.platform !== 'linux') {
      console.error('This uninstaller is only supported on Linux systems.');
      process.exit(1);
    }
    
    if (!this.isRoot) {
      console.error('This uninstaller must be run as root.');
      process.exit(1);
    }
    
    this.agentDir = '/opt/limahost-agent';
    this.configDir = '/etc/limahost';
    this.logDir = '/var/log/limahost';
    this.serviceFile = '/etc/systemd/system/limahost-agent.service';
  }
  
  async uninstall() {
    try {
      console.log('Uninstalling LimaHost Agent...');
      
      // Stop and disable service
      await this.stopAndDisableService();
      
      // Remove systemd service file
      await this.removeServiceFile();
      
      // Remove agent files
      await this.removeAgentFiles();
      
      // Remove configuration and logs (optional)
      await this.removeConfigAndLogs();
      
      console.log('✅ LimaHost Agent uninstalled successfully!');
      
    } catch (error) {
      console.error('❌ Uninstallation failed:', error.message);
      process.exit(1);
    }
  }
  
  async stopAndDisableService() {
    console.log('Stopping and disabling service...');
    
    try {
      // Check if service exists
      try {
        await fs.access(this.serviceFile);
      } catch {
        console.log('  Service file not found, skipping...');
        return;
      }
      
      // Stop service
      try {
        execSync('systemctl stop limahost-agent');
        console.log('  Service stopped');
      } catch (error) {
        console.log('  Service was not running or already stopped');
      }
      
      // Disable service
      try {
        execSync('systemctl disable limahost-agent');
        console.log('  Service disabled');
      } catch (error) {
        console.log('  Service was not enabled');
      }
      
    } catch (error) {
      throw new Error(`Failed to stop/disable service: ${error.message}`);
    }
  }
  
  async removeServiceFile() {
    console.log('Removing systemd service file...');
    
    try {
      await fs.access(this.serviceFile);
      await fs.unlink(this.serviceFile);
      console.log(`  Removed: ${this.serviceFile}`);
      
      // Reload systemd
      execSync('systemctl daemon-reload');
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('  Service file not found, skipping...');
      } else {
        throw new Error(`Failed to remove service file: ${error.message}`);
      }
    }
  }
  
  async removeAgentFiles() {
    console.log('Removing agent files...');
    
    try {
      await fs.access(this.agentDir);
      
      // Remove agent directory recursively
      await fs.rm(this.agentDir, { recursive: true, force: true });
      console.log(`  Removed: ${this.agentDir}`);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('  Agent directory not found, skipping...');
      } else {
        throw new Error(`Failed to remove agent files: ${error.message}`);
      }
    }
  }
  
  async removeConfigAndLogs() {
    console.log('Removing configuration and logs...');
    
    const dirs = [this.configDir, this.logDir];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
        
        // Ask user for confirmation
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          rl.question(`Remove ${dir}? This will delete all configuration and logs. (y/N): `, resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          await fs.rm(dir, { recursive: true, force: true });
          console.log(`  Removed: ${dir}`);
        } else {
          console.log(`  Kept: ${dir}`);
        }
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`  Directory not found: ${dir}`);
        } else {
          throw new Error(`Failed to remove ${dir}: ${error.message}`);
        }
      }
    }
  }
}

// Run uninstaller
if (require.main === module) {
  const uninstaller = new AgentUninstaller();
  uninstaller.uninstall();
}

module.exports = AgentUninstaller;