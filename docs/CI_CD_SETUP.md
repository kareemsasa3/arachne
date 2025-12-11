# CI/CD Pipeline Setup

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline setup for the personal website project.

## Overview

The CI/CD pipeline consists of two main workflows:

1. **Continuous Integration (CI)** - Runs on pull requests and pushes to main/master
2. **Continuous Deployment (CD)** - Runs only on pushes to main/master

## Workflow Files

### `.github/workflows/build-publish.yml`
**Purpose**: Quality assurance and validation
**Triggers**: Pull requests and pushes to main/master branches

**Jobs**:
- **Lint & Test**: Runs linting and tests for all services (ai, scraper, web)
- **Build Images**: Builds Docker images for all services to verify they can be built
- **Security Scan**: Runs Trivy vulnerability scanner on the codebase

### `.github/workflows/deploy.yml`
**Purpose**: Automated deployment to production
**Triggers**: Only pushes to main/master branches

**Jobs**:
- **Build & Push Images**: Builds and pushes Docker images to GitHub Container Registry (GHCR)
- **Deploy to Production**: SSH into production server and deploys new images
- **Notify**: Provides deployment status notifications

## Setup Instructions

### 1. GitHub Repository Configuration

#### Enable GitHub Actions
1. Go to your GitHub repository
2. Navigate to Settings → Actions → General
3. Ensure "Allow all actions and reusable workflows" is selected
4. Save the changes

#### Configure GitHub Container Registry
1. Go to Settings → Packages
2. Ensure "Inherit access from source repository" is enabled
3. This allows the workflows to push images to GHCR

### 2. Production Server Secrets

You need to configure the following secrets in your GitHub repository:

1. Go to Settings → Secrets and variables → Actions
2. Add the following repository secrets:

```
PROD_HOST                # Your production server IP/hostname
PROD_USER                # SSH username for production server
PROD_SSH_KEY             # Private SSH key for production server access
PROD_PORT                # SSH port (usually 22)

# Frontend build-time secrets
VITE_TURNSTILE_SITE_KEY  # Cloudflare Turnstile site key for web build
VITE_AI_URL              # API base URL for web (e.g. https://your-domain.com/api/ai)

# Registry pull on production host (used during SSH deploy)
GHCR_USERNAME            # GHCR username (usually your GitHub username)
GHCR_TOKEN               # GHCR personal access token with read:packages
```

#### Generating SSH Key for Production Server

```bash
# Generate a new SSH key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Copy the public key to your production server
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@your-production-server

# The private key content goes into PROD_SSH_KEY secret
cat ~/.ssh/github_actions_deploy
```

### 3. Production Server Setup

#### Directory Structure
Ensure your production server has the following structure:
```
/opt/personal-website/
├── infrastructure/
│   ├── docker-compose.yml
│   └── prod/
│       └── docker-compose.prod.yml
└── .env (production environment variables)
```

#### Docker Compose Configuration
Update your production docker-compose files to use the GHCR images (already configured in `infrastructure/prod/docker-compose.prod.yml`):

**infrastructure/docker-compose.yml**:
```yaml
version: '3.8'
services:
  web:
    image: ${WEB_IMAGE:-ghcr.io/your-username/personal-website/web:latest}
    # ... other configuration

  web:
    image: ${ARACHNE_UI_IMAGE:-ghcr.io/your-username/personal-website/web:latest}
    # ... other configuration

  ai:
    image: ${AI_BACKEND_IMAGE:-ghcr.io/your-username/personal-website/ai:latest}
    # ... other configuration

  arachne:
    image: ${ARACHNE_IMAGE:-ghcr.io/your-username/personal-website/arachne:latest}
    # ... other configuration
```

### 4. Service-Specific Setup

