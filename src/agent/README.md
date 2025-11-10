# LimaHost Agent

The LimaHost Agent is a lightweight service that runs on host machines and manages Lima VMs for the secure app hosting platform. It handles VM lifecycle operations, monitoring, and communication with the control plane.

## Features

- **VM Lifecycle Management**: Create, start, stop, restart, and delete Lima VMs
- **Health Monitoring**: Real-time monitoring of VM status and system resources
- **Secure Communication**: Encrypted communication with the control plane
- **Resource Management**: Track and manage CPU, memory, and disk usage
- **Command Execution**: Execute commands inside VMs securely
- **Backup & Restore**: Automated backup and snapshot capabilities
- **Log Aggregation**: Collect and forward logs from VMs
- **Metrics Collection**: Gather performance metrics for monitoring

## Requirements

- Linux operating system
- Node.js 16 or higher
- Lima VM manager
- Docker/containerd (optional, for container-based workloads)
- Root privileges for installation

## Installation

### Quick Install

```bash
# Clone the repository
git clone https://github.com/limahost/agent.git
cd agent

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
   
   # Install Docker (optional)
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. **Install Agent**:
   ```bash
   # Copy agent files
   sudo mkdir -p /opt/limahost-agent
   sudo cp agent.js package.json /opt/limahost-agent/
   cd /opt/limahost-agent
   
   # Install dependencies
   sudo npm install --production
   
   # Create configuration
   sudo mkdir -p /etc/limahost
   sudo cp config.template.json /etc/limahost/agent.json
   
   # Edit configuration with your settings
   sudo nano /etc/limahost/agent.json
   ```

3. **Install as Service**:
   ```bash
   # Create systemd service
   sudo tee /etc/systemd/system/limahost-agent.service > /dev/null <<EOF
   [Unit]
   Description=LimaHost Agent - VM Orchestration Service
   After=network.target docker.service
   Requires=docker.service

   [Service]
   Type=simple
   User=root
   ExecStart=/usr/bin/node /opt/limahost-agent/agent.js
   WorkingDirectory=/opt/limahost-agent
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production
   Environment=LIMA_AGENT_CONFIG=/etc/limahost/agent.json
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   EOF

   # Enable and start service
   sudo systemctl daemon-reload
   sudo systemctl enable limahost-agent
   sudo systemctl start limahost-agent
   ```

## Configuration

The agent configuration is stored in `/etc/limahost/agent.json`. Here are the key configuration options:

### Required Settings

```json
{
  "controlPlaneUrl": "https://api.limahost.com",
  "controlPlaneApiKey": "your-api-key-here"
}
```

### Optional Settings

```json
{
  "agentId": "agent-001",
  "agentName": "production-server-1",
  "heartbeatInterval": 30000,
  "metricsInterval": 10000,
  "vmDataDir": "~/.lima",
  "maxConcurrentOperations": 3,
  "logLevel": "info",
  "logFile": "/var/log/limahost-agent.log"
}
```

### Security Settings

```json
{
  "security": {
    "allowedControlPlaneIps": ["192.168.1.100"],
    "maxCommandTimeout": 300000,
    "requireCommandApproval": false,
    "allowedVmTemplates": ["webapp", "api", "database", "dev"]
  }
}
```

### Resource Limits

```json
{
  "resourceLimits": {
    "maxVmsPerAgent": 10,
    "maxCpuPerVm": 8,
    "maxMemoryPerVm": 16,
    "maxDiskPerVm": 100,
    "maxTotalCpu": 32,
    "maxTotalMemory": 64,
    "maxTotalDisk": 500
  }
}
```

## Usage

### Command Line Options

```bash
# Start agent with custom config
node agent.js --config /path/to/config.json

# Override specific settings
node agent.js --control-plane https://api.example.com --api-key your-key

# Show help
node agent.js --help
```

### System Service Commands

```bash
# Start service
sudo systemctl start limahost-agent

# Stop service
sudo systemctl stop limahost-agent

# Restart service
sudo systemctl restart limahost-agent

# Check status
sudo systemctl status limahost-agent

# View logs
sudo journalctl -u limahost-agent -f

# Enable auto-start on boot
sudo systemctl enable limahost-agent

# Disable auto-start
sudo systemctl disable limahost-agent
```

### Development Mode

```bash
# Install development dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## API Reference

The agent communicates with the control plane via WebSocket and HTTP APIs. Here are the main message types:

### VM Operations

