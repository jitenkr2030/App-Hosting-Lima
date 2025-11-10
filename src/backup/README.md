# LimaHost Backup Service

The LimaHost Backup Service is a comprehensive backup and snapshot management system for Lima VMs. It provides automated backups, configurable retention policies, multiple storage backends, and reliable restore operations.

## Features

- **Automated Backups**: Scheduled backups with configurable retention policies
- **Multiple Storage Backends**: Support for local storage, AWS S3, and MinIO
- **Snapshot Integration**: Leverages Lima VM snapshots for consistent backups
- **Compression & Encryption**: Optional compression and encryption for security
- **Chunked Storage**: Efficient chunked storage for large backups
- **Integrity Verification**: Automatic backup integrity checking
- **Point-in-Time Restore**: Reliable restore operations with verification
- **Monitoring & Metrics**: Comprehensive monitoring and performance metrics
- **Flexible Scheduling**: Configurable backup schedules (daily, weekly, monthly)
- **Resource Management**: Configurable resource limits and concurrent operations

## Requirements

- Linux operating system
- Node.js 16 or higher
- Lima VM manager
- rsync (for efficient file copying)
- Root privileges for installation

## Installation

### Quick Install

```bash
# Clone the repository
git clone https://github.com/limahost/backup-service.git
cd backup-service

# Install as system service (requires sudo)
sudo npm run install-service
```

### Manual Install

1. **Install Dependencies**:
   ```bash
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Lima
   curl -fsSL https://github.com/lima-vm/lima/releases/latest/download/lima-0.20.0-linux-amd64.tar.gz | tar -xz -C /usr/local/bin
   
   # Install rsync
   sudo apt-get install -y rsync
   ```

2. **Install Service**:
   ```bash
   # Copy service files
   sudo mkdir -p /opt/limahost-backup
   sudo cp backup-service.js package.json /opt/limahost-backup/
   cd /opt/limahost-backup
   
   # Install dependencies
   sudo npm install --production
   
   # Create configuration
   sudo mkdir -p /etc/limahost
   sudo cp config.template.json /etc/limahost/backup-config.json
   
   # Edit configuration
   sudo nano /etc/limahost/backup-config.json
   ```

3. **Install as Service**:
   ```bash
   # Create systemd service
   sudo tee /etc/systemd/system/limahost-backup.service > /dev/null <<EOF
   [Unit]
   Description=LimaHost Backup Service - VM Backup and Snapshot Management
   After=network.target limahost-agent.service
   Requires=limahost-agent.service

   [Service]
   Type=simple
   User=root
   ExecStart=/usr/bin/node /opt/limahost-backup/backup-service.js
   WorkingDirectory=/opt/limahost-backup
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production
   Environment=BACKUP_SERVICE_CONFIG=/etc/limahost/backup-config.json
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   EOF

   # Enable and start service
   sudo systemctl daemon-reload
   sudo systemctl enable limahost-backup
   sudo systemctl start limahost-backup
   ```

## Configuration

The backup service configuration is stored in `/etc/limahost/backup-config.json`. Here are the key configuration options:

### Storage Configuration

```json
{
  "storageBackend": "local", // local, s3, minio
  "storageConfig": {
    "local": {
      "basePath": "/backups/limahost"
    },
    "s3": {
      "bucket": "limahost-backups",
      "region": "us-east-1",
      "accessKeyId": "your-access-key",
      "secretAccessKey": "your-secret-key"
    },
    "minio": {
      "endPoint": "localhost:9000",
      "bucket": "limahost-backups",
      "accessKey": "your-access-key",
      "secretKey": "your-secret-key",
      "useSSL": false
    }
  }
}
```

### Backup Settings

```json
{
  "defaultCompression": "gzip", // none, gzip, brotli
  "defaultEncryption": "none", // none, aes256
  "compressionLevel": 6,
  "chunkSize": 67108864, // 64MB chunks
  "requireIntegrityCheck": true
}
```

### Retention Policies

```json
{
  "retention": {
    "daily": 7,
    "weekly": 4,
    "monthly": 12,
    "yearly": 3
  }
}
```

### Scheduling

```json
{
  "schedules": {
    "daily": "0 2 * * *",     // 2 AM daily
    "weekly": "0 3 * * 0",   // 3 AM Sunday
    "monthly": "0 4 1 * *"    // 4 AM 1st of month
  }
}
```

### Performance Settings

```json
{
  "maxConcurrentBackups": 3,
  "maxConcurrentRestores": 2,
  "timeout": 3600000, // 1 hour
  "healthCheckInterval": 300000, // 5 minutes
  "metricsInterval": 60000 // 1 minute
}
```

## Usage

### Command Line Options

```bash
# Start service with custom config
node backup-service.js --config /path/to/config.json

# Create backup for specific VM
node backup-service.js --create-backup --vm-name my-app

# Restore backup
node backup-service.js --restore-backup --backup-id backup-12345

# List all backups
node backup-service.js --list-backups

# Get service metrics
node backup-service.js --get-metrics

# Show help
node backup-service.js --help
```