#### Node.js Services (ai, web)
Ensure these services expose at least a `lint` script (and optionally a `test` script) so the CI workflow can run the same commands before building.

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "test": "jest"
  }
}
```

If you do not have real tests yet, a lightweight `test` script such as `echo "No tests specified"` keeps the workflow happy (the `web` submodule already ships with `lint` and can mirror this pattern).

#### Go Service (arachne)
The Go service uses standard Go tooling:
- `go vet ./...` for linting
- `go test ./...` for testing

## How It Works

### CI Workflow Process
1. **Trigger**: Pull request or push to main/master
2. **Lint & Test**: Parallel execution for each service
   - Install dependencies
   - Run linters
   - Run tests
3. **Build Images**: Verify all Docker images can be built
4. **Security Scan**: Run vulnerability scanner
5. **Result**: Pass/fail status for the PR

### CD Workflow Process
1. **Trigger**: Push to main/master (after CI passes)
2. **Build & Push**: 
   - Build Docker images
   - Tag with commit SHA
   - Push to GHCR
3. **Deploy**:
   - SSH to production server
   - Pull new images
   - Update docker-compose with new image tags
   - Restart services
   - Verify deployment
4. **Notify**: Report deployment status

## Image Tagging Strategy

Images are tagged with:
- **Commit SHA**: `ghcr.io/username/repo/service:abc123...`
- **Branch name**: `ghcr.io/username/repo/service:main`
- **Latest**: `ghcr.io/username/repo/service:latest` (only for main branch)

The deploy workflow does the same for `web` by exporting `ARACHNE_UI_IMAGE=ghcr.io/${{ github.repository }}/web:${{ github.event.workflow_run.head_sha }}`, so the production compose can pull the matching Next.js console image.

## Monitoring and Troubleshooting

### Viewing Workflow Runs
1. Go to your GitHub repository
2. Click on the "Actions" tab
3. Select the workflow you want to view
4. Click on a specific run to see detailed logs

### Common Issues

#### CI Failures
- **Lint errors**: Fix code style issues
- **Test failures**: Fix failing tests
- **Build failures**: Check Dockerfile syntax and dependencies

#### CD Failures
- **Authentication errors**: Check GHCR permissions and secrets
- **SSH connection failures**: Verify PROD_HOST, PROD_USER, PROD_SSH_KEY secrets
- **Deployment failures**: Check production server logs and docker-compose configuration

### Debugging Production Deployment
```bash
# SSH into production server
ssh user@your-production-server

# Check service status
cd /opt/personal-website
docker-compose -f infrastructure/docker-compose.yml -f infrastructure/prod/docker-compose.prod.yml ps

# View logs
docker-compose -f infrastructure/docker-compose.yml -f infrastructure/prod/docker-compose.prod.yml logs

# Check image tags
docker images | grep ghcr.io
```

## Security Considerations

1. **Secrets Management**: All sensitive data is stored in GitHub Secrets
2. **Image Scanning**: Trivy scans for vulnerabilities in dependencies
3. **SSH Keys**: Use dedicated SSH keys for CI/CD, not personal keys
4. **Registry Access**: GHCR access is scoped to the repository

## Rollback Strategy

To rollback to a previous version:
1. Find the commit SHA of the previous working version
2. Manually SSH into production server
3. Pull and deploy the specific image tag:
```bash
docker pull ghcr.io/username/repo/service:previous-commit-sha
export SERVICE_IMAGE=ghcr.io/username/repo/service:previous-commit-sha
docker-compose -f infrastructure/docker-compose.yml -f infrastructure/prod/docker-compose.prod.yml up -d
```

## Future Enhancements

1. **Staging Environment**: Add a staging deployment for testing
2. **Blue-Green Deployment**: Implement zero-downtime deployments
3. **Monitoring Integration**: Add health checks and monitoring
4. **Slack/Discord Notifications**: Add deployment notifications to chat platforms
5. **Database Migrations**: Add automated database migration handling

## Support

For issues with the CI/CD pipeline:
1. Check the GitHub Actions logs first
2. Verify all secrets are configured correctly
3. Test SSH connectivity manually
4. Review production server logs 