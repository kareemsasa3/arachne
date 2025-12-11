# Arachne - Autonomous Web Research Platform

An autonomous research platform that searches, scrapes, indexes, and synthesizes web content using AI. Arachne continuously detects changes, keeps version history, and offers full-text search (FTS5) across collected documents.

## 🏗️ Architecture

### Folder Structure
```
arachne/
├── services/
│   ├── ai/                      # AI microservice (git submodule - nexus)
│   ├── scraper/                 # Standalone scraping engine (git submodule)
│   └── web/                     # Next.js Arachne web interface (in repo)
├── infrastructure/              # Deployment & infrastructure (nginx, compose, scripts)
└── README.md
```

### Services
This setup orchestrates the following services:

- **Nginx** - Reverse proxy and TLS termination
- **AI** - AI microservice (Node.js)
- **Web** - Arachne Web Interface (Next.js)
- **Scraper** - Web scraping service (Go)
- **Redis** - Job storage and coordination
- **Redis Commander** - Optional Redis management UI

## 🤔 What is Arachne?

- Autonomous research agent that orchestrates search, scrape, and synthesis.
- Web search → scrape → index → AI synthesis pipeline.
- Change detection and version history across fetched content.
- Full-text search powered by SQLite FTS5 for collected documents.

## 🚀 Quick Start

### Prerequisites

- Docker
- Docker Compose

### Running the platform

1. **Start all services:**
   ```bash
   cd infrastructure
   docker compose up --build
   ```

2. **Access the applications:**
   - **Arachne Web Interface**: http://localhost/
   - **AI API**: http://localhost/api/ai/
   - **Scraper API**: http://localhost/api/scrape/
   - **Redis Commander**: http://localhost/redis/
   - **Health Check**: http://localhost/health

3. **Stop all services:**
   ```bash
   cd infrastructure
   docker compose down
   ```

## 📁 Service Endpoints

### AI
- **URL**: http://localhost/api/ai/
- **Internal**: http://ai:3001
- **Endpoints**:
  - `GET /health` - Health check
  - `POST /api/ai/process` - AI processing

### Scraper (Web Scraping)
- **URL**: http://localhost/api/scrape/
- **Internal**: http://scraper:8080
- **Endpoints**:
  - `POST /scrape` - Submit scraping job
  - `GET /scrape/status?id=<job_id>` - Check job status
  - `GET /health` - Health check
  - `GET /metrics` - Prometheus metrics

### Redis Commander
- **URL**: http://localhost/redis/
- **Purpose**: Web UI for Redis management

## 🔧 Configuration

### Environment Variables

Arachne uses a centralized environment variable system. For detailed configuration, see [Environment Setup Guide](infrastructure/ENVIRONMENT_SETUP.md).

#### Quick Setup

```bash
cd infrastructure
./setup-env.sh
```

This interactive script will help you configure:
- Domain name and SSL email
- Google Gemini API key for AI features
- Resource limits and performance settings
- Development vs production configurations

#### Manual Setup

```bash
cd infrastructure
cp env.example .env
# Edit .env with your configuration
nano .env
```

#### Key Configuration Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DOMAIN_NAME` | Your domain name | Yes |
| `SSL_EMAIL` | Email for SSL certificates | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | For AI features |
| `VITE_AI_URL` | AI URL | Auto-configured |

### Nginx Configuration

The nginx configuration is located in:
- `infrastructure/nginx/nginx.conf` - Main configuration
- `infrastructure/nginx/conf.d/default.conf` - Server blocks

## 🐳 Individual Service Development

Each service can be developed independently:

### AI
```bash
cd services/ai
npm install
npm run dev
```

### Web Console
```bash
cd services/web
npm install
npm run dev
```

### Scraper
```bash
cd services/scraper
docker-compose up --build
```

## 🔗 Submodules

The `ai` and `scraper` services are git submodules under `services/`. The `web` interface lives directly in this repository. If you clone without `--recurse-submodules`, run:

```bash
git submodule update --init --recursive
```

This fetches the `ai` and `scraper` submodules. When switching branches that touch submodules, rerun the command or checkout with `git submodule sync --recursive`.

## 📊 Monitoring

### Health Checks
All services include health checks that can be monitored:
```bash
cd infrastructure
docker compose ps
```

### Logs
View logs for specific services:
```bash
cd infrastructure
docker compose logs ai
docker compose logs scraper
docker compose logs nginx
docker compose logs web
docker compose logs redis
```

### Redis Monitoring
Access Redis Commander at http://localhost/redis/ to monitor Redis operations.

## 🔒 Security

- All services run as non-root users
- Rate limiting on API endpoints
- Security headers configured in nginx
- CORS properly configured for cross-origin requests

## 🚀 Production Deployment

For production deployment:

1. **Configure environment variables**:
   ```bash
   cd infrastructure
   ./setup-env.sh
   ```

2. **Set up SSL certificates**:
   ```bash
   docker compose -f prod/docker-compose.prod.yml --profile ssl-setup up certbot
   ```

3. **Start production services**:
   ```bash
   docker compose -f prod/docker-compose.prod.yml up -d
   ```

4. **Monitor the deployment**:
   ```bash
   docker compose -f prod/docker-compose.prod.yml logs -f
   ```

For detailed deployment instructions, see [Environment Setup Guide](infrastructure/ENVIRONMENT_SETUP.md).

## 📝 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 80, 443 are available
2. **Build failures**: Check Dockerfile syntax in each service
3. **Service dependencies**: Ensure Redis starts before Arachne
4. **Network issues**: Check if all services are on the same network

### Debug Commands

```bash
cd infrastructure

# Check service status
docker compose ps

# View logs
docker compose logs -f

# Rebuild specific service
docker compose build web

# Access service shell
docker compose exec web sh
```

## 🤝 Contributing

Each service is maintained independently. See individual service READMEs for contribution guidelines. 
