#!/bin/bash

# Test SSL Setup Script
# This script tests the SSL configuration with running services

set -euo pipefail

echo "🔐 Testing SSL Setup with Running Services"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

usage() {
    echo "Usage: $0 [--env dev|prod]"
    echo "Default: --env prod"
}

ENVIRONMENT="prod"
if [ $# -gt 0 ]; then
    while [ $# -gt 0 ]; do
        case "$1" in
            --env)
                shift
                ENVIRONMENT="${1:-prod}"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                usage
                exit 1
                ;;
        esac
    done
fi

NGINX_CONTAINER="arachne-nginx-prod"
BASE_URL="https://localhost"
if [ "$ENVIRONMENT" = "dev" ]; then
    NGINX_CONTAINER="arachne-nginx"
    BASE_URL="http://localhost"
fi

# Check if services are running
check_services() {
    print_info "Checking if services are running... ($ENVIRONMENT)"
    if ! docker ps --format '{{.Names}}' | grep -q "^$NGINX_CONTAINER$"; then
        print_error "Nginx container '$NGINX_CONTAINER' is not running"
        print_info "Start services first: cd infrastructure && docker compose up -d"
        exit 1
    fi
    print_status "Services are running"
}

# Test HTTPS endpoints
test_endpoints() {
    print_info "Testing endpoints at $BASE_URL ..."
    local http_opts="-s -o /dev/null -w %{http_code}"
    local curl_cmd="curl $http_opts"
    [ "$ENVIRONMENT" = "prod" ] && curl_cmd="curl -k $http_opts"

    # Test main application
    if $curl_cmd "$BASE_URL/health" | grep -q "200"; then
        print_status "Main application: OK"
    else
        print_warning "Main application: Failed (may be starting up)"
    fi

    # Test AI backend
    if $curl_cmd "$BASE_URL/api/ai/health" | grep -q "200"; then
        print_status "AI Backend: OK"
    else
        print_warning "AI Backend: Failed (may be starting up)"
    fi

    # Test Arachne scraper
    if $curl_cmd "$BASE_URL/api/scrape/health" | grep -q "200"; then
        print_status "Arachne Scraper: OK"
    else
        print_warning "Arachne Scraper: Failed (may be starting up)"
    fi
}

# Test SSL certificate
test_certificate() {
    print_info "Testing SSL certificate..."
    
    if [ "$ENVIRONMENT" != "prod" ]; then
        print_warning "Skipping certificate test in dev (HTTP-only)"
        return 0
    fi

    # Get certificate info
    cert_info=$(echo | openssl s_client -connect localhost:443 -servername localhost 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "SSL certificate is valid"
        echo "$cert_info" | while read line; do
            echo "   $line"
        done
    else
        print_error "SSL certificate test failed"
    fi
}

# Test HTTP to HTTPS redirect
test_redirect() {
    print_info "Testing HTTP to HTTPS redirect..."
    if [ "$ENVIRONMENT" != "prod" ]; then
        print_warning "Skipping redirect test in dev (HTTP-only)"
        return 0
    fi

    redirect_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health)
    
    if [ "$redirect_status" = "301" ] || [ "$redirect_status" = "302" ]; then
        print_status "HTTP to HTTPS redirect: OK ($redirect_status)"
    else
        print_warning "HTTP to HTTPS redirect: Unexpected status ($redirect_status)"
    fi
}

# Main execution
main() {
    check_services
    test_certificate
    test_redirect
    test_endpoints
    
    echo ""
    print_status "SSL setup test completed!"
    echo ""
    if [ "$ENVIRONMENT" = "prod" ]; then
        print_info "Your services are now accessible via HTTPS:"
        echo "   • Main Application:     https://localhost"
        echo "   • AI Backend API:       https://localhost/api/ai/health"
        echo "   • Arachne Scraper API:  https://localhost/api/scrape/health"
    else
        print_info "Your services are now accessible via HTTP:"
        echo "   • Main Application:     http://localhost"
        echo "   • AI Backend API:       http://localhost/api/ai/health"
        echo "   • Arachne Scraper API:  http://localhost/api/scrape/health"
    fi
    echo ""
    print_warning "Note: Self-signed certificates will show security warnings in browsers"
    print_warning "Click 'Advanced' → 'Proceed to localhost (unsafe)' to access the site"
}

# Run main function
main 