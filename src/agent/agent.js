#!/usr/bin/env node

/**
 * LimaHost Agent Service
 * 
 * A lightweight service that runs on host machines and manages Lima VMs
 * for the secure app hosting platform.
 * 
 * Features:
 * - VM lifecycle management (start, stop, restart, delete)
 * - Health monitoring and metrics collection
 * - Secure communication with control plane
 * - Resource management and allocation
 * - Log aggregation and forwarding
 * - Backup and snapshot operations
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const pidusage = require('pidusage');
const dockerode = require('dockerode');
const yaml = require('js-yaml');

class LimaAgent {
  constructor(config = {}) {
    this.config = {
      // Agent configuration
      agentId: config.agentId || `agent-${os.hostname()}-${Date.now()}`,
      agentName: config.agentName || os.hostname(),
      controlPlaneUrl: config.controlPlaneUrl || 'http://localhost:3000',
      controlPlaneApiKey: config.controlPlaneApiKey || process.env.CONTROL_PLANE_API_KEY,
      
      // Communication settings
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      metricsInterval: config.metricsInterval || 10000, // 10 seconds
      
      // VM management
      vmDataDir: config.vmDataDir || path.join(os.homedir(), '.lima'),
      maxConcurrentOperations: config.maxConcurrentOperations || 3,
      
      // Security
      allowedCommands: config.allowedCommands || [
        'limactl',
        'docker',
        'nerdctl',
        'ssh',
        'rsync',
        'tar'
      ],
      
      // Logging
      logLevel: config.logLevel || 'info',
      logFile: config.logFile || path.join(os.tmpdir(), 'lima-agent.log'),
      
      ...config
    };
    
    // Initialize state
    this.vms = new Map();
    this.operations = new Map();
    this.isRunning = false;
    this.lastHeartbeat = null;
    this.metrics = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: { in: 0, out: 0 },
      vms: { total: 0, running: 0, stopped: 0 }
    };
    
    // Initialize Docker client
    this.docker = new dockerode();
    
    // Setup logging
    this.setupLogging();
    
    // Setup process handlers
    this.setupProcessHandlers();
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
          message,
          agentId: this.config.agentId,
          ...data
        };
        
        // Log to console
        console.log(JSON.stringify(logEntry));
        
        // Log to file (async)
        fs.appendFile(this.config.logFile, JSON.stringify(logEntry) + '\n').catch(err => {
          console.error('Failed to write to log file:', err);
        });
      }
    };
  }
  
  setupProcessHandlers() {
    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      this.log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
      this.shutdown(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.log('error', 'Unhandled promise rejection', { reason, promise });
    });
  }
  
  async start() {
    try {
      this.log('info', 'Starting Lima agent', { 
        agentId: this.config.agentId,
        version: '1.0.0',
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch()
      });
      
      // Validate configuration
      await this.validateConfig();
      
      // Initialize VM data directory
      await this.initializeVmDirectory();
      
      // Load existing VMs
      await this.loadExistingVms();
      
      // Start periodic tasks
      this.startPeriodicTasks();
      
      // Setup communication with control plane
      await this.setupControlPlaneCommunication();
      
      this.isRunning = true;
      this.log('info', 'Lima agent started successfully');
      
      return true;
    } catch (error) {
      this.log('error', 'Failed to start agent', { error: error.message });
      throw error;
    }
  }
  
  async validateConfig() {
    const required = ['controlPlaneUrl', 'controlPlaneApiKey'];
    const missing = required.filter(key => !this.config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
    
    // Test connectivity to control plane
    try {
      await this.makeControlPlaneRequest('/health', 'GET');
    } catch (error) {
      throw new Error(`Cannot connect to control plane: ${error.message}`);
    }
  }
  
  async initializeVmDirectory() {
    try {
      await fs.access(this.config.vmDataDir);
    } catch {
      this.log('info', 'Creating VM data directory', { path: this.config.vmDataDir });
      await fs.mkdir(this.config.vmDataDir, { recursive: true });
    }
  }
  
  async loadExistingVms() {
    try {
      const files = await fs.readdir(this.config.vmDataDir);
      const vmDirs = files.filter(file => {
        const filePath = path.join(this.config.vmDataDir, file);
        return fs.stat(filePath).then(stat => stat.isDirectory());
      });
      
      for (const vmDir of vmDirs) {
        try {
          const vmInfo = await this.getVmInfo(vmDir);
          this.vms.set(vmDir, vmInfo);
          this.log('info', 'Loaded existing VM', { vmId: vmDir, status: vmInfo.status });
        } catch (error) {
          this.log('warn', 'Failed to load VM info', { vmId: vmDir, error: error.message });
        }
      }
      
      this.updateVmMetrics();
    } catch (error) {
      this.log('error', 'Failed to load existing VMs', { error: error.message });
    }
  }
  
  async getVmInfo(vmName) {
    const limactlCmd = `limactl list --json`;
    
    return new Promise((resolve, reject) => {
      exec(limactlCmd, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to get VM info: ${stderr}`));
          return;
        }
        
        try {
          const vms = JSON.parse(stdout);
          const vm = vms.find(v => v.name === vmName);
          
          if (!vm) {
            resolve({
              name: vmName,
              status: 'unknown',
              ipAddress: null,
              cpu: 0,
              memory: 0,
              disk: 0,
              createdAt: null
            });
            return;
          }
          
          resolve({
            name: vm.name,
            status: vm.status,
            ipAddress: vm.ipAddress || null,
            cpu: vm.cpus || 0,
            memory: vm.memory || 0,
            disk: vm.disk || 0,
            createdAt: vm.createdAt || null
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse VM info: ${parseError.message}`));
        }
      });
    });
  }
  
  startPeriodicTasks() {
    // Heartbeat to control plane
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
    
    // Metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
    
    // VM status monitoring
    this.vmMonitorInterval = setInterval(() => {
      this.monitorVms();
    }, 15000); // Every 15 seconds
    
    // Initial calls
    this.sendHeartbeat();
    this.collectMetrics();
  }
  
  async setupControlPlaneCommunication() {
    // Setup WebSocket connection for real-time communication
    const wsUrl = this.config.controlPlaneUrl.replace('http', 'ws') + '/agent';
    
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.controlPlaneApiKey}`,
        'X-Agent-ID': this.config.agentId
      }
    });
    
    this.ws.on('open', () => {
      this.log('info', 'Connected to control plane via WebSocket');
      this.sendAgentInfo();
    });
    
    this.ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        await this.handleControlPlaneMessage(message);
      } catch (error) {
        this.log('error', 'Failed to handle control plane message', { error: error.message });
      }
    });
    
    this.ws.on('close', () => {
      this.log('warn', 'WebSocket connection closed, attempting to reconnect...');
      setTimeout(() => this.setupControlPlaneCommunication(), 5000);
    });
    
    this.ws.on('error', (error) => {
      this.log('error', 'WebSocket error', { error: error.message });
    });
  }
  
  async sendHeartbeat() {
    try {
      const heartbeat = {
        agentId: this.config.agentId,
        timestamp: new Date().toISOString(),
        status: 'healthy',
        metrics: this.metrics,
        vms: Array.from(this.vms.values()),
        operations: Array.from(this.operations.values())
      };
      
      await this.makeControlPlaneRequest('/agents/heartbeat', 'POST', heartbeat);
      this.lastHeartbeat = new Date();
      
      this.log('debug', 'Heartbeat sent to control plane');
    } catch (error) {
      this.log('error', 'Failed to send heartbeat', { error: error.message });
    }
  }
  
  async collectMetrics() {
    try {
      // System metrics
      const cpuUsage = await this.getCpuUsage();
      const memoryUsage = await this.getMemoryUsage();
      const diskUsage = await this.getDiskUsage();
      const networkUsage = await this.getNetworkUsage();
      
      this.metrics = {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        network: networkUsage,
        vms: {
          total: this.vms.size,
          running: Array.from(this.vms.values()).filter(vm => vm.status === 'Running').length,
          stopped: Array.from(this.vms.values()).filter(vm => vm.status === 'Stopped').length
        }
      };
      
      this.log('debug', 'Metrics collected', this.metrics);
    } catch (error) {
      this.log('error', 'Failed to collect metrics', { error: error.message });
    }
  }
  
  async getCpuUsage() {
    return new Promise((resolve) => {
      pidusage.stat(process.pid, (err, stats) => {
        if (err) {
          resolve(0);
          return;
        }
        resolve(Math.round(stats.cpu));
      });
    });
  }
  
  async getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return Math.round((usedMem / totalMem) * 100);
  }
  
  async getDiskUsage() {
    try {
      const stats = await fs.statfs(this.config.vmDataDir);
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      return Math.round((used / total) * 100);
    } catch {
      return 0;
    }
  }
  
  async getNetworkUsage() {
    // This is a simplified implementation
    // In a real agent, you would track network interface statistics
    return {
      in: Math.floor(Math.random() * 1000000),
      out: Math.floor(Math.random() * 1000000)
    };
  }
  
  async monitorVms() {
    try {
      for (const [vmName, vmInfo] of this.vms) {
        try {
          const updatedInfo = await this.getVmInfo(vmName);
          this.vms.set(vmName, updatedInfo);
          
          // Check for status changes
          if (vmInfo.status !== updatedInfo.status) {
            this.log('info', 'VM status changed', { 
              vmName, 
              oldStatus: vmInfo.status, 
              newStatus: updatedInfo.status 
            });
            
            // Notify control plane of status change
            await this.notifyVmStatusChange(vmName, updatedInfo);
          }
        } catch (error) {
          this.log('warn', 'Failed to monitor VM', { vmName, error: error.message });
        }
      }
      
      this.updateVmMetrics();
    } catch (error) {
      this.log('error', 'Failed to monitor VMs', { error: error.message });
    }
  }
  
  updateVmMetrics() {
    this.metrics.vms = {
      total: this.vms.size,
      running: Array.from(this.vms.values()).filter(vm => vm.status === 'Running').length,
      stopped: Array.from(this.vms.values()).filter(vm => vm.status === 'Stopped').length
    };
  }
  
  async notifyVmStatusChange(vmName, vmInfo) {
    try {
      await this.makeControlPlaneRequest('/vms/status-change', 'POST', {
        agentId: this.config.agentId,
        vmName,
        status: vmInfo.status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.log('error', 'Failed to notify VM status change', { error: error.message });
    }
  }
  
  async handleControlPlaneMessage(message) {
    this.log('debug', 'Received control plane message', { type: message.type });
    
    switch (message.type) {
      case 'create_vm':
        await this.handleCreateVm(message);
        break;
      case 'start_vm':
        await this.handleStartVm(message);
        break;
      case 'stop_vm':
        await this.handleStopVm(message);
        break;
      case 'restart_vm':
        await this.handleRestartVm(message);
        break;
      case 'delete_vm':
        await this.handleDeleteVm(message);
        break;
      case 'execute_command':
        await this.handleExecuteCommand(message);
        break;
      case 'get_vm_info':
        await this.handleGetVmInfo(message);
        break;
      case 'list_vms':
        await this.handleListVms(message);
        break;
      case 'backup_vm':
        await this.handleBackupVm(message);
        break;
      default:
        this.log('warn', 'Unknown message type', { type: message.type });
    }
  }
  
  async handleCreateVm(message) {
    const { vmName, template, config, requestId } = message;
    
    try {
      this.log('info', 'Creating VM', { vmName, template });
      
      // Check if VM already exists
      if (this.vms.has(vmName)) {
        throw new Error(`VM ${vmName} already exists`);
      }
      
      // Generate Lima YAML from template
      const limaYaml = await this.generateLimaYaml(template, config);
      
      // Write YAML file
      const yamlPath = path.join(this.config.vmDataDir, `${vmName}.yaml`);
      await fs.writeFile(yamlPath, limaYaml);
      
      // Create VM using limactl
      const operationId = this.createOperation('create_vm', vmName, requestId);
      
      const limactlCmd = `limactl start ${yamlPath}`;
      
      exec(limactlCmd, async (error, stdout, stderr) => {
        if (error) {
          this.failOperation(operationId, error.message);
          this.log('error', 'Failed to create VM', { vmName, error: stderr });
          return;
        }
        
        // Load VM info
        try {
          const vmInfo = await this.getVmInfo(vmName);
          this.vms.set(vmName, vmInfo);
          this.updateVmMetrics();
          
          this.completeOperation(operationId, { vmInfo });
          this.log('info', 'VM created successfully', { vmName });
        } catch (loadError) {
          this.failOperation(operationId, loadError.message);
          this.log('error', 'Failed to load VM info after creation', { vmName, error: loadError.message });
        }
      });
      
    } catch (error) {
      this.log('error', 'Failed to handle create VM', { vmName, error: error.message });
      this.sendErrorResponse(requestId, error.message);
    }
  }
  
  async generateLimaYaml(template, config) {
    // This is a simplified implementation
    // In a real agent, you would have proper template management
    const baseTemplate = {
      name: config.name,
      arch: 'x86_64',
      images: [{
        location: 'https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img',
        arch: 'x86_64'
      }],
      cpus: config.cpus || 2,
      memory: `${config.memory || 4}GiB`,
      disk: `${config.disk || 20}GiB`,
      containerd: {
        system: true,
        user: true
      },
      ssh: {
        localPort: 0,
        loadDotSSHPubKeys: true
      }
    };
    
    return yaml.dump(baseTemplate);
  }
  
  async handleStartVm(message) {
    const { vmName, requestId } = message;
    
    try {
      this.log('info', 'Starting VM', { vmName });
      
      if (!this.vms.has(vmName)) {
        throw new Error(`VM ${vmName} not found`);
      }
      
      const operationId = this.createOperation('start_vm', vmName, requestId);
      
      const limactlCmd = `limactl start ${vmName}`;
      
      exec(limactlCmd, async (error, stdout, stderr) => {
        if (error) {
          this.failOperation(operationId, error.message);
          this.log('error', 'Failed to start VM', { vmName, error: stderr });
          return;
        }
        
        try {
          const vmInfo = await this.getVmInfo(vmName);
          this.vms.set(vmName, vmInfo);
          this.updateVmMetrics();
          
          this.completeOperation(operationId, { vmInfo });
          this.log('info', 'VM started successfully', { vmName });
        } catch (loadError) {
          this.failOperation(operationId, loadError.message);
          this.log('error', 'Failed to load VM info after start', { vmName, error: loadError.message });
        }
      });
      
    } catch (error) {
      this.log('error', 'Failed to handle start VM', { vmName, error: error.message });
      this.sendErrorResponse(requestId, error.message);
    }
  }
  
  async handleStopVm(message) {
    const { vmName, requestId } = message;
    
    try {
      this.log('info', 'Stopping VM', { vmName });
      
      if (!this.vms.has(vmName)) {
        throw new Error(`VM ${vmName} not found`);
      }
      
      const operationId = this.createOperation('stop_vm', vmName, requestId);
      
      const limactlCmd = `limactl stop ${vmName}`;
      
      exec(limactlCmd, async (error, stdout, stderr) => {
        if (error) {
          this.failOperation(operationId, error.message);
          this.log('error', 'Failed to stop VM', { vmName, error: stderr });
          return;
        }
        
        try {
          const vmInfo = await this.getVmInfo(vmName);
          this.vms.set(vmName, vmInfo);
          this.updateVmMetrics();
          
          this.completeOperation(operationId, { vmInfo });
          this.log('info', 'VM stopped successfully', { vmName });
        } catch (loadError) {
          this.failOperation(operationId, loadError.message);
          this.log('error', 'Failed to load VM info after stop', { vmName, error: loadError.message });
        }
      });
      
    } catch (error) {
      this.log('error', 'Failed to handle stop VM', { vmName, error: error.message });
      this.sendErrorResponse(requestId, error.message);
    }
  }
  
  async handleRestartVm(message) {
    const { vmName, requestId } = message;
    
    try {
      this.log('info', 'Restarting VM', { vmName });
      
      if (!this.vms.has(vmName)) {
        throw new Error(`VM ${vmName} not found`);
      }
      
      const operationId = this.createOperation('restart_vm', vmName, requestId);
      
      const limactlCmd = `limactl restart ${vmName}`;
      
      exec(limactlCmd, async (error, stdout, stderr) => {
        if (error) {
          this.failOperation(operationId, error.message);
          this.log('error', 'Failed to restart VM', { vmName, error: stderr });
          return;
        }
        
        try {
          const vmInfo = await this.getVmInfo(vmName);
          this.vms.set(vmName, vmInfo);
          this.updateVmMetrics();
          
          this.completeOperation(operationId, { vmInfo });
          this.log('info', 'VM restarted successfully', { vmName });
        } catch (loadError) {
          this.failOperation(operationId, loadError.message);
          this.log('error', 'Failed to load VM info after restart', { vmName, error: loadError.message });
        }
      });
      
    } catch (error) {
      this.log('error', 'Failed to handle restart VM', { vmName, error: error.message });
      this.sendErrorResponse(requestId, error.message);
    }
  }
  
  async handleDeleteVm(message) {
    const { vmName, requestId } = message;
    
    try {
      this.log('info', 'Deleting VM', { vmName });
      
      if (!this.vms.has(vmName)) {
        throw new Error(`VM ${vmName} not found`);
      }
      
      const operationId = this.createOperation('delete_vm', vmName, requestId);
      
      const limactlCmd = `limactl delete ${vmName}`;
      
      exec(limactlCmd, async (error, stdout, stderr) => {
        if (error) {
          this.failOperation(operationId, error.message);
          this.log('error', 'Failed to delete VM', { vmName, error: stderr });
          return;
        }
        
        // Remove from local state
        this.vms.delete(vmName);
        this.updateVmMetrics();
        
        // Remove YAML file
        try {
          const yamlPath = path.join(this.config.vmDataDir, `${vmName}.yaml`);
          await fs.unlink(yamlPath);
        } catch (unlinkError) {
          this.log('warn', 'Failed to remove YAML file', { vmName, error: unlinkError.message });
        }
        
        this.completeOperation(operationId, { success: true });
        this.log('info', 'VM deleted successfully', { vmName });
      });
      
    } catch (error) {
      this.log('error', 'Failed to handle delete VM', { vmName, error: error.message });
      this.sendErrorResponse(requestId, error.message);
    }
  }
  
  async handleExecuteCommand(message) {
    const { vmName, command, timeout = 30000, requestId } = message;
    
    try {
      this.log('info', 'Executing command', { vmName, command });
      
      if (!this.vms.has(vmName)) {
        throw new Error(`VM ${vmName} not found`);
      }
      
      const operationId = this.createOperation('execute_command', vmName, requestId);
      
      const limactlCmd = `limactl shell ${vmName} -- ${command}`;
      
      const child = exec(limactlCmd, { timeout }, (error, stdout, stderr) => {
        if (error) {
          this.failOperation(operationId, error.message);
          this.log('error', 'Command execution failed', { vmName, command, error: stderr });
          return;
        }
        
        this.completeOperation(operationId, {
          stdout,
          stderr,
          exitCode: 0
        });
        
        this.log('info', 'Command executed successfully', { vmName, command });
      });
      
    } catch (error) {
      this.log('error', 'Failed to handle execute command', { vmName, command, error: error.message });
      this.sendErrorResponse(requestId, error.message);
    }
  }
  
  async handleGetVmInfo(message) {
    const { vmName, requestId } = message;
    
    try {
      const vmInfo = await this.getVmInfo(vmName);
      
      this.sendResponse(requestId, {
        type: 'vm_info',
        vmInfo
      });
      
    } catch (error) {
      this.log('error', 'Failed to handle get VM info', { vmName, error: error.message });
      this.sendErrorResponse(requestId, error.message);
    }
  }
  
  async handleListVms(message) {
    const { requestId } = message;
    
    try {
      const vms = Array.from(this.vms.values());
      
      this.sendResponse(requestId, {
        type: 'vm_list',
        vms
      });
      
    } catch (error) {
      this.log('error', 'Failed to handle list VMs', { error: error.message });
      this.sendErrorResponse(requestId, error.message);
    }
  }
  
  async handleBackupVm(message) {
    const { vmName, backupPath, requestId } = message;
    
    try {
      this.log('info', 'Backing up VM', { vmName, backupPath });
      
      if (!this.vms.has(vmName)) {
        throw new Error(`VM ${vmName} not found`);
      }
      
      const operationId = this.createOperation('backup_vm', vmName, requestId);
      
      // Stop VM for consistent backup
      await this.stopVmForBackup(vmName);
      
      // Create backup
      const backupCmd = `limactl disk ${vmName} create-backup`;
      
      exec(backupCmd, async (error, stdout, stderr) => {
        if (error) {
          this.failOperation(operationId, error.message);
          this.log('error', 'Failed to backup VM', { vmName, error: stderr });
          return;
        }
        
        // Restart VM after backup
        await this.restartVmAfterBackup(vmName);
        
        this.completeOperation(operationId, {
          backupPath,
          size: await this.getBackupSize(backupPath)
        });
        
        this.log('info', 'VM backup completed successfully', { vmName, backupPath });
      });
      
    } catch (error) {
      this.log('error', 'Failed to handle backup VM', { vmName, error: error.message });
      this.sendErrorResponse(requestId, error.message);
    }
  }
  
  async stopVmForBackup(vmName) {
    return new Promise((resolve, reject) => {
      exec(`limactl stop ${vmName}`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to stop VM for backup: ${stderr}`));
        } else {
          resolve();
        }
      });
    });
  }
  
  async restartVmAfterBackup(vmName) {
    return new Promise((resolve, reject) => {
      exec(`limactl start ${vmName}`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to restart VM after backup: ${stderr}`));
        } else {
          resolve();
        }
      });
    });
  }
  
  async getBackupSize(backupPath) {
    try {
      const stats = await fs.stat(backupPath);
      return stats.size;
    } catch {
      return 0;
    }
  }
  
  createOperation(type, vmName, requestId) {
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const operation = {
      id: operationId,
      type,
      vmName,
      requestId,
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: null,
      result: null,
      error: null
    };
    
    this.operations.set(operationId, operation);
    
    // Notify control plane
    this.sendOperationUpdate(operation);
    
    return operationId;
  }
  
  completeOperation(operationId, result) {
    const operation = this.operations.get(operationId);
    if (!operation) return;
    
    operation.status = 'completed';
    operation.endTime = new Date().toISOString();
    operation.result = result;
    
    this.operations.set(operationId, operation);
    this.sendOperationUpdate(operation);
  }
  
  failOperation(operationId, error) {
    const operation = this.operations.get(operationId);
    if (!operation) return;
    
    operation.status = 'failed';
    operation.endTime = new Date().toISOString();
    operation.error = error;
    
    this.operations.set(operationId, operation);
    this.sendOperationUpdate(operation);
  }
  
  async sendOperationUpdate(operation) {
    try {
      await this.makeControlPlaneRequest('/operations/update', 'POST', {
        agentId: this.config.agentId,
        operation
      });
    } catch (error) {
      this.log('error', 'Failed to send operation update', { error: error.message });
    }
  }
  
  async sendAgentInfo() {
    try {
      const agentInfo = {
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        version: '1.0.0',
        capabilities: [
          'vm_lifecycle',
          'command_execution',
          'backup_restore',
          'metrics_collection',
          'log_aggregation'
        ],
        hostInfo: {
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch(),
          totalMemory: os.totalmem(),
          cpuCount: os.cpus().length
        },
        config: {
          maxConcurrentOperations: this.config.maxConcurrentOperations,
          vmDataDir: this.config.vmDataDir
        }
      };
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'agent_info',
          data: agentInfo
        }));
      }
    } catch (error) {
      this.log('error', 'Failed to send agent info', { error: error.message });
    }
  }
  
  async sendResponse(requestId, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'response',
        requestId,
        data
      }));
    }
  }
  
  async sendErrorResponse(requestId, error) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'error',
        requestId,
        error
      }));
    }
  }
  
  async makeControlPlaneRequest(path, method = 'GET', data = null) {
    const url = new URL(path, this.config.controlPlaneUrl);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.controlPlaneApiKey}`,
        'X-Agent-ID': this.config.agentId
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              resolve(parsed);
            } catch (parseError) {
              resolve(body);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }
  
  async shutdown(exitCode = 0) {
    this.log('info', 'Shutting down Lima agent');
    
    this.isRunning = false;
    
    // Clear intervals
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.vmMonitorInterval) clearInterval(this.vmMonitorInterval);
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
    }
    
    // Wait for pending operations to complete or timeout
    const pendingOperations = Array.from(this.operations.values()).filter(op => op.status === 'running');
    if (pendingOperations.length > 0) {
      this.log('info', 'Waiting for pending operations to complete', { count: pendingOperations.length });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    this.log('info', 'Lima agent shutdown complete');
    process.exit(exitCode);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
LimaHost Agent - VM Orchestration Agent

Usage: node agent.js [options]

Options:
  --config, -c <path>     Path to configuration file
  --agent-id <id>         Agent ID (default: auto-generated)
  --agent-name <name>     Agent name (default: hostname)
  --control-plane <url>   Control plane URL
  --api-key <key>         Control plane API key
  --log-level <level>     Log level (error, warn, info, debug)
  --help, -h              Show this help message

Environment Variables:
  CONTROL_PLANE_API_KEY   Control plane API key
  LIMA_AGENT_CONFIG       Path to configuration file

Examples:
  node agent.js --control-plane https://api.limahost.com --api-key your-api-key
  node agent.js --config /path/to/config.json
`);
    process.exit(0);
  }
  
  // Parse command line arguments
  const config = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
      case '-c':
        config.configPath = args[++i];
        break;
      case '--agent-id':
        config.agentId = args[++i];
        break;
      case '--agent-name':
        config.agentName = args[++i];
        break;
      case '--control-plane':
        config.controlPlaneUrl = args[++i];
        break;
      case '--api-key':
        config.controlPlaneApiKey = args[++i];
        break;
      case '--log-level':
        config.logLevel = args[++i];
        break;
    }
  }
  
  // Load configuration from file if specified
  if (config.configPath) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(config.configPath, 'utf8'));
      Object.assign(config, fileConfig);
    } catch (error) {
      console.error('Failed to load configuration file:', error.message);
      process.exit(1);
    }
  }
  
  // Create and start agent
  const agent = new LimaAgent(config);
  
  agent.start()
    .then(() => {
      console.log('Lima agent started successfully');
    })
    .catch((error) => {
      console.error('Failed to start Lima agent:', error.message);
      process.exit(1);
    });
}

module.exports = LimaAgent;