- **Create VM**: `{ type: "create_vm", vmName: "my-app", template: "webapp", config: {...} }`
- **Start VM**: `{ type: "start_vm", vmName: "my-app" }`
- **Stop VM**: `{ type: "stop_vm", vmName: "my-app" }`
- **Restart VM**: `{ type: "restart_vm", vmName: "my-app" }`
- **Delete VM**: `{ type: "delete_vm", vmName: "my-app" }`

### Command Execution

- **Execute Command**: `{ type: "execute_command", vmName: "my-app", command: "ls -la", timeout: 30000 }`

### Information Requests

- **Get VM Info**: `{ type: "get_vm_info", vmName: "my-app" }`
- **List VMs**: `{ type: "list_vms" }`
- **Backup VM**: `{ type: "backup_vm", vmName: "my-app", backupPath: "/backups/my-app.tar.gz" }`

## Monitoring

### Health Checks

The agent performs regular health checks and reports status to the control plane:

- **System Health**: CPU, memory, disk usage
- **VM Health**: Status of all managed VMs
- **Service Health**: Agent process health
- **Network Health**: Connectivity to control plane

### Metrics

The agent collects and forwards the following metrics:

- **System Metrics**: CPU usage, memory usage, disk usage, network I/O
- **VM Metrics**: Per-VM resource usage and status
- **Operation Metrics**: Operation success rates and durations
- **Application Metrics**: Custom metrics from applications running in VMs

### Logging

The agent maintains detailed logs for troubleshooting:

- **System Logs**: `/var/log/limahost/agent.log`
- **Journal Logs**: Accessible via `journalctl -u limahost-agent`
- **VM Logs**: Collected from individual VMs
- **Operation Logs**: Detailed operation tracking

## Security

### Authentication

- **API Key Authentication**: All communications require a valid API key
- **IP Whitelisting**: Optional IP-based access control
- **Certificate Validation**: HTTPS/TLS certificate validation

### Command Execution Security

- **Command Whitelisting**: Only allowed commands can be executed
- **Timeout Protection**: Commands have maximum execution time
- **Resource Limits**: Per-command resource limits
- **Sandboxing**: Commands run in isolated environments

### Data Protection

- **Encrypted Communication**: All traffic encrypted with TLS
- **Secure Storage**: Sensitive data encrypted at rest
- **Audit Logging**: All operations logged for audit purposes

## Troubleshooting

### Common Issues

**Service won't start**:
```bash
# Check service status
sudo systemctl status limahost-agent

# View logs for errors
sudo journalctl -u limahost-agent -n 100

# Check configuration
sudo node /opt/limahost-agent/agent.js --config /etc/limahost/agent.json --log-level debug
```

**VM operations failing**:
```bash
# Check Lima installation
limactl --version

# Check Lima VM status
limactl list

# Check Docker status (if using containers)
sudo systemctl status docker
```

**Communication issues**:
```bash
# Test connectivity to control plane
curl -H "Authorization: Bearer your-api-key" https://api.limahost.com/health

# Check firewall rules
sudo ufw status
```

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Edit configuration
sudo nano /etc/limahost/agent.json

# Set log level to debug
{
  "logLevel": "debug"
}

# Restart service
sudo systemctl restart limahost-agent

# View debug logs
sudo journalctl -u limahost-agent -f
```

### Performance Issues

If the agent is using excessive resources:

1. **Check resource limits** in configuration
2. **Monitor VM count** and ensure it's within limits
3. **Review operation concurrency** settings
4. **Check for stuck operations** in logs

## Uninstallation

### Automated Uninstall

```bash
# Run uninstall script
sudo npm run uninstall-service
```

### Manual Uninstall

```bash
# Stop and disable service
sudo systemctl stop limahost-agent
sudo systemctl disable limahost-agent

# Remove service files
sudo rm /etc/systemd/system/limahost-agent.service
sudo rm /etc/logrotate.d/limahost-agent

# Reload systemd
sudo systemctl daemon-reload

# Remove installation files
sudo rm -rf /opt/limahost-agent
sudo rm -rf /etc/limahost
sudo rm -rf /var/log/limahost
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
git clone https://github.com/limahost/agent.git
cd agent

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

- **Documentation**: https://docs.limahost.com/agent
- **Issues**: https://github.com/limahost/agent/issues
- **Community**: https://community.limahost.com
- **Email**: support@limahost.com

## Changelog

### v1.0.0
- Initial release
- VM lifecycle management
- Health monitoring
- Secure communication
- Backup and restore
- Metrics collection
- Log aggregation