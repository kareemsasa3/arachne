# Environment Configuration Guide

This document explains how to set up and manage environment variables for the arachne project.

## Overview

The arachne uses a centralized environment variable system to manage configuration across all services. This includes:

- **Domain configuration** for SSL certificates and routing
- **API keys** for external services (Google Gemini AI)
- **Service configuration** for ports, memory limits, and other settings
- **Development vs Production** environment overrides

## Quick Setup

### 1. Automated Setup (Recommended)

Run the interactive setup script:

```bash
cd infrastructure
./setup-env.sh
```

This script will:
- Create a `.env` file from the template
- Prompt for your domain name and email
- Ask for your Gemini API key
- Allow customization of resource limits
- Provide next steps for deployment

### 2. Manual Setup

To fetch Grafana dashboards locally:
```bash
cd infrastructure
./fetch-grafana-dashboards.sh
```

If you prefer manual setup:

```bash
cd infrastructure
cp env.example .env
# Edit .env with your configuration
nano .env
```

## Environment Variables Reference

### Domain Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DOMAIN_NAME` | Your primary domain name | `your-domain.com` | Yes |
| `SSL_EMAIL` | Email for SSL certificate notifications | `your-email@example.com` | Yes |

### AI Backend Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for AI chat | - | Yes for AI features |
| `SESSION_TOKEN_SECRET` | Secret for signing chat session tokens | - | Yes in production |
| `TURNSTILE_SECRET` | Cloudflare Turnstile secret key | - | Yes if using Turnstile |
| `TURNSTILE_REQUIRED` | Require Turnstile in production (set `false` to bypass) | `false` | No |
| `AI_BACKEND_REDIS_URL` | Redis URL for per-IP daily quotas | `redis://redis:6379/0` | Recommended |
| `AI_BACKEND_PORT` | Port for AI backend service | `3001` | No |
| `AI_BACKEND_NODE_ENV` | Node.js environment | `production` | No |
| `AI_BACKEND_LOG_LEVEL` | Logging level | `info` | No |
| `AI_BACKEND_ENABLE_METRICS` | Enable metrics collection | `true` | No |
| `AI_BACKEND_RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `900000` | No |
| `AI_BACKEND_RATE_LIMIT_MAX_REQUESTS` | Maximum requests per window | `100` | No |

### Arachne Scraper Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ARACHNE_REDIS_ADDR` | Redis server address | `redis:6379` | No |
| `ARACHNE_REDIS_DB` | Redis database number | `0` | No |
| `ARACHNE_ENABLE_METRICS` | Enable metrics collection | `true` | No |
| `ARACHNE_ENABLE_LOGGING` | Enable logging | `true` | No |
| `ARACHNE_LOG_LEVEL` | Logging level | `info` | No |
| `ARACHNE_MAX_CONCURRENT` | Maximum concurrent scraping jobs | `10` | No |
| `ARACHNE_REQUEST_TIMEOUT` | Request timeout | `120s` | No |
| `ARACHNE_TOTAL_TIMEOUT` | Total timeout for scraping | `180s` | No |
| `ARACHNE_USE_HEADLESS` | Use headless browser | `true` | No |
| `ARACHNE_USER_AGENT` | User agent string | `Mozilla/5.0...` | No |
| `ARACHNE_RATE_LIMIT` | Rate limit per window | `2` | No |
| `ARACHNE_RATE_LIMIT_WINDOW` | Rate limit window | `1s` | No |

### Development Overrides

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ARACHNE_DEV_LOG_LEVEL` | Development log level | `debug` | No |
| `ARACHNE_DEV_MAX_CONCURRENT` | Development concurrent jobs | `3` | No |
| `ARACHNE_DEV_REQUEST_TIMEOUT` | Development request timeout | `60s` | No |
| `ARACHNE_DEV_TOTAL_TIMEOUT` | Development total timeout | `90s` | No |

### Redis Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_PORT` | Redis server port | `6379` | No |
| `REDIS_MAX_MEMORY` | Maximum memory usage | `512mb` | No |
| `REDIS_MAX_MEMORY_POLICY` | Memory eviction policy | `allkeys-lru` | No |
| `REDIS_COMMANDER_ENABLED` | Enable Redis Commander UI | `true` | No |
| `REDIS_COMMANDER_PORT` | Redis Commander port | `8081` | No |

### Web Frontend Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_AI_URL` | API base URL used by the web UI | `https://your-domain.com/api/ai` | No |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public) | - | Yes if using Turnstile |
| `TURNSTILE_SECRET` | Cloudflare Turnstile secret key | - | Yes if using Turnstile |
| `TURNSTILE_REQUIRED` | Require Turnstile for chats | `false` | No |

