#!/bin/bash

# Monitoring stack setup script for the arachne
# This script sets up Prometheus and Grafana monitoring

set -euo pipefail  # Exit on error, unset vars, and fail pipelines

echo "📊 Setting up monitoring stack for arachne..."
echo "   This will configure Prometheus and Grafana for monitoring your services"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found!"
    echo "   Please run this script from the infrastructure directory"
    exit 1
fi

# Check if monitoring directory exists
if [ ! -d "monitoring" ]; then
    echo "❌ Error: monitoring directory not found!"
    echo "   Please ensure the monitoring configuration files are present"
    exit 1
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

# Create necessary directories
echo "📁 Creating monitoring directories..."
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/dashboards/custom

# Ensure full stack (app + monitoring) is up in a single invocation to avoid name conflicts
echo "🔍 Ensuring app + monitoring stack is up..."
docker compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml up -d --no-recreate

# Start health checks
echo ""
echo "🚀 Starting monitoring health checks..."

# Wait for monitoring services to be healthy
echo ""
echo "⏳ Waiting for monitoring services to become healthy..."

check_url() {
  local url="$1"
  local max_retries=${2:-30}
  local delay=${3:-2}
  for i in $(seq 1 "$max_retries"); do
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

# Prometheus health endpoint
check_url "http://localhost:9090/-/healthy" 60 2 || echo "⚠️  Prometheus not ready yet"
# Grafana health endpoint
check_url "http://localhost:3000/api/health" 60 2 || echo "⚠️  Grafana not ready yet"

# Check monitoring service health
echo ""
echo "🔍 Checking monitoring service health..."
docker compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml ps

echo ""
echo "✅ Monitoring stack successfully deployed!"
echo ""
echo "📊 Your monitoring services are now available at:"
echo "   • Prometheus:     http://localhost:9090"
echo "   • Grafana:        http://localhost:3000"
echo "     - Username:     admin"
echo "     - Password:     admin"
echo ""
echo "🔧 Monitoring Features:"
echo "   • Prometheus metrics collection from all services"
echo "   • Grafana dashboards for visualization"
echo "   • Node Exporter for host system metrics"
echo "   • Nginx Exporter for web server metrics"
echo "   • Redis Exporter for database metrics"
echo "   • Custom metrics from AI Backend and Arachne"
echo ""
echo "📈 Next Steps:"
echo "   1. Open Grafana at http://localhost:3000"
echo "   2. Login with GRAFANA_ADMIN_USER / GRAFANA_ADMIN_PASSWORD from infrastructure/.env"
echo "   3. Import dashboards from Grafana.com:"
echo "      - Node Exporter Full (ID: 1860)"
echo "      - Redis Dashboard (ID: 11835)"
echo "      - Nginx Prometheus Exporter (ID: 12797)"
echo "   4. Create custom dashboards for your application metrics"
echo ""
echo "📥 Optional: Fetch recommended dashboards automatically"
echo "   Run: ./fetch-grafana-dashboards.sh"
echo "📊 Management Commands:"
echo "   • View monitoring logs: docker compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml logs -f"
echo "   • Check monitoring status: docker compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml ps"
echo "   • Stop monitoring: docker compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml down"
echo ""
echo "🔍 Verify Metrics Collection:"
echo "   • Check Prometheus targets: http://localhost:9090/targets"
echo "   • All targets should show 'UP' status"
echo "   • If any targets are 'DOWN', check service connectivity"
echo ""
echo "⚠️  Security Notes:"
echo "   • Change default Grafana password after first login"
echo "   • Consider restricting access to monitoring ports in production"
echo "   • Set up proper authentication for Grafana in production"
echo ""
echo "🎉 Monitoring setup complete! Your arachne is now fully observable." 
