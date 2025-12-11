#!/bin/bash

# Production deployment script for the portfolio stack
# This script starts the services in production mode with optimized settings

set -euo pipefail  # Exit on error, unset vars, and fail pipelines

echo "🚀 Starting portfolio stack in PRODUCTION mode..."
echo "   This will deploy all services with production-optimized settings"
echo ""

# Check if docker-compose.prod.yml exists
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Error: docker-compose.prod.yml not found!"
    echo "   Please ensure you're running this script from the prod directory"
    echo "   and that the production configuration file exists."
    exit 1
fi

# Check if running as root (not recommended for production)
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Warning: Running as root is not recommended for production"
    echo "   Consider running as a non-root user with docker permissions"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check Docker availability
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed or not in PATH"
    exit 1
fi

# Ensure external production network exists
docker network create portfolio-network-prod >/dev/null 2>&1 || true

# Create logs directory if it doesn't exist
echo "📁 Creating logs directory..."
mkdir -p ../logs/nginx ../logs/redis

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
cd .. && docker compose down --remove-orphans

# Clean up any dangling images (optional)
echo "🧹 Cleaning up unused Docker resources..."
docker system prune -f

# Build and start in production mode
echo ""
echo "🔧 Building and starting production stack..."
echo "   This may take several minutes for the initial build..."
echo "   Building optimized production images..."

# Build images first
docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml build --no-cache

echo ""
echo "🚀 Starting production services..."
docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml up -d

# Start monitoring stack if requested
if [ "$1" = "--with-monitoring" ] || [ "$1" = "-m" ]; then
    echo ""
    echo "📊 Starting monitoring stack..."
    docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml -f prod/docker-compose.monitoring.prod.yml up -d
    echo "✅ Monitoring stack started!"
    echo "   • Prometheus: http://localhost:9090"
    echo "   • Grafana: http://localhost:3000 (admin/admin)"
fi

# Wait for services to be healthy using readiness loop
echo ""
echo "⏳ Waiting for services to become healthy..."

check_url() {
    local url="$1"
    local max_retries=${2:-30}
    local delay=${3:-2}
    local insecure_flag="$4"
    for i in $(seq 1 "$max_retries"); do
        if curl -s $insecure_flag -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
            return 0
        fi
        sleep "$delay"
    done
    return 1
}

# nginx health (HTTP 80 inside container, exposed on host)
check_url "http://localhost/health" 60 2 || echo "⚠️  nginx health not ready yet"
# ai service proxied via nginx
check_url "http://localhost/api/ai/health" 60 2 || echo "⚠️  ai service not ready yet"
# scraper proxied via nginx
check_url "http://localhost/api/scrape/health" 60 2 || echo "⚠️  scraper not ready yet"

echo ""
echo "🔍 Docker Compose service status:"
docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml ps

echo ""
echo "✅ Production stack successfully deployed!"
echo ""
echo "📱 Your production services are now available at:"
echo "   • Main Application:     https://your-domain.com"
echo "   • AI API:               https://your-domain.com/api/ai/health"
echo "   • Scraper API:          https://your-domain.com/api/scrape/health"
echo ""
echo "🔧 Production Features:"
echo "   • Resource limits configured for optimal performance"
echo "   • Health checks enabled for all services"
echo "   • Log rotation configured (10MB max, 3 files)"
echo "   • Automatic restart policies enabled"
echo "   • Production-optimized Redis configuration"
echo ""
echo "📊 Monitoring & Management:"
echo "   • View logs: docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml logs -f"
echo "   • Check status: docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml ps"
echo "   • Scale services: docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml up -d --scale [service]=[count]"
echo "   • Redis Commander (optional): docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml --profile monitoring up -d"
echo "   • Start with monitoring: ./prod.sh --with-monitoring"
echo ""
echo "⚠️  Important Production Notes:"
echo "   • Update VITE_API_BASE_URL in prod/docker-compose.prod.yml with your actual domain"
echo "   • Configure SSL certificates in nginx configuration"
echo "   • Set up proper backup strategies for Redis data"
echo "   • Monitor resource usage and adjust limits as needed"
echo "   • Consider setting up monitoring and alerting"
echo ""
echo "⏹️  To stop the production stack:"
echo "   docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml down"
echo ""
echo "🔄 To update services:"
echo "   ./prod/prod.sh  # This will rebuild and restart all services"
echo "   ./prod/prod.sh --with-monitoring  # This will also start the monitoring stack" 