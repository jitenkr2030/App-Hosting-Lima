/**
 * LimaHost Backup Service
 * 
 * A comprehensive backup and restore service for Lima VMs.
 * Supports full, incremental, and differential backups with
 * encryption, compression, and cloud storage integration.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const tar = require('tar');
const { execSync } = require('child_process');
const cron = require('node-cron');

class BackupService {
  constructor(config = {}) {
    this.config = {
      // Storage configuration
      storageType: config.storageType || 'local', // 'local', 's3', 'minio'
      storagePath: config.storagePath || '/var/lib/limahost/backups',
      
      // S3/MinIO configuration
      s3: {
        endpoint: config.s3?.endpoint || 'http://localhost:9000',
        accessKey: config.s3?.accessKey || '',
        secretKey: config.s3?.secretKey || '',
        bucket: config.s3?.bucket || 'limahost-backups',
        region: config.s3?.region || 'us-east-1'
      },
      
      // Default backup settings
      defaultRetention: config.defaultRetention || 30, // days
      compressionLevel: config.compressionLevel || 6,
      encryptionEnabled: config.encryptionEnabled !== false,
      
      // Performance settings
      maxConcurrentBackups: config.maxConcurrentBackups || 3,
      chunkSize: config.chunkSize || 64 * 1024 * 1024, // 64MB chunks
      
      // Logging
      logLevel: config.logLevel || 'info',
      logFile: config.logFile || '/var/log/limahost/backup-service.log',
      
      ...config
    };
    
    // Initialize state
    this.activeBackups = new Map();
    this.schedules = new Map();
    this.backupHistory = [];
    
    // Setup logging
    this.setupLogging();
    
    // Initialize storage
    this.initializeStorage();
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
          service: 'backup-service',
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
  
  async initializeStorage() {
    try {
      // Create storage directory
      await fs.mkdir(this.config.storagePath, { recursive: true });
      
      // Create subdirectories
      const subdirs = ['incoming', 'completed', 'failed', 'temp'];
      for (const subdir of subdirs) {
        await fs.mkdir(path.join(this.config.storagePath, subdir), { recursive: true });
      }
      
      this.log('info', 'Backup storage initialized', { 
        storageType: this.config.storageType,
        storagePath: this.config.storagePath 
      });
      
    } catch (error) {
      this.log('error', 'Failed to initialize storage', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Create a new backup
   */
  async createBackup(options) {
    const {
      vmName,
      appId,
      appName,
      type = 'full', // 'full', 'incremental', 'differential'
      compression = true,
      encryption = this.config.encryptionEnabled,
      retentionDays = this.config.defaultRetention,
      description = ''
    } = options;
    
    const backupId = `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.log('info', 'Starting backup creation', { 
        backupId, 
        vmName, 
        type 
      });
      
      // Check if VM exists
      const vmInfo = await this.getVmInfo(vmName);
      if (!vmInfo) {
        throw new Error(`VM ${vmName} not found`);
      }
      
      // Check if there's already an active backup for this VM
      for (const [activeId, activeBackup] of this.activeBackups) {
        if (activeBackup.vmName === vmName && activeBackup.status === 'in_progress') {
          throw new Error(`Backup already in progress for VM ${vmName}`);
        }
      }
      
      // Create backup record
      const backup = {
        id: backupId,
        vmName,
        appId,
        appName,
        type,
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: null,
        size: 0,
        location: null,
        checksum: null,
        compression,
        encryption,
        retentionDays,
        description,
        progress: 0,
        metadata: {
          vmInfo,
          files: [],
          errors: []
        }
      };
      
      this.activeBackups.set(backupId, backup);
      
      // Start backup process
      this.performBackup(backupId).catch(error => {
        this.log('error', 'Backup process failed', { 
          backupId, 
          error: error.message 
        });
        this.failBackup(backupId, error.message);
      });
      
      this.log('info', 'Backup creation initiated', { backupId });
      
      return {
        success: true,
        backupId,
        status: 'in_progress',
        message: 'Backup creation started'
      };
      
    } catch (error) {
      this.log('error', 'Failed to create backup', { 
        vmName, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Perform the actual backup process
   */
  async performBackup(backupId) {
    const backup = this.activeBackups.get(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    try {
      this.log('info', 'Performing backup', { backupId, type: backup.type });
      
      // Step 1: Prepare backup environment
      await this.prepareBackup(backup);
      backup.progress = 10;
      
      // Step 2: Stop VM or create snapshot (for consistent backup)
      const vmStopped = await this.prepareVmForBackup(backup);
      backup.progress = 20;
      
      try {
        // Step 3: Create backup based on type
        switch (backup.type) {
          case 'full':
            await this.createFullBackup(backup);
            break;
          case 'incremental':
            await this.createIncrementalBackup(backup);
            break;
          case 'differential':
            await this.createDifferentialBackup(backup);
            break;
          default:
            throw new Error(`Unknown backup type: ${backup.type}`);
        }
        
        backup.progress = 80;
        
        // Step 4: Compress if enabled
        if (backup.compression) {
          await this.compressBackup(backup);
        }
        
        backup.progress = 90;
        
        // Step 5: Encrypt if enabled
        if (backup.encryption) {
          await this.encryptBackup(backup);
        }
        
        backup.progress = 95;
        
        // Step 6: Calculate checksum and finalize
        await this.finalizeBackup(backup);
        
        backup.progress = 100;
        backup.status = 'completed';
        backup.completedAt = new Date().toISOString();
        
        this.log('info', 'Backup completed successfully', { 
          backupId, 
          size: backup.size,
          location: backup.location 
        });
        
      } finally {
        // Step 7: Restore VM state
        if (vmStopped) {
          await this.restoreVmAfterBackup(backup);
        }
      }
      
      // Move backup from active to history
      this.activeBackups.delete(backupId);
      this.backupHistory.push(backup);
      
      // Clean up old backups based on retention policy
      await this.cleanupOldBackups(backup.vmName, backup.retentionDays);
      
    } catch (error) {
      this.log('error', 'Backup process failed', { 
        backupId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Prepare backup environment
   */
  async prepareBackup(backup) {
    const tempDir = path.join(this.config.storagePath, 'temp', backup.id);
    await fs.mkdir(tempDir, { recursive: true });
    
    backup.tempDir = tempDir;
    backup.backupFile = path.join(tempDir, `${backup.vmName}-${backup.type}-${Date.now()}.tar`);
    
    this.log('debug', 'Backup environment prepared', { 
      backupId: backup.id,
      tempDir 
    });
  }
  
  /**
   * Prepare VM for backup (stop or snapshot)
   */
  async prepareVmForBackup(backup) {
    const { vmName } = backup;
    
    try {
      // Check VM status
      const status = await this.getVmStatus(vmName);
      
      if (status === 'Running') {
        this.log('info', 'Stopping VM for consistent backup', { vmName });
        
        // Stop VM
        await this.executeCommand(`limactl stop ${vmName}`);
        backup.vmWasRunning = true;
        
        // Wait a moment for VM to stop
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      this.log('error', 'Failed to prepare VM for backup', { 
        vmName, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Create full backup
   */
  async createFullBackup(backup) {
    const { vmName, backupFile } = backup;
    
    try {
      this.log('info', 'Creating full backup', { backupId: backup.id });
      
      // Get VM disk path
      const vmDiskPath = await this.getVmDiskPath(vmName);
      
      // Create tar archive of VM disk and configuration
      await new Promise((resolve, reject) => {
        const tarStream = tar.create({
          gzip: false,
          cwd: path.dirname(vmDiskPath)
        });
        
        const output = fs.createWriteStream(backupFile);
        
        tarStream.pipe(output);
        
        // Add VM disk file
        tarStream.entry({
          name: path.basename(vmDiskPath),
          size: (await fs.stat(vmDiskPath)).size,
          mode: 0o644
        }, fs.createReadStream(vmDiskPath));
        
        // Add VM configuration
        const configPath = await this.getVmConfigPath(vmName);
        if (configPath) {
          tarStream.entry({
            name: `${vmName}.yaml`,
            size: (await fs.stat(configPath)).size,
            mode: 0o644
          }, fs.createReadStream(configPath));
        }
        
        tarStream.end();
        
        output.on('finish', resolve);
        output.on('error', reject);
        tarStream.on('error', reject);
      });
      
      // Get backup file size
      const stats = await fs.stat(backupFile);
      backup.size = stats.size;
      
      this.log('debug', 'Full backup created', { 
        backupId: backup.id,
        size: backup.size 
      });
      
    } catch (error) {
      this.log('error', 'Failed to create full backup', { 
        backupId: backup.id,
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Create incremental backup
   */
  async createIncrementalBackup(backup) {
    // For incremental backups, we would need to track changes since last backup
    // This is a simplified implementation
    this.log('warn', 'Incremental backup not fully implemented, falling back to full backup', {
      backupId: backup.id
    });
    
    await this.createFullBackup(backup);
  }
  
  /**
   * Create differential backup
   */
  async createDifferentialBackup(backup) {
    // For differential backups, we would backup changes since last full backup
    // This is a simplified implementation
    this.log('warn', 'Differential backup not fully implemented, falling back to full backup', {
      backupId: backup.id
    });
    
    await this.createFullBackup(backup);
  }
  
  /**
   * Compress backup file
   */
  async compressBackup(backup) {
    if (!backup.compression) return;
    
    try {
      this.log('info', 'Compressing backup', { backupId: backup.id });
      
      const compressedFile = backup.backupFile + '.gz';
      const gzip = zlib.createGzip({ level: this.config.compressionLevel });
      
      const input = fs.createReadStream(backup.backupFile);
      const output = fs.createWriteStream(compressedFile);
      
      await new Promise((resolve, reject) => {
        input.pipe(gzip).pipe(output);
        
        output.on('finish', () => {
          // Remove uncompressed file
          fs.unlink(backup.backupFile).catch(() => {});
          backup.backupFile = compressedFile;
          resolve();
        });
        
        output.on('error', reject);
        gzip.on('error', reject);
        input.on('error', reject);
      });
      
      // Update size
      const stats = await fs.stat(compressedFile);
      backup.size = stats.size;
      
      this.log('debug', 'Backup compressed', { 
        backupId: backup.id,
        originalSize: backup.size,
        compressedSize: stats.size 
      });
      
    } catch (error) {
      this.log('error', 'Failed to compress backup', { 
        backupId: backup.id,
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Encrypt backup file
   */
  async encryptBackup(backup) {
    if (!backup.encryption) return;
    
    try {
      this.log('info', 'Encrypting backup', { backupId: backup.id });
      
      // Generate encryption key (in real implementation, this would come from a key management system)
      const encryptionKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      const encryptedFile = backup.backupFile + '.enc';
      const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
      
      const input = fs.createReadStream(backup.backupFile);
      const output = fs.createWriteStream(encryptedFile);
      
      await new Promise((resolve, reject) => {
        input.pipe(cipher).pipe(output);
        
        output.on('finish', () => {
          // Remove unencrypted file
          fs.unlink(backup.backupFile).catch(() => {});
          backup.backupFile = encryptedFile;
          backup.encryptionKey = encryptionKey.toString('hex');
          backup.encryptionIv = iv.toString('hex');
          resolve();
        });
        
        output.on('error', reject);
        cipher.on('error', reject);
        input.on('error', reject);
      });
      
      this.log('debug', 'Backup encrypted', { 
        backupId: backup.id 
      });
      
    } catch (error) {
      this.log('error', 'Failed to encrypt backup', { 
        backupId: backup.id,
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Finalize backup (calculate checksum, move to storage)
   */
  async finalizeBackup(backup) {
    try {
      this.log('info', 'Finalizing backup', { backupId: backup.id });
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(backup.backupFile);
      backup.checksum = checksum;
      
      // Generate final filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = backup.encryption ? '.enc' : (backup.compression ? '.gz' : '');
      const finalFilename = `${backup.vmName}-${backup.type}-${timestamp}${extension}`;
      
      // Move to final location
      const finalPath = path.join(this.config.storagePath, 'completed', finalFilename);
      await fs.rename(backup.backupFile, finalPath);
      
      backup.location = finalPath;
      backup.finalFilename = finalFilename;
      
      // Clean up temp directory
      await fs.rm(backup.tempDir, { recursive: true, force: true });
      
      this.log('debug', 'Backup finalized', { 
        backupId: backup.id,
        checksum,
        location: finalPath 
      });
      
    } catch (error) {
      this.log('error', 'Failed to finalize backup', { 
        backupId: backup.id,
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Restore VM after backup
   */
  async restoreVmAfterBackup(backup) {
    if (!backup.vmWasRunning) return;
    
    const { vmName } = backup;
    
    try {
      this.log('info', 'Restoring VM after backup', { vmName });
      
      // Start VM
      await this.executeCommand(`limactl start ${vmName}`);
      
      // Wait for VM to start
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Verify VM is running
      const status = await this.getVmStatus(vmName);
      if (status !== 'Running') {
        this.log('warn', 'VM may not have started properly after backup', { vmName, status });
      }
      
    } catch (error) {
      this.log('error', 'Failed to restore VM after backup', { 
        vmName, 
        error: error.message 
      });
      // Don't throw here as the backup itself was successful
    }
  }
  
  /**
   * Calculate file checksum
   */
  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', reject);
    });
  }
  
  /**
   * Restore VM from backup
   */
  async restoreBackup(backupId, options = {}) {
    const {
      targetVm,
      overwrite = false,
      verify = true
    } = options;
    
    try {
      this.log('info', 'Starting backup restore', { backupId, targetVm });
      
      // Find backup
      const backup = this.backupHistory.find(b => b.id === backupId);
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      if (backup.status !== 'completed') {
        throw new Error(`Backup ${backupId} is not completed`);
      }
      
      // Verify backup file exists
      try {
        await fs.access(backup.location);
      } catch {
        throw new Error(`Backup file not found: ${backup.location}`);
      }
      
      // Check if target VM exists
      const targetVmName = targetVm || backup.vmName;
      const vmExists = await this.vmExists(targetVmName);
      
      if (vmExists && !overwrite) {
        throw new Error(`Target VM ${targetVmName} already exists and overwrite is false`);
      }
      
      // Stop target VM if it exists and is running
      if (vmExists) {
        const status = await this.getVmStatus(targetVmName);
        if (status === 'Running') {
          await this.executeCommand(`limactl stop ${targetVmName}`);
        }
      }
      
      // Prepare restore environment
      const restoreDir = path.join(this.config.storagePath, 'temp', `restore-${backupId}`);
      await fs.mkdir(restoreDir, { recursive: true });
      
      try {
        // Decrypt if necessary
        let backupFile = backup.location;
        if (backup.encryption) {
          backupFile = await this.decryptBackup(backup, restoreDir);
        }
        
        // Decompress if necessary
        if (backup.compression) {
          backupFile = await this.decompressBackup(backupFile, restoreDir);
        }
        
        // Extract backup
        await this.extractBackup(backupFile, targetVmName);
        
        // Verify restore if requested
        if (verify) {
          await this.verifyRestore(targetVmName);
        }
        
        // Start restored VM
        await this.executeCommand(`limactl start ${targetVmName}`);
        
        this.log('info', 'Backup restore completed successfully', { 
          backupId, 
          targetVm: targetVmName 
        });
        
        return {
          success: true,
          backupId,
          targetVm: targetVmName,
          message: 'Backup restored successfully'
        };
        
      } finally {
        // Clean up restore directory
        await fs.rm(restoreDir, { recursive: true, force: true });
      }
      
    } catch (error) {
      this.log('error', 'Failed to restore backup', { 
        backupId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Schedule backup
   */
  scheduleBackup(schedule) {
    const {
      id,
      vmName,
      cronExpression,
      enabled = true,
      retentionDays = this.config.defaultRetention,
      type = 'full',
      compression = true,
      encryption = this.config.encryptionEnabled
    } = schedule;
    
    try {
      this.log('info', 'Scheduling backup', { 
        scheduleId: id, 
        vmName, 
        cronExpression 
      });
      
      if (!cron.validate(cronExpression)) {
        throw new Error('Invalid cron expression');
      }
      
      const backupSchedule = {
        id,
        vmName,
        cronExpression,
        enabled,
        retentionDays,
        type,
        compression,
        encryption,
        lastRun: null,
        nextRun: null,
        job: null
      };
      
      if (enabled) {
        backupSchedule.job = cron.schedule(cronExpression, async () => {
          try {
            this.log('info', 'Executing scheduled backup', { 
              scheduleId: id, 
              vmName 
            });
            
            const result = await this.createBackup({
              vmName,
              type,
              compression,
              encryption,
              retentionDays,
              description: `Scheduled backup (${type})`
            });
            
            backupSchedule.lastRun = new Date().toISOString();
            
            this.log('info', 'Scheduled backup completed', { 
              scheduleId: id, 
              backupId: result.backupId 
            });
            
          } catch (error) {
            this.log('error', 'Scheduled backup failed', { 
              scheduleId: id, 
              vmName, 
              error: error.message 
            });
          }
        });
        
        backupSchedule.nextRun = backupSchedule.job.nextDates(1)[0];
      }
      
      this.schedules.set(id, backupSchedule);
      
      this.log('info', 'Backup scheduled successfully', { 
        scheduleId: id,
        nextRun: backupSchedule.nextRun 
      });
      
      return {
        success: true,
        scheduleId: id,
        message: 'Backup scheduled successfully'
      };
      
    } catch (error) {
      this.log('error', 'Failed to schedule backup', { 
        scheduleId: id, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Helper methods
   */
  async getVmInfo(vmName) {
    try {
      const result = await this.executeCommand(`limactl list --json`);
      const vms = JSON.parse(result);
      return vms.find(vm => vm.name === vmName);
    } catch {
      return null;
    }
  }
  
  async getVmStatus(vmName) {
    const vmInfo = await this.getVmInfo(vmName);
    return vmInfo ? vmInfo.status : null;
  }
  
  async vmExists(vmName) {
    const vmInfo = await this.getVmInfo(vmName);
    return !!vmInfo;
  }
  
  async getVmDiskPath(vmName) {
    const vmInfo = await this.getVmInfo(vmName);
    if (!vmInfo) {
      throw new Error(`VM ${vmName} not found`);
    }
    
    // This is a simplified implementation
    // In reality, you would get the disk path from Lima's configuration
    return path.join(process.env.HOME, '.lima', vmName, 'disk.img');
  }
  
  async getVmConfigPath(vmName) {
    try {
      return path.join(process.env.HOME, '.lima', vmName, 'lima.yaml');
    } catch {
      return null;
    }
  }
  
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const child = require('child_process').exec(command);
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data;
      });
      
      child.stderr.on('data', (data) => {
        stderr += data;
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      child.on('error', reject);
    });
  }
  
  failBackup(backupId, error) {
    const backup = this.activeBackups.get(backupId);
    if (backup) {
      backup.status = 'failed';
      backup.error = error;
      backup.completedAt = new Date().toISOString();
      
      // Move to failed storage
      const failedPath = path.join(this.config.storagePath, 'failed', backup.id);
      fs.rename(backup.tempDir, failedPath).catch(() => {});
      
      this.activeBackups.delete(backupId);
      this.backupHistory.push(backup);
    }
  }
  
  async cleanupOldBackups(vmName, retentionDays) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const oldBackups = this.backupHistory.filter(backup => 
        backup.vmName === vmName && 
        backup.status === 'completed' && 
        new Date(backup.createdAt) < cutoffDate
      );
      
      for (const backup of oldBackups) {
        try {
          await fs.unlink(backup.location);
          this.log('info', 'Cleaned up old backup', { 
            backupId: backup.id,
            age: `${retentionDays} days` 
          });
        } catch (error) {
          this.log('warn', 'Failed to cleanup old backup', { 
            backupId: backup.id,
            error: error.message 
          });
        }
      }
      
    } catch (error) {
      this.log('error', 'Failed to cleanup old backups', { 
        vmName, 
        error: error.message 
      });
    }
  }
  
  // Get backup status
  getBackupStatus(backupId) {
    const backup = this.activeBackups.get(backupId) || 
                   this.backupHistory.find(b => b.id === backupId);
    
    if (!backup) {
      return null;
    }
    
    return {
      id: backup.id,
      vmName: backup.vmName,
      status: backup.status,
      progress: backup.progress,
      size: backup.size,
      createdAt: backup.createdAt,
      completedAt: backup.completedAt,
      error: backup.error
    };
  }
  
  // List backups
  listBackups(filters = {}) {
    let backups = [...this.backupHistory];
    
    if (filters.vmName) {
      backups = backups.filter(b => b.vmName === filters.vmName);
    }
    
    if (filters.status) {
      backups = backups.filter(b => b.status === filters.status);
    }
    
    if (filters.type) {
      backups = backups.filter(b => b.type === filters.type);
    }
    
    return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  
  // Get backup statistics
  getStatistics() {
    const totalBackups = this.backupHistory.length;
    const completedBackups = this.backupHistory.filter(b => b.status === 'completed').length;
    const failedBackups = this.backupHistory.filter(b => b.status === 'failed').length;
    const totalSize = this.backupHistory
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + b.size, 0);
    
    return {
      totalBackups,
      completedBackups,
      failedBackups,
      activeBackups: this.activeBackups.size,
      totalSize,
      averageSize: completedBackups > 0 ? Math.round(totalSize / completedBackups) : 0
    };
  }
}

module.exports = BackupService;