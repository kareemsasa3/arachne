#!/bin/bash
set -euo pipefail

# Development script for the arachne stack
# This script starts the services in development mode with live reloading

echo "🚀 Starting arachne stack in DEVELOPMENT mode..."
echo "   This will start all services with live reloading enabled"
echo ""

# Check if docker-compose.dev.yml exists
if [ ! -f "docker-compose.dev.yml" ]; then
    echo "❌ Error: docker-compose.dev.yml not found!"
    echo "   Please ensure you're running this script from the dev directory"
    echo "   and that the development configuration file exists."
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
echo "   This ensures a clean start and prevents port conflicts"
cd .. && docker compose down

# Start in development mode
echo ""
echo "🔧 Starting development stack with live reloading..."
echo "   Building and starting all services (this may take a moment)..."
docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up --build || exit 1

echo ""
echo "✅ Development stack successfully started!"
echo ""
echo "📱 Your services are now available at:"
echo "   • Web UI (Arachne):         http://localhost"
echo "   • AI Backend API:           http://localhost/api/ai/health"
echo "   • Arachne Scraper API:      http://localhost/api/scrape/health"
echo "   • Direct AI Backend:        http://localhost:3001/health"
echo "   • Direct Arachne Service:   http://localhost:8080/health"
echo ""
echo "🔄 Live reloading is active for:"
echo "   • AI Backend: Changes to server.js will restart the service"
echo "   • Web UI: Next.js changes will hot-reload in the browser"
echo "   • Arachne: Go code changes will rebuild and restart the service"
echo ""
echo "💡 Development Tips:"
echo "   • Check the logs above for any startup errors"
echo "   • Use 'docker-compose logs -f [service-name]' to follow specific service logs"
echo "   • The frontend will automatically reload when you save changes"
echo ""
echo "⏹️  To stop the development stack, press Ctrl+C"
echo "   This will gracefully shut down all services" 