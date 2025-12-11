#!/bin/bash

# =============================================================================
# PORTFOLIO ENVIRONMENT SETUP SCRIPT
# =============================================================================
# This script helps you set up your environment variables for the portfolio
# Copy this script to your infrastructure directory and run it

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# -----------------------------------------------------------------------------
# CLI flags
# -----------------------------------------------------------------------------
NONINTERACTIVE=0
for arg in "$@"; do
  case "$arg" in
    --noninteractive|-y)
      NONINTERACTIVE=1
      shift
      ;;
  esac
done

# Check if we're in the right directory
if [ ! -f "env.example" ]; then
    print_error "env.example file not found. Please run this script from the infrastructure directory."
    exit 1
fi

print_header "PORTFOLIO ENVIRONMENT SETUP"

# -----------------------------------------------------------------------------
# Helpers for reading and writing .env values (defined early for use below)
# -----------------------------------------------------------------------------
get_env_value() {
  local var_name="$1"
  if [ -f .env ]; then
    # Read last occurrence to handle duplicates
    grep -E "^${var_name}=" .env | tail -n 1 | cut -d'=' -f2-
  fi
}

set_env_value() {
  local var_name="$1"
  local var_value="$2"
  local escaped_value
  # Escape sed delimiter and ampersands
  escaped_value=$(printf '%s' "$var_value" | sed -e 's/[&/]/\\&/g')
  if grep -qE "^${var_name}=" .env; then
    sed -i.bak "s|^${var_name}=.*$|${var_name}=${escaped_value}|" .env
  else
    echo "${var_name}=${var_value}" >> .env
  fi
}

prompt_update_var() {
  local var_name="$1"
  local prompt_text="$2"
  local required="$3" # "yes" or "no"
  local current_value
  current_value=$(get_env_value "$var_name")

  echo
  print_header "$var_name"
  if [ -n "$current_value" ]; then
    print_status "Current value: $current_value"
  else
    if [ "$required" = "yes" ]; then
      print_warning "No current value set (required)."
    else
      print_status "No current value set."
    fi
  fi

  echo "Do you want to update $var_name? (u) Update / (s) Skip [s]:"
  read -r action
  if [[ ! "$action" =~ ^[Uu]$ ]]; then
    # If required and empty, keep prompting until provided
    if [ "$required" = "yes" ] && [ -z "$current_value" ] && [ "$var_name" != "SESSION_TOKEN_SECRET" ]; then
      print_warning "$var_name is required and missing. Please provide a value."
      echo "Enter value for $var_name:"
      read -r new_value
      while [ -z "$new_value" ]; do
        echo "Value cannot be empty. Enter value for $var_name:"
        read -r new_value
      done
      set_env_value "$var_name" "$new_value"
    fi
    return
  fi

  echo "Enter new value for $var_name (leave empty to keep current):"
  read -r new_value
  if [ -z "$new_value" ]; then
    print_status "Skipped updating $var_name (kept current)."
  else
    set_env_value "$var_name" "$new_value"
    print_status "Updated $var_name."
  fi
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    date +%s%N | md5
  fi
}

# Ensure we have a .env to edit (create from template if missing)
if [ ! -f ".env" ]; then
    print_status "Creating .env file from template..."
    cp env.example .env
else
    print_status "Using existing .env (update-in-place mode)"
fi