### System Service Commands

```bash
# Start service
sudo systemctl start limahost-backup

# Stop service
sudo systemctl stop limahost-backup

# Restart service
sudo systemctl restart limahost-backup

# Check status
sudo systemctl status limahost-backup

# View logs
sudo journalctl -u limahost-backup -f

# Enable auto-start on boot
sudo systemctl enable limahost-backup

# Disable auto-start
sudo systemctl disable limahost-backup
```

### HTTP API

The backup service provides an HTTP API for management:

#### Create Backup

```bash
curl -X POST http://localhost:8081/backups \
  -H "Content-Type: application/json" \
  -d '{
    "vmName": "my-app",
    "type": "manual",
    "description": "Manual backup of my-app",
    "stopVm": true,
    "compression": "gzip",
    "encryption": "aes256"
  }'
```

#### List Backups

```bash
curl -s http://localhost:8081/backups
```

#### Get Specific Backup

```bash
curl -s http://localhost:8081/backups/backup-12345
```

#### Restore Backup

```bash
curl -X POST http://localhost:8081/backups/backup-12345/restore \
  -H "Content-Type: application/json" \
  -d '{
    "vmName": "my-app-restored"
  }'
```

#### Delete Backup

```bash
curl -X DELETE http://localhost:8081/backups/backup-12345
```

#### Get Metrics

```bash
curl -s http://localhost:8081/metrics
```

#### Get Service Status

```bash
curl -s http://localhost:8081/status
```

## Storage Backends

### Local Storage

```json
{
  "storageBackend": "local",
  "storageConfig": {
    "local": {
      "basePath": "/backups/limahost"
    }
  }
}
```

### AWS S3

```json
{
  "storageBackend": "s3",
  "storageConfig": {
    "s3": {
      "bucket": "limahost-backups",
      "region": "us-east-1",
      "accessKeyId": "your-access-key",
      "secretAccessKey": "your-secret-key"
    }
  }
}
```

### MinIO

```json
{
  "storageBackend": "minio",
  "storageConfig": {
    "minio": {
      "endPoint": "localhost:9000",
      "bucket": "limahost-backups",
      "accessKey": "your-access-key",
      "secretKey": "your-secret-key",
      "useSSL": false
    }
  }
}
```

## Backup Templates

Backup templates provide pre-configured backup settings for common scenarios:

### Quick Backup

```json
{
  "description": "Quick backup with minimal overhead",
  "compression": "none",
  "encryption": "none",
  "stopVm": false,
  "timeout": 1800000
}
```

### Full Backup

```json
{
  "description": "Full backup with compression and encryption",
  "compression": "gzip",
  "encryption": "aes256",
  "stopVm": true,
  "timeout": 7200000
}
```

### Incremental Backup

```json
{
  "description": "Incremental backup for large VMs",
  "compression": "gzip",
  "encryption": "none",
  "stopVm": false,
  "timeout": 3600000
}
```

## Security

### Encryption

The backup service supports AES-256 encryption for backup data:

```bash
# Set encryption key
export BACKUP_ENCRYPTION_KEY="your-32-character-encryption-key"

# Restart service
sudo systemctl restart limahost-backup
```

### Access Control

The backup service runs as root and should be protected by:

1. **Firewall Rules**: Restrict access to the HTTP API
2. **Authentication**: Implement API authentication in production
3. **Network Security**: Run on isolated networks
4. **File Permissions**: Secure configuration and backup files

### Audit Logging

All backup operations are logged with detailed information:

```bash
# View backup logs
sudo journalctl -u limahost-backup -f | grep backup

# View restore logs
sudo journalctl -u limahost-backup -f | grep restore
```

## Monitoring

### Health Checks

The service provides health endpoints:

```bash
# Basic health check
curl -s http://localhost:8081/health

# Detailed health check
curl -s http://localhost:8081/health/detailed
```

### Metrics

The service exposes various metrics:

```bash
# Get all metrics
curl -s http://localhost:8081/metrics

# Specific metric categories
curl -s http://localhost:8081/metrics/backups
curl -s http://localhost:8081/metrics/storage
curl -s http://localhost:8081/metrics/performance
```

### System Monitoring

Monitor system resources used by the backup service:

```bash
# Monitor CPU and memory
top -p $(pgrep -f limahost-backup)

# Monitor disk I/O
iotop -p $(pgrep -f limahost-backup)

# Monitor network activity
netstat -anp | grep :8081
```

## Troubleshooting

### Common Issues

**Service won't start**:
```bash
# Check service status
sudo systemctl status limahost-backup

# View logs for errors
sudo journalctl -u limahost-backup -n 100

# Check configuration
sudo node /opt/limahost-backup/backup-service.js --config /etc/limahost/backup-config.json --log-level debug
```

**Backups failing**:
```bash
# Check Lima VM status
limactl list

# Check disk space
df -h

# Check storage backend connectivity
# For S3: aws s3 ls s3://your-bucket
# For MinIO: mc ls local/your-bucket
```

