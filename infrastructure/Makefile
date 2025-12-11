# Portfolio Stack - Development & Production Commands
# Usage: make [target]

.PHONY: help dev dev-build dev-down dev-logs prod prod-down prod-logs \
        install clean nuke ps

# Default target
help:
	@echo "Portfolio Stack Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install     - Install npm deps on host (required before dev)"
	@echo "  make dev         - Start dev stack with hot reload"
	@echo "  make dev-build   - Rebuild and start dev stack"
	@echo "  make dev-down    - Stop dev stack"
	@echo "  make dev-logs    - Follow dev logs"
	@echo ""
	@echo "Production:"
	@echo "  make prod        - Start production stack"
	@echo "  make prod-down   - Stop production stack"
	@echo "  make prod-logs   - Follow production logs"
	@echo ""
	@echo "Utilities:"
	@echo "  make ps          - Show running containers"
	@echo "  make clean       - Stop all and remove volumes"
	@echo "  make nuke        - Full reset (prune everything)"

# ============================================================================
# Development
# ============================================================================

# Install deps on host (required once before dev)
install:
	@echo "📦 Installing dependencies on host..."
	cd ../services/ai && npm install
	cd ../services/web && npm install
	@echo "✅ Dependencies installed"

# Start dev stack
dev:
	docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up

# Rebuild and start dev stack
dev-build:
	docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up --build

# Stop dev stack
dev-down:
	docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml down

# Follow dev logs
dev-logs:
	docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml logs -f

# ============================================================================
# Production
# ============================================================================

# Start production stack
prod:
	docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml up -d --build

# Stop production stack
prod-down:
	docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml down

# Follow production logs
prod-logs:
	docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml logs -f

# ============================================================================
# Utilities
# ============================================================================

# Show running containers
ps:
	docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml ps 2>/dev/null || \
	docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml ps 2>/dev/null || \
	docker ps

# Stop everything and remove volumes
clean:
	docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml down -v 2>/dev/null || true
	docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml down -v 2>/dev/null || true
	@echo "✅ Cleaned up"

# Full reset - prune everything
nuke:
	@echo "⚠️  This will remove ALL stopped containers, unused networks, and dangling images"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml down -v 2>/dev/null || true
	docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml down -v 2>/dev/null || true
	docker system prune -f
	docker volume prune -f
	@echo "💥 Nuked"