if [ "$NONINTERACTIVE" -eq 1 ] || [ "${SETUP_ENV_NONINTERACTIVE:-0}" = "1" ]; then
  print_header "NON-INTERACTIVE MODE"
  print_status "Applying environment variables to .env and exiting."

  # Write any provided environment variables into .env (idempotent via set_env_value)
  vars_to_apply=(
    DOMAIN_NAME
    SSL_EMAIL
    GEMINI_API_KEY
    AI_REDIS_URL
    CORS_ALLOW_ORIGIN
    RATE_LIMIT_WINDOW_MS
    RATE_LIMIT_MAX_REQUESTS
    AI_DAILY_LIMIT
    SCRAPER_API_TOKEN
    VITE_TURNSTILE_SITE_KEY
    TURNSTILE_SECRET
    SESSION_TOKEN_SECRET
    VITE_AI_URL
  )
  for v in "${vars_to_apply[@]}"; do
    val="${!v-}"
    if [ -n "${val}" ]; then
      set_env_value "$v" "$val"
    fi
  done

  # Auto-generate SESSION_TOKEN_SECRET if still missing
  sess_cur=$(get_env_value "SESSION_TOKEN_SECRET")
  if [ -z "$sess_cur" ]; then
    set_env_value "SESSION_TOKEN_SECRET" "$(generate_secret)"
  fi

  # If DOMAIN_NAME present and VITE_AI_URL missing, set a sensible default
  dn_cur=$(get_env_value "DOMAIN_NAME")
  vite_api_cur=$(get_env_value "VITE_AI_URL")
  if [ -n "$dn_cur" ] && [ -z "$vite_api_cur" ]; then
    set_env_value "VITE_AI_URL" "https://$dn_cur/api/ai"
  fi

  print_status ".env updated from environment variables."
  exit 0
fi

print_status "Now let's configure your environment variables (Update/Skip prompts):"
echo

# -----------------------------------------------------------------------------
# Preflight: summarize missing required and recommended variables
# -----------------------------------------------------------------------------
print_header "PREFLIGHT CHECKS"

# Define required and recommended variables
required_vars=(
  "DOMAIN_NAME"
  "SSL_EMAIL"
  "SESSION_TOKEN_SECRET"
)

recommended_vars=(
  "GEMINI_API_KEY"
  "AI_REDIS_URL"
  "CORS_ALLOW_ORIGIN"
  "RATE_LIMIT_WINDOW_MS"
  "RATE_LIMIT_MAX_REQUESTS"
  "AI_DAILY_LIMIT"
  "SCRAPER_API_TOKEN"
  "VITE_TURNSTILE_SITE_KEY"
  "TURNSTILE_SECRET"
)

missing_required=()
for var_name in "${required_vars[@]}"; do
  val=$(get_env_value "$var_name")
  if [ -z "$val" ]; then
    missing_required+=("$var_name")
  fi
done

missing_recommended=()
for var_name in "${recommended_vars[@]}"; do
  val=$(get_env_value "$var_name")
  if [ -z "$val" ]; then
    missing_recommended+=("$var_name")
  fi
done

