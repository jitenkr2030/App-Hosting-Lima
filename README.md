# 🚀 LimaHost - Enterprise-Grade Application Hosting Platform

<div align="center">

![LimaHost Logo](https://img.shields.io/badge/LimaHost-Enterprise%20Hosting-blue?style=for-the-badge&logo=server&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-purple?style=for-the-badge)

**Deploy Applications with Lima VM Power - Enterprise-Grade Application Hosting Platform**

[🌐 Landing Page](#-landing-page) • [📖 Documentation](#-documentation) • [🚀 Getting Started](#-getting-started) • [🔧 Features](#-features) • [💻 Demo](#-demo-credentials)

</div>

---

## 📋 Table of Contents

- [🎯 About](#-about)
- [✨ Key Features](#-key-features)
- [🚀 Getting Started](#-getting-started)
- [🏗️ Architecture](#-architecture)
- [🔧 Features Overview](#-features-overview)
- [💻 Demo](#-demo-credentials)
- [📚 API Documentation](#-api-documentation)
- [🛠️ Development](#-development)
- [🧪 Testing](#-testing)
- [📦 Deployment](#-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🎯 About

LimaHost is a comprehensive enterprise-grade application hosting platform that leverages Lima VM technology to provide seamless, secure, and scalable application deployment solutions. Built with modern technologies and designed for developers, LimaHost offers a complete suite of tools for managing applications, from development to production.

### 🎨 Design Philosophy

- **Developer-First**: Built by developers, for developers
- **Enterprise-Ready**: Security, compliance, and scalability at its core
- **Cloud-Native**: Leveraging modern containerization and orchestration
- **User-Friendly**: Intuitive interface with powerful features

---

## ✨ Key Features

### 🏗️ Core Platform
- **Lima VM Integration**: Seamless virtual machine management
- **Multi-Template Support**: Pre-configured templates for various app types
- **Real-time Monitoring**: Live metrics, logs, and performance tracking
- **Automated Backups**: Scheduled backups with one-click restore
- **Custom Domains & HTTPS**: Automatic SSL certificate management

### 🔒 Security & Authentication
- **Role-Based Access Control (RBAC)**: Three-tier permission system
- **JWT Authentication**: Secure token-based authentication
- **Audit Logs**: Comprehensive activity tracking and compliance
- **Session Management**: Secure session handling with expiration

### 💰 Billing & Usage
- **Usage Metering**: Real-time resource usage tracking
- **Subscription Management**: Flexible pricing plans
- **Cost Optimization**: Resource usage insights and recommendations
- **Automated Billing**: Stripe integration for payment processing

### 🚀 Deployment & Management
- **One-Click Deployments**: Streamlined deployment process
- **Environment Management**: Development, staging, and production environments
- **Scaling**: Auto-scaling and resource management
- **Health Checks**: Automated health monitoring and alerts

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher
- **TypeScript**: Version 5.x or higher
- **Prisma**: ORM for database management
- **SQLite**: Database (development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/limahost.git
   cd limahost
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Push database schema
   npx prisma db push
   ```

5. **Seed demo data (optional)**
   ```bash
   npm run seed:demo
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000) in your browser
   - Use demo credentials to test the platform

### Quick Start Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npm run db:push      # Push schema changes
npm run db:generate  # Generate Prisma client
npm run db:reset     # Reset database

# Demo Data
npm run seed:demo    # Seed demo data
```

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Next.js)     │◄──►│   (API)         │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ - Dashboard     │    │ - Auth Service  │    │ - Users         │
│ - Landing Page  │    │ - App Management│    │ - Apps          │
│ - UI Components│    │ - Billing       │    │ - Audit Logs    │
│                 │    │ - Usage Tracking│    │ - Sessions      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                │
                    ┌─────────────────┐
                    │   External      │
                    │   Services      │
                    │                 │
                    │ - Lima VM       │
                    │ - Stripe        │
                    │ - Email         │
                    │ - Monitoring    │
                    └─────────────────┘
```

### Technology Stack

#### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Modern UI component library
- **Radix UI**: Headless UI components
- **Framer Motion**: Animation library
- **Zustand**: State management
- **TanStack Query**: Server state management

#### Backend
- **Next.js API Routes**: Serverless API endpoints
- **Prisma**: Modern database toolkit
- **SQLite**: Database (development)
- **bcryptjs**: Password hashing
- **jsonwebtoken**: JWT authentication
- **Zod**: Schema validation

#### Infrastructure
- **Lima**: Virtual machine management
- **Docker**: Containerization
- **Socket.io**: Real-time communication
- **Stripe**: Payment processing

---

## 🔧 Features Overview

### 1. Authentication & RBAC System ✅

**Multi-tier security with comprehensive access control**

- **User Authentication**: JWT-based secure authentication
- **Role Management**: USER, ADMIN, SUPER_ADMIN roles
- **Permission System**: Granular access control
- **Session Management**: Secure token handling
- **Password Security**: bcrypt hashing with salt rounds

**API Endpoints:**
```
POST /api/auth/register    # User registration
POST /api/auth/login       # User login
POST /api/auth/logout      # User logout
GET  /api/auth/me         # Current user profile
```

### 2. Billing & Usage Metering System ✅

**Comprehensive billing and resource tracking**

- **Subscription Plans**: FREE, BASIC, PRO, ENTERPRISE
- **Usage Tracking**: Real-time resource monitoring
- **Cost Analysis**: Usage insights and optimization
- **Payment Processing**: Stripe integration
- **Invoicing**: Automated billing and invoices

**Features:**
- Resource limits enforcement
- Usage reports and analytics
- Plan upgrade/downgrade
- Proration calculations
- Tax support

**API Endpoints:**
```
GET  /api/billing          # Get billing info
PUT  /api/billing          # Update billing
POST /api/usage            # Record usage
GET  /api/usage            # Get usage data
```

### 3. Audit Logs & Activity Trails ✅

**Complete audit trail for compliance and security**

- **Activity Tracking**: All user actions logged
- **IP Tracking**: Source IP address logging
- **User Agent**: Browser and device information
- **Compliance Ready**: SOC 2, GDPR compliant
- **Search & Filter**: Advanced log querying

**Logged Actions:**
- User registration/login/logout
- App creation/deletion/deployment
- Backup/snapshot operations
- Billing changes
- Admin actions

**API Endpoints:**
```
GET /api/audit-logs       # Get audit logs
```

### 4. Application Management ✅

**Complete application lifecycle management**

- **App Creation**: Template-based app setup
- **Deployment Management**: Version control and rollbacks
- **Environment Management**: Dev/staging/prod environments
- **Resource Management**: CPU, memory, storage allocation
- **Domain Management**: Custom domains and HTTPS

**Templates Available:**
- Web Application (React, Vue, Angular)
- API Service (Node.js, Python, Go)
- Database (PostgreSQL, MySQL, MongoDB)
- Development Environment (Ubuntu, Docker)

### 5. Backup & Snapshot System ✅

**Reliable data protection and recovery**

- **Automated Backups**: Scheduled backup creation
- **Snapshot Management**: Point-in-time snapshots
- **One-Click Restore**: Easy recovery process
- **Storage Management**: Backup retention policies
- **Encryption**: Secure backup storage

### 6. Networking & Security ✅

**Enterprise-grade networking and security**

- **Custom Domains**: Bring your own domain
- **SSL Certificates**: Automatic HTTPS provisioning
- **Firewall Management**: Network security rules
- **Load Balancing**: Traffic distribution
- **DDoS Protection**: Attack mitigation

---

## 💻 Demo

### Demo Credentials

The platform comes pre-seeded with demo data for testing:

| Role | Email | Password | Token |
|------|-------|----------|-------|
| **Super Admin** | admin@limahost.com | admin123 | demo-token-admin |
| **Regular User** | john@example.com | john123 | demo-token-john |
| **Admin User** | sarah@techstart.com | sarah123 | demo-token-sarah |

### Demo Applications

The demo includes 4 sample applications:

1. **Web App Production** - Nginx web server
2. **API Service** - Node.js REST API
3. **Database Server** - PostgreSQL database
4. **Development Environment** - Ubuntu development VM

### Testing the Platform

1. **Navigate to the application**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

2. **Choose your experience**
   - Click "View Landing Page" for marketing site
   - Click "Continue to Dashboard" for platform interface

3. **Test authentication**
   - Use demo credentials to log in
   - Test different user roles and permissions

4. **Explore features**
   - Create new applications
   - View audit logs
   - Check billing information
   - Monitor usage metrics

---

## 📚 API Documentation

### Authentication

All API endpoints require authentication using Bearer tokens:

```bash
curl -H "Authorization: Bearer demo-token-admin" \
     http://localhost:3000/api/auth/me
```

### Core Endpoints

#### Authentication
```typescript
// Register new user
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}

// Login user
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

// Get current user
GET /api/auth/me
Headers: { "Authorization": "Bearer <token>" }
```

#### Applications
```typescript
// List applications
GET /api/apps

// Create application
POST /api/apps
{
  "name": "My App",
  "description": "App description",
  "template": "webapp",
  "domain": "app.example.com",
  "config": {...}
}

// Get application details
GET /api/apps/[id]

// Update application
PUT /api/apps/[id]

// Delete application
DELETE /api/apps/[id]
```

#### Billing
```typescript
// Get billing information
GET /api/billing

// Update billing
PUT /api/billing
{
  "plan": "PRO",
  "billingCycle": "MONTHLY"
}
```

#### Usage
```typescript
// Record usage
POST /api/usage
{
  "metric": "cpu_cores",
  "value": 2,
  "unit": "cores"
}

// Get usage data
GET /api/usage?summary=true
```

#### Audit Logs
```typescript
// Get audit logs
GET /api/audit-logs?page=1&limit=20&userId=xyz
```

### Error Handling

All API endpoints return consistent error responses:

```typescript
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {} // Optional error details
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

---

## 🛠️ Development

### Project Structure

```
limahost/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── apps/          # Application management
│   │   │   ├── billing/       # Billing endpoints
│   │   │   ├── usage/         # Usage tracking
│   │   │   └── audit-logs/    # Audit logs
│   │   ├── dashboard/         # Dashboard page
│   │   ├── landing/          # Landing page
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── create-app-dialog.tsx
│   │   └── app-detail-view.tsx
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility libraries
│   │   ├── auth.ts           # Authentication utilities
│   │   ├── audit.ts          # Audit logging
│   │   ├── billing.ts        # Billing system
│   │   ├── db.ts             # Database client
│   │   ├── middleware.ts     # Auth middleware
│   │   └── utils.ts          # General utilities
│   └── styles/                # CSS files
├── prisma/                    # Database schema
├── scripts/                   # Utility scripts
├── public/                    # Static assets
├── lima-templates/            # Lima VM templates
└── package.json
```

### Development Workflow

1. **Feature Development**
   ```bash
   # Create feature branch
   git checkout -b feature/new-feature
   
   # Make changes
   # Run tests
   npm run test
   
   # Lint code
   npm run lint
   
   # Commit changes
   git commit -m "feat: add new feature"
   ```

2. **Database Changes**
   ```bash
   # Update schema
   # Edit prisma/schema.prisma
   
   # Push changes
   npx prisma db push
   
   # Generate client
   npx prisma generate
   ```

3. **Testing**
   ```bash
   # Run all tests
   npm test
   
   # Run specific test
   npm test -- auth.test.ts
   
   # Watch mode
   npm run test:watch
   ```

### Code Style

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with Next.js rules
- **Prettier**: Code formatting (configured)
- **Conventional Commits**: Commit message format

### Environment Variables

```bash
# Database
DATABASE_URL="file:./dev.db"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"

# Stripe (for payments)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (for notifications)
EMAIL_FROM="noreply@limahost.com"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-password"

# External Services
LIMA_VM_PATH="/path/to/lima/vms"
MONITORING_SERVICE_URL="https://monitoring.example.com"
```

---

## 🧪 Testing

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── auth.test.ts
│   ├── billing.test.ts
│   └── utils.test.ts
├── integration/             # Integration tests
│   ├── api.test.ts
│   └── database.test.ts
├── e2e/                     # End-to-end tests
│   ├── auth.spec.ts
│   ├── apps.spec.ts
│   └── billing.spec.ts
└── fixtures/               # Test data
    └── demo-data.ts
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Commands

```bash
# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test auth.test.ts

# Run tests matching pattern
npm test -- --grep "auth"
```

---

## 📦 Deployment

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Environment Setup

#### Production Environment Variables

```bash
# Production database
DATABASE_URL="postgresql://user:pass@prod-db:5432/limahost"

# Production secrets
JWT_SECRET="your-production-jwt-secret"
NEXTAUTH_SECRET="your-nextauth-secret"

# Production services
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Monitoring and logging
LOG_LEVEL="info"
SENTRY_DSN="your-sentry-dsn"
```

### Deployment Options

#### 1. Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t limahost .
docker run -p 3000:3000 limahost
```

#### 2. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/limahost
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: limahost
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

#### 3. Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: limahost
spec:
  replicas: 3
  selector:
    matchLabels:
      app: limahost
  template:
    metadata:
      labels:
        app: limahost
    spec:
      containers:
      - name: limahost
        image: limahost:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: limahost-secrets
              key: database-url
```

### CI/CD Pipeline

#### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy LimaHost

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18
    - run: npm ci
    - run: npm test
    - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to Production
      run: |
        # Add deployment commands here
        echo "Deploying to production..."
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/limahost.git
   cd limahost
   ```

3. **Set up upstream remote**
   ```bash
   git remote add upstream https://github.com/original-username/limahost.git
   ```

4. **Create feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

5. **Make changes and test**
   ```bash
   npm install
   npm run dev
   npm test
   ```

6. **Commit changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

7. **Push to fork**
   ```bash
   git push origin feature/amazing-feature
   ```

8. **Create Pull Request**

### Coding Standards

- **TypeScript**: Use strict mode and proper typing
- **ESLint**: Follow the configured linting rules
- **Prettier**: Format code with Prettier
- **Conventional Commits**: Use conventional commit format
- **Testing**: Write tests for new features
- **Documentation**: Update documentation for changes

### Pull Request Process

1. **Update tests** if applicable
2. **Update documentation** if needed
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** for significant changes
5. **Your PR will be reviewed** and merged if approved

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

- **Next.js**: MIT License
- **React**: MIT License
- **TypeScript**: Apache License 2.0
- **Tailwind CSS**: MIT License
- **Prisma**: Apache License 2.0
- **shadcn/ui**: MIT License

---

## 🙏 Acknowledgments

- **Lima Project**: For the amazing virtual machine technology
- **Next.js Team**: For the excellent React framework
- **Prisma Team**: For the modern database toolkit
- **shadcn/ui**: For the beautiful UI components
- **Contributors**: Everyone who has contributed to this project

---

## 📞 Support

### Getting Help

- **Documentation**: Check our comprehensive documentation
- **Issues**: Report bugs or request features on GitHub
- **Discussions**: Join our community discussions
- **Email**: support@limahost.com

### Community

- **GitHub**: [github.com/limahost/limahost](https://github.com/limahost/limahost)
- **Discord**: Join our Discord community
- **Twitter**: Follow us for updates
- **Blog**: Read our latest posts

### Enterprise Support

For enterprise support, custom features, or SLA guarantees, please contact us at enterprise@limahost.com.

---

<div align="center">

**Made with ❤️ by the LimaHost Team**

[⭐ Star us on GitHub](https://github.com/limahost/limahost) • [🐛 Report Issues](https://github.com/limahost/limahost/issues) • [📧 Contact Us](mailto:hello@limahost.com)

</div>