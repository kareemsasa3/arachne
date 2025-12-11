#!/bin/bash
set -euo pipefail

# =============================================================================
# Development Environment Startup Script
# =============================================================================
#
# This script starts the full development stack with hot reloading.
#
# PREREQUISITES:
#   1. Docker and Docker Compose installed
#   2. Node.js dependencies installed on host (run once):
#      cd services/ai && npm install
#      cd ../web && npm install
#
# USAGE:
#   ./dev.sh              # Start dev stack
#   ./dev.sh --build      # Rebuild and start
#   ./dev.sh --clean      # Clean restart (removes volumes)
#
# ACCESS:
#   http://localhost/   → Arachne UI (scraper dashboard)
#
# =============================================================================

cd "$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Arachne Dev Stack${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check for required dependencies
check_deps() {
    local missing=()
    
    if ! [ -d "../services/ai/node_modules" ]; then
        missing+=("ai")
    fi
    if ! [ -d "../services/web/node_modules" ]; then
        missing+=("web")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${YELLOW}⚠ Missing node_modules in: ${missing[*]}${NC}"
        echo ""
        echo "Run these commands first:"
        echo "  cd services/ai && npm install"
        echo "  cd ../web && npm install"
        echo ""
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Parse arguments
BUILD_FLAG=""
CLEAN=false

for arg in "$@"; do
    case $arg in
        --build)
            BUILD_FLAG="--build"
            ;;
        --clean)
            CLEAN=true
            ;;
        --help|-h)
            echo "Usage: $0 [--build] [--clean]"
            echo ""
            echo "Options:"
            echo "  --build    Rebuild images before starting"
            echo "  --clean    Remove volumes and do a clean restart"
            exit 0
            ;;
    esac
done

# Check dependencies
check_deps

# Clean if requested
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml down -v --remove-orphans 2>/dev/null || true
fi

# Start the stack
echo -e "${GREEN}🚀 Starting development stack...${NC}"
echo ""

docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up $BUILD_FLAG

# This line only runs if you Ctrl+C
echo ""
echo -e "${YELLOW}Stack stopped.${NC}"