if [ ${#missing_required[@]} -eq 0 ]; then
  print_status "All required variables are set."
else
  print_warning "Missing required variables: ${missing_required[*]}"
fi

if [ ${#missing_recommended[@]} -eq 0 ]; then
  print_status "All recommended variables are set."
else
  print_status "Optional variables not set (you can configure them during prompts): ${missing_recommended[*]}"
fi
echo

# -----------------------------------------------------------------------------
# Domain configuration
print_header "DOMAIN CONFIGURATION"
prompt_update_var "DOMAIN_NAME" "Enter your domain name (e.g., yourdomain.com)" "yes"
prompt_update_var "SSL_EMAIL" "Enter your email for SSL certificate notifications" "yes"

# Optionally set VITE_AI_URL based on DOMAIN_NAME
domain_name=$(get_env_value "DOMAIN_NAME")
if [ -n "$domain_name" ]; then
  desired_api_url="https://$domain_name/api/ai"
  current_api_url=$(get_env_value "VITE_AI_URL")
  echo
  print_header "VITE_AI_URL"
  print_status "Suggested value based on domain: $desired_api_url"
  if [ -n "$current_api_url" ]; then
    print_status "Current value: $current_api_url"
  fi
  echo "Do you want to update VITE_AI_URL? (u) Update / (s) Skip [s]:"
  read -r upd
  if [[ "$upd" =~ ^[Uu]$ ]]; then
    echo "Enter value for VITE_AI_URL (leave empty to use suggested):"
    read -r new_api
    if [ -z "$new_api" ]; then new_api="$desired_api_url"; fi
    set_env_value "VITE_AI_URL" "$new_api"
    print_status "Updated VITE_AI_URL."
  fi
fi

# AI configuration
print_header "AI CONFIGURATION"
prompt_update_var "GEMINI_API_KEY" "Enter your Google Gemini API key" "no"

print_header "TURNSTILE (OPTIONAL)"
prompt_update_var "VITE_TURNSTILE_SITE_KEY" "Enter your Cloudflare Turnstile SITE KEY for the frontend" "no"
prompt_update_var "TURNSTILE_SECRET" "Enter your Cloudflare Turnstile SECRET for the backend" "no"

# SESSION_TOKEN_SECRET handling (required in prod). Auto-generate if missing and user skips.
echo
print_header "SESSION_TOKEN_SECRET"
current_sess=$(get_env_value "SESSION_TOKEN_SECRET")
if [ -n "$current_sess" ]; then
  print_status "Current value present."
  echo "Do you want to update SESSION_TOKEN_SECRET? (u) Update / (s) Skip [s]:"
  read -r sess_action
  if [[ "$sess_action" =~ ^[Uu]$ ]]; then
    echo "Enter new SESSION_TOKEN_SECRET (leave empty to auto-generate):"
    read -r new_sess
    if [ -z "$new_sess" ]; then new_sess=$(generate_secret); fi
    set_env_value "SESSION_TOKEN_SECRET" "$new_sess"
    print_status "Updated SESSION_TOKEN_SECRET."
  fi
else
  print_warning "No SESSION_TOKEN_SECRET set. This is required in production."
  echo "Enter a value or press Enter to auto-generate:"
  read -r new_sess
  if [ -z "$new_sess" ]; then new_sess=$(generate_secret); fi
  set_env_value "SESSION_TOKEN_SECRET" "$new_sess"
  print_status "Set SESSION_TOKEN_SECRET."
fi

print_header "REDIS (OPTIONAL)"
prompt_update_var "AI_REDIS_URL" "Enter Redis URL for per-IP quotas (default: redis://redis:6379/0)" "no"

# Scraper API protection (optional but recommended in production)
print_header "SCRAPER SECURITY (OPTIONAL)"
prompt_update_var "SCRAPER_API_TOKEN" "Enter API token to protect scraper /api/scrape endpoints (recommended in prod)" "no"

# Update VITE_AI_URL if domain was provided
if [ -n "$domain_name" ]; then
    sed -i.bak "s|VITE_AI_URL=https://your-domain.com/api/ai|VITE_AI_URL=https://$domain_name/api/ai|" .env
fi

# Optional customizations
print_header "OPTIONAL CUSTOMIZATIONS"
echo "Do you want to customize resource limits? (y/N)"
read -r customize_resources
if [[ "$customize_resources" =~ ^[Yy]$ ]]; then
    echo "Enter memory limit for Nginx (default: 256M):"
    read -r nginx_memory
    if [ -n "$nginx_memory" ]; then
        sed -i.bak "s/NGINX_MEMORY_LIMIT=256M/NGINX_MEMORY_LIMIT=$nginx_memory/" .env
    fi
    
    echo "Enter memory limit for AI (default: 1G):"
    read -r ai_memory
    if [ -n "$ai_memory" ]; then
        sed -i.bak "s/AI_MEMORY_LIMIT=1G/AI_MEMORY_LIMIT=$ai_memory/" .env
    fi
fi

# Clean up backup files
rm -f .env.bak

print_header "SETUP COMPLETE"
print_status "Your .env file has been created with the following configuration:"
echo
dn=$(get_env_value "DOMAIN_NAME")
em=$(get_env_value "SSL_EMAIL")
gk=$(get_env_value "GEMINI_API_KEY")
echo "Domain: ${dn:-your-domain.com}"
echo "Email: ${em:-your-email@example.com}"
if [ -n "$gk" ]; then
  echo "Gemini API Key: [SET]"
else
  echo "Gemini API Key: [NOT SET]"
fi
echo

print_status "Next steps:"
echo "1. Review the .env file and make any additional changes:"
echo "   nano .env"
echo
echo "2. Start the services:"
echo "   # For development:"
echo "   docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d"
echo "   # For production:"
echo "   docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml up -d"
echo
echo "3. If you're deploying to production, set up SSL certificates:"
echo "   docker-compose -f prod/docker-compose.prod.yml --profile ssl-setup up certbot"
echo

print_warning "IMPORTANT: Keep your .env file secure and never commit it to version control!"
print_status "The .env file is already in .gitignore to prevent accidental commits." 