### Nginx Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NGINX_HTTP_PORT` | HTTP port | `80` | No |
| `NGINX_HTTPS_PORT` | HTTPS port | `443` | No |
| `SSL_CERT_PATH` | SSL certificate path | `/etc/nginx/ssl/cert.pem` | No |
| `SSL_KEY_PATH` | SSL private key path | `/etc/nginx/ssl/key.pem` | No |

### Docker Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DOCKER_NETWORK_NAME` | Docker network name | `arachne-network` | No |
| `DOCKER_NETWORK_SUBNET` | Docker network subnet | `172.20.0.0/16` | No |

### Resource Limits

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NGINX_MEMORY_LIMIT` | Nginx memory limit | `256M` | No |
| `NGINX_CPU_LIMIT` | Nginx CPU limit | `0.5` | No |
| `WEB_MEMORY_LIMIT` | Web memory limit | `512M` | No |
| `WEB_CPU_LIMIT` | Web CPU limit | `1.0` | No |
| `AI_MEMORY_LIMIT` | AI backend memory limit | `1G` | No |
| `AI_CPU_LIMIT` | AI backend CPU limit | `1.0` | No |
| `SCRAPER_MEMORY_LIMIT` | Scraper memory limit | `2G` | No |
| `SCRAPER_CPU_LIMIT` | Scraper CPU limit | `1.0` | No |
| `REDIS_MEMORY_LIMIT` | Redis memory limit | `1G` | No |
| `REDIS_CPU_LIMIT` | Redis CPU limit | `1.0` | No |

### Development Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DEV_NODE_ENV` | Development Node.js environment | `development` | No |
| `DEV_AI_PORT` | Development AI port | `3001` | No |
| `DEV_SCRAPER_PORT` | Development scraper port | `8080` | No |

### Logging Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LOG_MAX_SIZE` | Maximum log file size | `10m` | No |
| `LOG_MAX_FILES` | Maximum number of log files | `3` | No |

### Security Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CORS_ALLOW_ORIGIN` | CORS allowed origin | `*` | No |
| `CORS_ALLOW_METHODS` | CORS allowed methods | `GET, POST, OPTIONS` | No |
| `CORS_ALLOW_HEADERS` | CORS allowed headers | `DNT,User-Agent...` | No |
| `API_RATE_LIMIT_BURST` | API rate limit burst | `20` | No |
| `SCRAPER_RATE_LIMIT_BURST` | Scraper rate limit burst | `10` | No |

## Environment-Specific Configuration

### Development Environment

For development, the following variables are automatically overridden:

- `NODE_ENV=development`
- Lower resource limits
- Debug logging
- Local URLs instead of domain names

### Production Environment

For production, ensure you have:

1. **Valid domain name** in `DOMAIN_NAME`
2. **Valid email** in `SSL_EMAIL`
3. **Gemini API key** in `GEMINI_API_KEY`
4. **Appropriate resource limits** for your server

## Usage Examples

### Starting Services

**Development:**
```bash
cd infrastructure
docker-compose -f dev/docker-compose.dev.yml up -d
```

**Production:**
```bash
cd infrastructure
docker-compose -f prod/docker-compose.prod.yml up -d
```

### SSL Certificate Setup

```bash
cd infrastructure
docker-compose -f prod/docker-compose.prod.yml --profile ssl-setup up certbot
```

### Checking Configuration

```bash
# Validate environment variables
cd infrastructure
docker-compose -f docker-compose.yml config

# Check specific service configuration
docker-compose -f prod/docker-compose.prod.yml config nginx
```

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, unique API keys** for external services
3. **Regularly rotate secrets** and API keys
4. **Use environment-specific configurations** for dev/staging/prod
5. **Limit resource usage** to prevent abuse
6. **Enable rate limiting** for API endpoints

## Troubleshooting

### Common Issues

1. **Missing API Key**: AI chat won't work without `GEMINI_API_KEY`
2. **Invalid Domain**: SSL certificates won't work with invalid domain
3. **Port Conflicts**: Change port variables if services conflict
4. **Memory Issues**: Adjust resource limits based on your server capacity

### Validation Commands

```bash
# Check if .env file exists
ls -la infrastructure/.env

# Validate docker-compose configuration
cd infrastructure
docker-compose -f docker-compose.yml config

# Test environment variable substitution
cd infrastructure
docker-compose -f docker-compose.yml config | grep -E "\$\{.*\}"
```

## Migration from Hardcoded Values

If you're migrating from hardcoded configuration:

1. **Backup your current configuration**
2. **Run the setup script** to create `.env`
3. **Copy your existing values** to the new variables
4. **Test the configuration** before deploying
5. **Update your deployment scripts** to use the new variables

## Support

For issues with environment configuration:

1. Check the troubleshooting section above
2. Validate your `.env` file syntax
3. Ensure all required variables are set
4. Check Docker Compose logs for specific errors 