**Storage issues**:
```bash
# Check local storage permissions
ls -la /backups/limahost

# Check S3 credentials
aws s3 ls s3://your-bucket

# Check MinIO connectivity
mc ls local/your-bucket
```

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Edit configuration
sudo nano /etc/limahost/backup-config.json

# Set log level to debug
{
  "logLevel": "debug"
}

# Restart service
sudo systemctl restart limahost-backup

# View debug logs
sudo journalctl -u limahost-backup -f
```

### Performance Issues

If backups are slow or using excessive resources:

1. **Check chunk size**: Reduce `chunkSize` in configuration
2. **Adjust concurrency**: Lower `maxConcurrentBackups`
3. **Monitor compression**: Try different compression levels
4. **Check storage backend**: Network storage may be slower
5. **Review VM size**: Large VMs take longer to backup

## Best Practices

### Backup Strategy

1. **3-2-1 Rule**: Keep 3 copies, 2 different media, 1 offsite
2. **Regular Testing**: Test restores regularly
3. **Monitor Backups**: Ensure backups complete successfully
4. **Document Procedures**: Maintain backup and restore documentation
5. **Review Retention**: Adjust retention policies based on needs

### Performance Optimization

1. **Schedule During Off-Peak**: Run backups during low usage periods
2. **Use Compression**: Reduce storage usage with compression
3. **Enable Encryption**: Protect sensitive data
4. **Monitor Resources**: Keep an eye on system resources
5. **Clean Up Regularly**: Remove old backups according to retention policies

### Security Best Practices

1. **Encrypt Backups**: Always encrypt sensitive data
2. **Secure Keys**: Protect encryption keys
3. **Limit Access**: Restrict access to backup service
4. **Audit Logs**: Regularly review backup logs
5. **Test Restores**: Ensure restore procedures work

## Uninstallation

### Automated Uninstall

```bash
# Run uninstall script
sudo npm run uninstall-service
```

### Manual Uninstall

```bash
# Stop and disable service
sudo systemctl stop limahost-backup
sudo systemctl disable limahost-backup

# Remove service files
sudo rm /etc/systemd/system/limahost-backup.service
sudo rm /etc/logrotate.d/limahost-backup
sudo rm /etc/tmpfiles.d/limahost-backup.conf

# Reload systemd
sudo systemctl daemon-reload

# Remove installation files
sudo rm -rf /opt/limahost-backup

# Remove configuration (optional)
sudo rm -rf /etc/limahost

# Remove logs (optional)
sudo rm -rf /var/log/limahost

# Remove data (optional - this deletes all backups!)
sudo rm -rf /var/lib/limahost/backups
```

## API Reference

### Endpoints

#### POST /backups
Create a new backup

**Request Body**:
```json
{
  "vmName": "string",
  "type": "manual|daily|weekly|monthly",
  "description": "string",
  "tags": ["string"],
  "stopVm": boolean,
  "compression": "none|gzip|brotli",
  "encryption": "none|aes256",
  "timeout": number
}
```

#### GET /backups
List all backups

**Query Parameters**:
- `vmName`: Filter by VM name
- `type`: Filter by backup type
- `status`: Filter by status
- `tags`: Filter by tags

#### GET /backups/{backupId}
Get specific backup details

#### POST /backups/{backupId}/restore
Restore a backup

**Request Body**:
```json
{
  "vmName": "string"
}
```

#### DELETE /backups/{backupId}
Delete a backup

#### GET /metrics
Get service metrics

#### GET /status
Get service status

#### GET /health
Health check endpoint

### Response Formats

#### Backup Response
```json
{
  "id": "backup-12345",
  "vmName": "my-app",
  "type": "manual",
  "description": "Manual backup",
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:35:00Z",
  "size": 2147483648,
  "compression": "gzip",
  "encryption": "aes256",
  "chunks": [
    {
      "id": "backup-12345-chunk-000000",
      "size": 67108864,
      "checksum": "sha256-hash"
    }
  ],
  "checksum": "sha256-hash",
  "integrityVerified": true
}
```

#### Metrics Response
```json
{
  "totalBackups": 150,
  "successfulBackups": 145,
  "failedBackups": 5,
  "totalRestores": 25,
  "successfulRestores": 24,
  "failedRestores": 1,
  "storageUsed": 53687091200,
  "lastBackupTime": "2024-01-15T10:35:00Z",
  "averageBackupTime": 300000,
  "averageBackupSize": 1073741824
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Setup

```bash
# Clone repository
git clone https://github.com/limahost/backup-service.git
cd backup-service

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

- **Documentation**: https://docs.limahost.com/backup-service
- **Issues**: https://github.com/limahost/backup-service/issues
- **Community**: https://community.limahost.com
- **Email**: support@limahost.com

## Changelog

### v1.0.0
- Initial release
- Automated backup scheduling
- Multiple storage backends (local, S3, MinIO)
- Compression and encryption support
- Chunked storage for large backups
- Integrity verification
- Restore functionality
- HTTP API for management
- Comprehensive metrics and monitoring
- Service installation scripts