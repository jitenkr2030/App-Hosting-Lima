#!/usr/bin/env node

/**
 * LimaHost Backup Service
 * 
 * A comprehensive backup and snapshot management system for Lima VMs.
 * Handles automated backups, snapshots, scheduling, and restore operations.
 * 
 * Features:
 * - Automated VM snapshots and backups
 * - Configurable backup schedules and retention policies
 * - Multiple storage backends (local, S3, MinIO)
 * - Backup verification and integrity checking
 * - Incremental and differential backups
 * - Compression and encryption
 * - Restore operations with point-in-time recovery
 * - Backup monitoring and alerting
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');
const os = require('os');
const schedule = require('node-schedule');
const tar = require('tar');
const zlib = require('zlib');
const { pipeline } = require('stream');
const { promisify } = require('util');
const AWS = require('aws-sdk');
const { createHash } = require('crypto');

const pipelineAsync = promisify(pipeline);

class BackupService {
  constructor(config = {}) {
    this.config = {
      // Service configuration
      serviceName: config.serviceName || 'limahost-backup',
      dataDir: config.dataDir || '/var/lib/limahost/backups',
      logDir: config.logDir || '/var/log/limahost',
      tempDir: config.tempDir || '/tmp/limahost-backup',
      
      // Storage configuration
      storageBackend: config.storageBackend || 'local', // local, s3, minio
      storageConfig: config.storageConfig || {
        local: {
          basePath: '/backups/limahost'
        },
        s3: {
          bucket: 'limahost-backups',
          region: 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        minio: {
          endPoint: 'localhost:9000',
          bucket: 'limahost-backups',
          accessKey: process.env.MINIO_ACCESS_KEY,
          secretKey: process.env.MINIO_SECRET_KEY,
          useSSL: false
        }
      },
      
      // Backup configuration
      defaultCompression: config.defaultCompression || 'gzip', // none, gzip, brotli
      defaultEncryption: config.defaultEncryption || 'aes256', // none, aes256
      compressionLevel: config.compressionLevel || 6,
      chunkSize: config.chunkSize || 64 * 1024 * 1024, // 64MB chunks
      
      // Retention policies
      retention: config.retention || {
        daily: 7,
        weekly: 4,
        monthly: 12,
        yearly: 3
      },
      
      // Scheduling
      schedules: config.schedules || {
        daily: '0 2 * * *',     // 2 AM daily
        weekly: '0 3 * * 0',   // 3 AM Sunday
        monthly: '0 4 1 * *'    // 4 AM 1st of month
      },
      
      // Performance
      maxConcurrentBackups: config.maxConcurrentBackups || 3,
      maxConcurrentRestores: config.maxConcurrentRestores || 2,
      timeout: config.timeout || 3600000, // 1 hour
      
      // Security
      encryptionKey: config.encryptionKey || process.env.BACKUP_ENCRYPTION_KEY,
      requireIntegrityCheck: config.requireIntegrityCheck !== false,
      
      // Monitoring
      healthCheckInterval: config.healthCheckInterval || 300000, // 5 minutes
      metricsInterval: config.metricsInterval || 60000, // 1 minute
      
      // Logging
      logLevel: config.logLevel || 'info',
      logRetention: config.logRetention || 30,
      
      ...config
    };
    
    // Initialize state
    this.isRunning = false;
    this.backups = new Map();
    this.schedules = new Map();
    this.operations = new Map();
    this.metrics = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      totalRestores: 0,
      successfulRestores: 0,
      failedRestores: 0,
      storageUsed: 0,
      lastBackupTime: null,
      averageBackupTime: 0,
      averageBackupSize: 0
    };
    
    // Initialize storage client
    this.storageClient = null;
    this.initializeStorage();
    
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
          service: this.config.serviceName,
          message,
          ...data
        };
        
        // Log to console
        console.log(JSON.stringify(logEntry));
        
        // Log to file (async)
        const logFile = path.join(this.config.logDir, 'backup-service.log');
        fs.appendFile(logFile, JSON.stringify(logEntry) + '\n').catch(err => {
          console.error('Failed to write to log file:', err);
        });
      }
    };
  }
  
  setupProcessHandlers() {
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    process.on('uncaughtException', (err) => {
      this.log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
      this.shutdown(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
      this.log('error', 'Unhandled promise rejection', { reason, promise });
    });
  }
  
  initializeStorage() {
    switch (this.config.storageBackend) {
      case 's3':
        this.storageClient = new AWS.S3(this.config.storageConfig.s3);
        break;
      case 'minio':
        this.storageClient = new AWS.S3({
          endpoint: `http://${this.config.storageConfig.minio.endPoint}`,
          accessKeyId: this.config.storageConfig.minio.accessKey,
          secretAccessKey: this.config.storageConfig.minio.secretKey,
          s3ForcePathStyle: true,
          signatureVersion: 'v4'
        });
        break;
      case 'local':
      default:
        this.storageClient = new LocalStorage(this.config.storageConfig.local);
        break;
    }
  }
  
  async start() {
    try {
      this.log('info', 'Starting backup service', { 
        version: '1.0.0',
        storageBackend: this.config.storageBackend,
        config: this.config
      });
      
      // Create necessary directories
      await this.createDirectories();
      
      // Load existing backups
      await this.loadExistingBackups();
      
      // Start scheduled backups
      await this.startScheduledBackups();
      
      // Start periodic tasks
      this.startPeriodicTasks();
      
      this.isRunning = true;
      this.log('info', 'Backup service started successfully');
      
      return true;
    } catch (error) {
      this.log('error', 'Failed to start backup service', { error: error.message });
      throw error;
    }
  }
  
  async createDirectories() {
    const directories = [
      this.config.dataDir,
      this.config.logDir,
      this.config.tempDir,
      path.join(this.config.dataDir, 'metadata'),
      path.join(this.config.dataDir, 'chunks'),
      path.join(this.config.dataDir, 'indexes')
    ];
    
    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true, mode: 0o755 });
        this.log('debug', 'Created directory', { dir });
      }
    }
  }
  
  async loadExistingBackups() {
    try {
      const metadataDir = path.join(this.config.dataDir, 'metadata');
      const files = await fs.readdir(metadataDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const metadata = JSON.parse(await fs.readFile(path.join(metadataDir, file), 'utf8'));
            this.backups.set(metadata.id, metadata);
            this.log('debug', 'Loaded backup metadata', { backupId: metadata.id, vmName: metadata.vmName });
          } catch (error) {
            this.log('warn', 'Failed to load backup metadata', { file, error: error.message });
          }
        }
      }
      
      this.updateMetrics();
      this.log('info', 'Loaded existing backups', { count: this.backups.size });
    } catch (error) {
      this.log('error', 'Failed to load existing backups', { error: error.message });
    }
  }
  
  async startScheduledBackups() {
    const schedules = this.config.schedules;
    
    // Daily backups
    if (schedules.daily) {
      const dailyJob = schedule.scheduleJob(schedules.daily, async () => {
        await this.performScheduledBackup('daily');
      });
      this.schedules.set('daily', dailyJob);
      this.log('info', 'Scheduled daily backups', { schedule: schedules.daily });
    }
    
    // Weekly backups
    if (schedules.weekly) {
      const weeklyJob = schedule.scheduleJob(schedules.weekly, async () => {
        await this.performScheduledBackup('weekly');
      });
      this.schedules.set('weekly', weeklyJob);
      this.log('info', 'Scheduled weekly backups', { schedule: schedules.weekly });
    }
    
    // Monthly backups
    if (schedules.monthly) {
      const monthlyJob = schedule.scheduleJob(schedules.monthly, async () => {
        await this.performScheduledBackup('monthly');
      });
      this.schedules.set('monthly', monthlyJob);
      this.log('info', 'Scheduled monthly backups', { schedule: schedules.monthly });
    }
  }
  
  async performScheduledBackup(type) {
    this.log('info', 'Starting scheduled backup', { type });
    
    try {
      // Get list of VMs to backup
      const vms = await this.getVmList();
      
      for (const vm of vms) {
        try {
          await this.createBackup(vm.name, {
            type,
            description: `Scheduled ${type} backup`,
            tags: [`scheduled:${type}`, `auto:${type}`]
          });
        } catch (error) {
          this.log('error', 'Scheduled backup failed', { vmName: vm.name, type, error: error.message });
        }
      }
      
      // Apply retention policies
      await this.applyRetentionPolicy(type);
      
    } catch (error) {
      this.log('error', 'Scheduled backup failed', { type, error: error.message });
    }
  }
  
  async getVmList() {
    return new Promise((resolve, reject) => {
      exec('limactl list --json', (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to get VM list: ${stderr}`));
          return;
        }
        
        try {
          const vms = JSON.parse(stdout);
          resolve(vms.filter(vm => vm.status === 'Running'));
        } catch (parseError) {
          reject(new Error(`Failed to parse VM list: ${parseError.message}`));
        }
      });
    });
  }
  
  startPeriodicTasks() {
    // Health checks
    setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
    
    // Metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
    
    // Cleanup old temp files
    setInterval(() => {
      this.cleanupTempFiles();
    }, 3600000); // Every hour
    
    // Initial calls
    this.performHealthCheck();
    this.collectMetrics();
  }
  
  async createBackup(vmName, options = {}) {
    const backupId = `backup-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();
    
    try {
      this.log('info', 'Creating backup', { backupId, vmName, options });
      
      // Check if VM exists
      const vmInfo = await this.getVmInfo(vmName);
      if (!vmInfo) {
        throw new Error(`VM ${vmName} not found`);
      }
      
      // Create backup operation
      const operation = {
        id: `op-${backupId}`,
        type: 'backup',
        vmName,
        backupId,
        status: 'running',
        startTime: startTime,
        endTime: null,
        progress: 0,
        size: 0,
        chunks: [],
        error: null
      };
      
      this.operations.set(operation.id, operation);
      
      // Create backup metadata
      const metadata = {
        id: backupId,
        vmName,
        vmInfo,
        type: options.type || 'manual',
        description: options.description || `Backup of ${vmName}`,
        tags: options.tags || [],
        createdAt: new Date().toISOString(),
        createdBy: options.createdBy || 'system',
        compression: this.config.defaultCompression,
        encryption: this.config.defaultEncryption,
        chunkSize: this.config.chunkSize,
        status: 'creating',
        size: 0,
        chunks: [],
        checksum: null,
        integrityVerified: false
      };
      
      // Stop VM for consistent backup (optional)
      const wasRunning = vmInfo.status === 'Running';
      if (options.stopVm && wasRunning) {
        await this.stopVm(vmName);
      }
      
      try {
        // Create backup
        const backupResult = await this.performBackup(vmName, metadata, operation);
        
        // Update metadata
        metadata.status = 'completed';
        metadata.size = backupResult.size;
        metadata.chunks = backupResult.chunks;
        metadata.checksum = backupResult.checksum;
        metadata.integrityVerified = backupResult.integrityVerified;
        metadata.completedAt = new Date().toISOString();
        
        // Save metadata
        await this.saveBackupMetadata(metadata);
        this.backups.set(backupId, metadata);
        
        // Update operation
        operation.status = 'completed';
        operation.endTime = Date.now();
        operation.size = backupResult.size;
        operation.progress = 100;
        this.operations.set(operation.id, operation);
        
        // Update metrics
        this.metrics.totalBackups++;
        this.metrics.successfulBackups++;
        this.metrics.lastBackupTime = metadata.completedAt;
        this.updateMetrics();
        
        this.log('info', 'Backup completed successfully', { 
          backupId, 
          vmName, 
          size: backupResult.size,
          duration: Date.now() - startTime 
        });
        
        return {
          success: true,
          backupId,
          metadata,
          size: backupResult.size,
          duration: Date.now() - startTime
        };
        
      } finally {
        // Restart VM if it was stopped
        if (options.stopVm && wasRunning) {
          await this.startVm(vmName);
        }
      }
      
    } catch (error) {
      this.log('error', 'Backup failed', { backupId, vmName, error: error.message });
      
      // Update operation
      const operation = this.operations.get(`op-${backupId}`);
      if (operation) {
        operation.status = 'failed';
        operation.endTime = Date.now();
        operation.error = error.message;
        this.operations.set(operation.id, operation);
      }
      
      // Update metrics
      this.metrics.totalBackups++;
      this.metrics.failedBackups++;
      
      throw error;
    }
  }
  
  async performBackup(vmName, metadata, operation) {
    const tempDir = path.join(this.config.tempDir, metadata.id);
    const backupFile = path.join(tempDir, 'backup.tar');
    
    try {
      // Create temporary directory
      await fs.mkdir(tempDir, { recursive: true });
      
      // Get VM disk path
      const vmDiskPath = await this.getVmDiskPath(vmName);
      
      // Step 1: Create snapshot (if supported)
      await this.createVmSnapshot(vmName, `${metadata.id}-snapshot`);
      
      // Step 2: Copy VM disk to temporary location
      await this.copyVmDisk(vmDiskPath, backupFile);
      
      // Step 3: Compress if enabled
      let compressedFile = backupFile;
      if (metadata.compression !== 'none') {
        compressedFile = await this.compressFile(backupFile, metadata.compression);
      }
      
      // Step 4: Encrypt if enabled
      let encryptedFile = compressedFile;
      if (metadata.encryption !== 'none') {
        encryptedFile = await this.encryptFile(compressedFile, metadata.encryption);
      }
      
      // Step 5: Split into chunks and upload
      const chunks = await this.splitAndUpload(encryptedFile, metadata, operation);
      
      // Step 6: Calculate checksum
      const checksum = await this.calculateFileChecksum(encryptedFile);
      
      // Step 7: Verify integrity
      const integrityVerified = await this.verifyBackupIntegrity(chunks, checksum);
      
      // Step 8: Clean up snapshot
      await this.deleteVmSnapshot(vmName, `${metadata.id}-snapshot`);
      
      // Step 9: Clean up temporary files
      await this.cleanupTempFiles(tempDir);
      
      return {
        size: (await fs.stat(encryptedFile)).size,
        chunks,
        checksum,
        integrityVerified
      };
      
    } catch (error) {
      // Clean up on error
      await this.cleanupTempFiles(tempDir);
      await this.deleteVmSnapshot(vmName, `${metadata.id}-snapshot`);
      throw error;
    }
  }
  
  async getVmInfo(vmName) {
    return new Promise((resolve, reject) => {
      exec(`limactl list --json`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to get VM info: ${stderr}`));
          return;
        }
        
        try {
          const vms = JSON.parse(stdout);
          const vm = vms.find(v => v.name === vmName);
          resolve(vm || null);
        } catch (parseError) {
          reject(new Error(`Failed to parse VM info: ${parseError.message}`));
        }
      });
    });
  }
  
  async getVmDiskPath(vmName) {
    return new Promise((resolve, reject) => {
      exec(`limactl show-ssh --format='{{.Dir}}' ${vmName}`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to get VM disk path: ${stderr}`));
          return;
        }
        
        const vmDir = stdout.trim();
        const diskPath = path.join(vmDir, 'disk.img');
        resolve(diskPath);
      });
    });
  }
  
  async createVmSnapshot(vmName, snapshotName) {
    return new Promise((resolve, reject) => {
      exec(`limactl snapshot create ${vmName} ${snapshotName}`, (error, stdout, stderr) => {
        if (error) {
          this.log('warn', 'Failed to create VM snapshot', { vmName, snapshotName, error: stderr });
          resolve(); // Continue without snapshot
        } else {
          this.log('debug', 'VM snapshot created', { vmName, snapshotName });
          resolve();
        }
      });
    });
  }
  
  async deleteVmSnapshot(vmName, snapshotName) {
    return new Promise((resolve, reject) => {
      exec(`limactl snapshot delete ${vmName} ${snapshotName}`, (error, stdout, stderr) => {
        if (error) {
          this.log('warn', 'Failed to delete VM snapshot', { vmName, snapshotName, error: stderr });
        } else {
          this.log('debug', 'VM snapshot deleted', { vmName, snapshotName });
        }
        resolve();
      });
    });
  }
  
  async copyVmDisk(sourcePath, destPath) {
    return new Promise((resolve, reject) => {
      const rsync = spawn('rsync', [
        '--progress',
        '--sparse',
        sourcePath,
        destPath
      ]);
      
      let errorOutput = '';
      
      rsync.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      rsync.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`rsync failed with code ${code}: ${errorOutput}`));
        }
      });
      
      rsync.on('error', (error) => {
        reject(new Error(`rsync error: ${error.message}`));
      });
    });
  }
  
  async compressFile(filePath, compressionType) {
    const compressedPath = `${filePath}.${compressionType === 'gzip' ? 'gz' : 'br'}`;
    
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath);
      let writeStream;
      
      if (compressionType === 'gzip') {
        writeStream = fs.createWriteStream(compressedPath);
        const gzip = zlib.createGzip({ level: this.config.compressionLevel });
        pipelineAsync(readStream, gzip, writeStream)
          .then(() => resolve(compressedPath))
          .catch(reject);
      } else if (compressionType === 'brotli') {
        writeStream = fs.createWriteStream(compressedPath);
        const brotli = zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.compressionLevel
          }
        });
        pipelineAsync(readStream, brotli, writeStream)
          .then(() => resolve(compressedPath))
          .catch(reject);
      } else {
        resolve(filePath); // No compression
      }
    });
  }
  
  async encryptFile(filePath, encryptionType) {
    if (!this.config.encryptionKey) {
      return filePath; // No encryption key, skip encryption
    }
    
    const encryptedPath = `${filePath}.enc`;
    
    return new Promise((resolve, reject) => {
      const algorithm = encryptionType === 'aes256' ? 'aes-256-cbc' : 'aes-128-cbc';
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      const readStream = fs.createReadStream(filePath);
      const writeStream = fs.createWriteStream(encryptedPath);
      
      // Write IV first
      writeStream.write(iv);
      
      pipelineAsync(readStream, cipher, writeStream)
        .then(() => resolve(encryptedPath))
        .catch(reject);
    });
  }
  
  async splitAndUpload(filePath, metadata, operation) {
    const stats = await fs.stat(filePath);
    const totalSize = stats.size;
    const chunkSize = metadata.chunkSize;
    const chunks = [];
    
    let chunkIndex = 0;
    let bytesRead = 0;
    
    const readStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });
    
    for await (const chunk of readStream) {
      const chunkId = `${metadata.id}-chunk-${chunkIndex.toString().padStart(6, '0')}`;
      const chunkData = {
        id: chunkId,
        backupId: metadata.id,
        index: chunkIndex,
        size: chunk.length,
        checksum: crypto.createHash('sha256').update(chunk).digest('hex')
      };
      
      // Upload chunk
      await this.uploadChunk(chunkId, chunk, metadata);
      
      chunks.push(chunkData);
      bytesRead += chunk.length;
      
      // Update operation progress
      if (operation) {
        operation.progress = Math.round((bytesRead / totalSize) * 100);
        operation.size = bytesRead;
        this.operations.set(operation.id, operation);
      }
      
      chunkIndex++;
    }
    
    return chunks;
  }
  
  async uploadChunk(chunkId, chunkData, metadata) {
    const key = `backups/${metadata.id}/chunks/${chunkId}`;
    
    if (this.config.storageBackend === 'local') {
      const chunkPath = path.join(this.config.storageConfig.local.basePath, key);
      await fs.mkdir(path.dirname(chunkPath), { recursive: true });
      await fs.writeFile(chunkPath, chunkData);
    } else {
      await this.storageClient.putObject({
        Bucket: this.config.storageConfig[this.config.storageBackend].bucket,
        Key: key,
        Body: chunkData,
        ContentType: 'application/octet-stream'
      }).promise();
    }
  }
  
  async calculateFileChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (chunk) => {
        hash.update(chunk);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', reject);
    });
  }
  
  async verifyBackupIntegrity(chunks, expectedChecksum) {
    if (!this.config.requireIntegrityCheck) {
      return true;
    }
    
    try {
      // Download and verify each chunk
      for (const chunk of chunks) {
        const chunkData = await this.downloadChunk(chunk.id, chunk.backupId);
        const actualChecksum = crypto.createHash('sha256').update(chunkData).digest('hex');
        
        if (actualChecksum !== chunk.checksum) {
          this.log('error', 'Chunk integrity check failed', { chunkId: chunk.id });
          return false;
        }
      }
      
      return true;
    } catch (error) {
      this.log('error', 'Integrity verification failed', { error: error.message });
      return false;
    }
  }
  
  async downloadChunk(chunkId, backupId) {
    const key = `backups/${backupId}/chunks/${chunkId}`;
    
    if (this.config.storageBackend === 'local') {
      const chunkPath = path.join(this.config.storageConfig.local.basePath, key);
      return fs.readFile(chunkPath);
    } else {
      const response = await this.storageClient.getObject({
        Bucket: this.config.storageConfig[this.config.storageBackend].bucket,
        Key: key
      }).promise();
      
      return response.Body;
    }
  }
  
  async saveBackupMetadata(metadata) {
    const metadataPath = path.join(this.config.dataDir, 'metadata', `${metadata.id}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }
  
  async stopVm(vmName) {
    return new Promise((resolve, reject) => {
      exec(`limactl stop ${vmName}`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to stop VM: ${stderr}`));
        } else {
          resolve();
        }
      });
    });
  }
  
  async startVm(vmName) {
    return new Promise((resolve, reject) => {
      exec(`limactl start ${vmName}`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to start VM: ${stderr}`));
        } else {
          resolve();
        }
      });
    });
  }
  
  async cleanupTempFiles(tempDir) {
    try {
      if (tempDir && await fs.access(tempDir).then(() => true).catch(() => false)) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      this.log('warn', 'Failed to cleanup temp files', { tempDir, error: error.message });
    }
  }
  
  async restoreBackup(backupId, options = {}) {
    const startTime = Date.now();
    
    try {
      this.log('info', 'Starting backup restore', { backupId, options });
      
      // Get backup metadata
      const metadata = this.backups.get(backupId);
      if (!metadata) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      // Create restore operation
      const operation = {
        id: `op-restore-${Date.now()}`,
        type: 'restore',
        backupId,
        vmName: options.vmName || metadata.vmName,
        status: 'running',
        startTime: startTime,
        endTime: null,
        progress: 0,
        error: null
      };
      
      this.operations.set(operation.id, operation);
      
      // Perform restore
      const restoreResult = await this.performRestore(metadata, options, operation);
      
      // Update operation
      operation.status = 'completed';
      operation.endTime = Date.now();
      operation.progress = 100;
      this.operations.set(operation.id, operation);
      
      // Update metrics
      this.metrics.totalRestores++;
      this.metrics.successfulRestores++;
      
      this.log('info', 'Backup restore completed successfully', { 
        backupId, 
        vmName: operation.vmName,
        duration: Date.now() - startTime 
      });
      
      return {
        success: true,
        backupId,
        vmName: operation.vmName,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      this.log('error', 'Backup restore failed', { backupId, error: error.message });
      
      // Update operation
      const operation = this.operations.get(`op-restore-${Date.now()}`);
      if (operation) {
        operation.status = 'failed';
        operation.endTime = Date.now();
        operation.error = error.message;
        this.operations.set(operation.id, operation);
      }
      
      // Update metrics
      this.metrics.totalRestores++;
      this.metrics.failedRestores++;
      
      throw error;
    }
  }
  
  async performRestore(metadata, options, operation) {
    const tempDir = path.join(this.config.tempDir, `restore-${metadata.id}`);
    const restoredFile = path.join(tempDir, 'restored.img');
    
    try {
      // Create temporary directory
      await fs.mkdir(tempDir, { recursive: true });
      
      // Download and reassemble chunks
      const encryptedFile = await this.downloadAndReassembleChunks(metadata, operation);
      
      // Decrypt if encrypted
      let decryptedFile = encryptedFile;
      if (metadata.encryption !== 'none') {
        decryptedFile = await this.decryptFile(encryptedFile, metadata.encryption);
      }
      
      // Decompress if compressed
      let decompressedFile = decryptedFile;
      if (metadata.compression !== 'none') {
        decompressedFile = await this.decompressFile(decryptedFile, metadata.compression);
      }
      
      // Stop target VM if it exists
      const targetVmName = options.vmName || metadata.vmName;
      const vmInfo = await this.getVmInfo(targetVmName);
      if (vmInfo && vmInfo.status === 'Running') {
        await this.stopVm(targetVmName);
      }
      
      // Replace VM disk
      const vmDiskPath = await this.getVmDiskPath(targetVmName);
      await fs.copyFile(decompressedFile, vmDiskPath);
      
      // Start VM
      await this.startVm(targetVmName);
      
      // Clean up temporary files
      await this.cleanupTempFiles(tempDir);
      
      return { success: true };
      
    } catch (error) {
      await this.cleanupTempFiles(tempDir);
      throw error;
    }
  }
  
  async downloadAndReassembleChunks(metadata, operation) {
    const tempFile = path.join(this.config.tempDir, `restore-${metadata.id}`, 'assembled.enc');
    const writeStream = fs.createWriteStream(tempFile);
    
    // Sort chunks by index
    const sortedChunks = metadata.chunks.sort((a, b) => a.index - b.index);
    
    for (let i = 0; i < sortedChunks.length; i++) {
      const chunk = sortedChunks[i];
      const chunkData = await this.downloadChunk(chunk.id, metadata.backupId);
      
      await new Promise((resolve, reject) => {
        writeStream.write(chunkData, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      // Update progress
      if (operation) {
        operation.progress = Math.round(((i + 1) / sortedChunks.length) * 100);
        this.operations.set(operation.id, operation);
      }
    }
    
    writeStream.end();
    await new Promise(resolve => writeStream.on('finish', resolve));
    
    return tempFile;
  }
  
  async decryptFile(filePath, encryptionType) {
    if (!this.config.encryptionKey) {
      return filePath; // No encryption key, skip decryption
    }
    
    const decryptedPath = filePath.replace('.enc', '');
    
    return new Promise((resolve, reject) => {
      const algorithm = encryptionType === 'aes256' ? 'aes-256-cbc' : 'aes-128-cbc';
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
      
      const readStream = fs.createReadStream(filePath);
      const writeStream = fs.createWriteStream(decryptedPath);
      
      // Read IV first
      const iv = Buffer.alloc(16);
      readStream.once('readable', () => {
        readStream.read(iv);
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        
        pipelineAsync(readStream, decipher, writeStream)
          .then(() => resolve(decryptedPath))
          .catch(reject);
      });
    });
  }
  
  async decompressFile(filePath, compressionType) {
    const decompressedPath = filePath.replace(/\.(gz|br)$/, '');
    
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath);
      const writeStream = fs.createWriteStream(decompressedPath);
      
      let decompressStream;
      
      if (compressionType === 'gzip') {
        decompressStream = zlib.createGunzip();
      } else if (compressionType === 'brotli') {
        decompressStream = zlib.createBrotliDecompress();
      } else {
        resolve(filePath); // No compression
        return;
      }
      
      pipelineAsync(readStream, decompressStream, writeStream)
        .then(() => resolve(decompressedPath))
        .catch(reject);
    });
  }
  
  async applyRetentionPolicy(backupType) {
    const retention = this.config.retention[backupType];
    if (!retention) return;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retention);
    
    const backupsToDelete = [];
    
    for (const [backupId, metadata] of this.backups) {
      if (metadata.type === backupType && new Date(metadata.createdAt) < cutoffDate) {
        backupsToDelete.push(backupId);
      }
    }
    
    for (const backupId of backupsToDelete) {
      try {
        await this.deleteBackup(backupId);
        this.log('info', 'Deleted expired backup', { backupId, backupType });
      } catch (error) {
        this.log('error', 'Failed to delete expired backup', { backupId, error: error.message });
      }
    }
  }
  
  async deleteBackup(backupId) {
    const metadata = this.backups.get(backupId);
    if (!metadata) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    // Delete chunks from storage
    for (const chunk of metadata.chunks) {
      try {
        await this.deleteChunk(chunk.id, backupId);
      } catch (error) {
        this.log('warn', 'Failed to delete chunk', { chunkId: chunk.id, error: error.message });
      }
    }
    
    // Delete metadata
    const metadataPath = path.join(this.config.dataDir, 'metadata', `${backupId}.json`);
    await fs.unlink(metadataPath).catch(() => {});
    
    // Remove from memory
    this.backups.delete(backupId);
    
    // Update metrics
    this.metrics.storageUsed -= metadata.size;
  }
  
  async deleteChunk(chunkId, backupId) {
    const key = `backups/${backupId}/chunks/${chunkId}`;
    
    if (this.config.storageBackend === 'local') {
      const chunkPath = path.join(this.config.storageConfig.local.basePath, key);
      await fs.unlink(chunkPath).catch(() => {});
    } else {
      await this.storageClient.deleteObject({
        Bucket: this.config.storageConfig[this.config.storageBackend].bucket,
        Key: key
      }).promise().catch(() => {});
    }
  }
  
  async performHealthCheck() {
    try {
      // Check storage backend
      await this.checkStorageHealth();
      
      // Check scheduled jobs
      await this.checkScheduledJobs();
      
      // Check for stuck operations
      await this.checkStuckOperations();
      
      this.log('debug', 'Health check completed');
    } catch (error) {
      this.log('error', 'Health check failed', { error: error.message });
    }
  }
  
  async checkStorageHealth() {
    if (this.config.storageBackend === 'local') {
      // Check disk space
      const stats = await fs.statfs(this.config.storageConfig.local.basePath);
      const totalSpace = stats.blocks * stats.bsize;
      const freeSpace = stats.bfree * stats.bsize;
      const usedSpace = totalSpace - freeSpace;
      const usagePercent = (usedSpace / totalSpace) * 100;
      
      if (usagePercent > 90) {
        this.log('warn', 'Storage space critically low', { usagePercent: usagePercent.toFixed(2) });
      }
    } else {
      // Check S3/MinIO connectivity
      try {
        await this.storageClient.headBucket({
          Bucket: this.config.storageConfig[this.config.storageBackend].bucket
        }).promise();
      } catch (error) {
        this.log('error', 'Storage backend connectivity check failed', { error: error.message });
      }
    }
  }
  
  async checkScheduledJobs() {
    for (const [name, job] of this.schedules) {
      try {
        const nextInvocation = job.nextInvocation();
        this.log('debug', 'Scheduled job status', { name, nextInvocation });
      } catch (error) {
        this.log('error', 'Scheduled job check failed', { name, error: error.message });
      }
    }
  }
  
  async checkStuckOperations() {
    const timeout = this.config.timeout;
    const now = Date.now();
    
    for (const [operationId, operation] of this.operations) {
      if (operation.status === 'running' && (now - operation.startTime) > timeout) {
        operation.status = 'timeout';
        operation.endTime = now;
        operation.error = 'Operation timed out';
        this.operations.set(operationId, operation);
        
        this.log('warn', 'Operation timed out', { operationId, duration: now - operation.startTime });
      }
    }
  }
  
  async collectMetrics() {
    try {
      // Calculate storage usage
      let totalStorageUsed = 0;
      for (const metadata of this.backups.values()) {
        totalStorageUsed += metadata.size;
      }
      this.metrics.storageUsed = totalStorageUsed;
      
      // Calculate average backup time and size
      const completedBackups = Array.from(this.backups.values()).filter(b => b.status === 'completed');
      if (completedBackups.length > 0) {
        const totalTime = completedBackups.reduce((sum, b) => {
          const duration = new Date(b.completedAt).getTime() - new Date(b.createdAt).getTime();
          return sum + duration;
        }, 0);
        const totalSize = completedBackups.reduce((sum, b) => sum + b.size, 0);
        
        this.metrics.averageBackupTime = totalTime / completedBackups.length;
        this.metrics.averageBackupSize = totalSize / completedBackups.length;
      }
      
      this.log('debug', 'Metrics collected', this.metrics);
    } catch (error) {
      this.log('error', 'Failed to collect metrics', { error: error.message });
    }
  }
  
  updateMetrics() {
    // This method is called when backups are added/removed
    this.collectMetrics();
  }
  
  async cleanupTempFiles(tempDir = null) {
    try {
      const targetDir = tempDir || this.config.tempDir;
      const files = await fs.readdir(targetDir);
      
      for (const file of files) {
        const filePath = path.join(targetDir, file);
        const stats = await fs.stat(filePath);
        
        // Delete files older than 1 hour
        if (Date.now() - stats.mtime.getTime() > 3600000) {
          await fs.unlink(filePath).catch(() => {});
        }
      }
    } catch (error) {
      this.log('warn', 'Failed to cleanup temp files', { error: error.message });
    }
  }
  
  async shutdown() {
    this.log('info', 'Shutting down backup service');
    
    this.isRunning = false;
    
    // Cancel scheduled jobs
    for (const [name, job] of this.schedules) {
      job.cancel();
    }
    
    // Wait for running operations to complete or timeout
    const runningOperations = Array.from(this.operations.values()).filter(op => op.status === 'running');
    if (runningOperations.length > 0) {
      this.log('info', 'Waiting for running operations to complete', { count: runningOperations.length });
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    }
    
    this.log('info', 'Backup service shutdown complete');
    process.exit(0);
  }
  
  // Public API methods
  async listBackups(filter = {}) {
    let backups = Array.from(this.backups.values());
    
    // Apply filters
    if (filter.vmName) {
      backups = backups.filter(b => b.vmName === filter.vmName);
    }
    
    if (filter.type) {
      backups = backups.filter(b => b.type === filter.type);
    }
    
    if (filter.status) {
      backups = backups.filter(b => b.status === filter.status);
    }
    
    if (filter.tags) {
      backups = backups.filter(b => 
        filter.tags.every(tag => b.tags.includes(tag))
      );
    }
    
    return backups;
  }
  
  async getBackup(backupId) {
    return this.backups.get(backupId);
  }
  
  async getOperations() {
    return Array.from(this.operations.values());
  }
  
  async getMetrics() {
    return { ...this.metrics };
  }
  
  async getStatus() {
    return {
      isRunning: this.isRunning,
      backupsCount: this.backups.size,
      operationsCount: this.operations.size,
      scheduledJobsCount: this.schedules.size,
      storageBackend: this.config.storageBackend,
      lastHealthCheck: new Date().toISOString()
    };
  }
}

// Local storage implementation for testing/development
class LocalStorage {
  constructor(config) {
    this.basePath = config.basePath;
  }
  
  async putObject(params) {
    const filePath = path.join(this.basePath, params.Key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, params.Body);
  }
  
  async getObject(params) {
    const filePath = path.join(this.basePath, params.Key);
    const data = await fs.readFile(filePath);
    return { Body: data };
  }
  
  async deleteObject(params) {
    const filePath = path.join(this.basePath, params.Key);
    await fs.unlink(filePath);
  }
  
  async headBucket() {
    // Just check if base path exists
    await fs.access(this.basePath);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
LimaHost Backup Service

Usage: node backup-service.js [options]

Options:
  --config, -c <path>     Path to configuration file
  --vm-name <name>       VM name for backup/restore
  --backup-id <id>       Backup ID for restore
  --create-backup        Create a new backup
  --restore-backup       Restore a backup
  --list-backups         List all backups
  --get-metrics          Get service metrics
  --get-status           Get service status
  --log-level <level>     Log level (error, warn, info, debug)
  --help, -h              Show this help message

Environment Variables:
  BACKUP_ENCRYPTION_KEY   Encryption key for backup encryption
  AWS_ACCESS_KEY_ID       AWS access key (for S3 backend)
  AWS_SECRET_ACCESS_KEY   AWS secret key (for S3 backend)
  MINIO_ACCESS_KEY        MinIO access key (for MinIO backend)
  MINIO_SECRET_KEY        MinIO secret key (for MinIO backend)

Examples:
  node backup-service.js --create-backup --vm-name my-app
  node backup-service.js --restore-backup --backup-id backup-12345
  node backup-service.js --list-backups
  node backup-service.js --config /path/to/config.json
`);
    process.exit(0);
  }
  
  // Parse command line arguments
  const config = {};
  let action = null;
  let actionParams = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
      case '-c':
        config.configPath = args[++i];
        break;
      case '--vm-name':
        actionParams.vmName = args[++i];
        break;
      case '--backup-id':
        actionParams.backupId = args[++i];
        break;
      case '--create-backup':
        action = 'createBackup';
        break;
      case '--restore-backup':
        action = 'restoreBackup';
        break;
      case '--list-backups':
        action = 'listBackups';
        break;
      case '--get-metrics':
        action = 'getMetrics';
        break;
      case '--get-status':
        action = 'getStatus';
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
  
  // Create and start backup service
  const backupService = new BackupService(config);
  
  backupService.start()
    .then(async () => {
      console.log('Backup service started successfully');
      
      // Execute action if specified
      if (action) {
        try {
          switch (action) {
            case 'createBackup':
              if (!actionParams.vmName) {
                console.error('VM name is required for backup creation');
                process.exit(1);
              }
              const result = await backupService.createBackup(actionParams.vmName);
              console.log('Backup created:', result);
              break;
              
            case 'restoreBackup':
              if (!actionParams.backupId) {
                console.error('Backup ID is required for backup restore');
                process.exit(1);
              }
              const restoreResult = await backupService.restoreBackup(actionParams.backupId, actionParams);
              console.log('Backup restored:', restoreResult);
              break;
              
            case 'listBackups':
              const backups = await backupService.listBackups();
              console.log('Backups:', backups);
              break;
              
            case 'getMetrics':
              const metrics = await backupService.getMetrics();
              console.log('Metrics:', metrics);
              break;
              
            case 'getStatus':
              const status = await backupService.getStatus();
              console.log('Status:', status);
              break;
          }
        } catch (error) {
          console.error('Action failed:', error.message);
          process.exit(1);
        }
        
        // Shutdown after action
        await backupService.shutdown();
      }
    })
    .catch((error) => {
      console.error('Failed to start backup service:', error.message);
      process.exit(1);
    });
}

module.exports = BackupService;