# 🔐 SSL Certificate Setup Guide

This guide will help you set up SSL certificates for HTTPS support in your arachne project.

## 🚀 Quick Start

For immediate testing, generate a self-signed certificate:

```bash
./infrastructure/ssl-setup.sh self-signed localhost
```

## 📋 Prerequisites

- OpenSSL installed on your system
- Docker and Docker Compose installed
- Domain name (for production certificates)

## 🔧 Setup Options

### Option 1: Self-Signed Certificate (Development/Testing)

**Best for:** Local development, testing, or internal use

**Pros:**
- Quick to set up
- No external dependencies
- Free

**Cons:**
- Browser security warnings
- Not trusted by browsers
- Not suitable for production

**Setup:**
```bash
# Interactive setup
./infrastructure/ssl-setup.sh

# Or direct command
./infrastructure/ssl-setup.sh self-signed your-domain.com
```

### Option 2: Let's Encrypt with Docker Compose Integration (Production - Recommended)

**Best for:** Production deployments with a real domain

**Pros:**
- Free
- Trusted by all browsers
- Zero-downtime certificate renewal
- Fully automated with Docker Compose
- No need to stop services for renewal
- Widely supported

**Cons:**
- Requires a real domain name
- Domain must point to your server
- 90-day renewal cycle

**Setup Steps:**

#### Method A: Automated Setup (Recommended)

1. **Run the automated setup script**
   ```bash
   cd infrastructure/prod
   ./lets-encrypt-setup.sh
   ```
   
   This script will:
   - Prompt for your domain and email
   - Create necessary directories
   - Update all configuration files
   - Set up initial certificates
   - Configure auto-renewal
   - Test the setup

#### Method B: Manual Setup

1. **Ensure your domain points to your server**
   ```bash
   # Check if your domain resolves to your server
   nslookup your-domain.com
   ```

2. **Create necessary directories**
   ```bash
   mkdir -p infrastructure/nginx/certbot/www
   mkdir -p infrastructure/logs/certbot
   ```

3. **Update configuration files**
   ```bash
   # Update nginx configuration
   sed -i 's/server_name localhost;/server_name your-domain.com;/g' infrastructure/nginx/conf.d/default.conf
   
   # Update production docker-compose
   sed -i 's/your-email@example.com/your-actual-email@example.com/g' infrastructure/prod/docker-compose.prod.yml
   sed -i 's/your-domain.com/your-actual-domain.com/g' infrastructure/prod/docker-compose.prod.yml
   ```

4. **Start nginx for ACME challenge**
   ```bash
   cd infrastructure
   docker-compose -f docker-compose.yml -f prod/docker-compose.prod.yml up -d nginx
   ```

5. **Obtain initial certificate**
   ```bash
   docker-compose -f docker-compose.yml -f prod/docker-compose.prod.yml --profile ssl-setup run --rm certbot
   ```

6. **Start full production stack**
   ```bash
   docker-compose -f docker-compose.yml -f prod/docker-compose.prod.yml up -d
   ```

7. **Set up auto-renewal**
   ```bash
   # The setup script creates renew-ssl.sh automatically
   # Add to crontab:
   crontab -e
   # Add: 0 12 * * * /path/to/your/project/renew-ssl.sh
   ```

**Key Features of Docker Compose Integration:**
- ✅ Zero-downtime certificate renewal
- ✅ Automatic ACME challenge handling
- ✅ Shared volumes between nginx and certbot
- ✅ No need to stop services for renewal
- ✅ Fully automated renewal process
- ✅ Proper error handling and logging

### Option 3: Commercial SSL Certificate

**Best for:** Enterprise requirements or specific certificate needs

**Setup:**
1. Purchase certificate from provider (DigiCert, Comodo, etc.)
2. Download certificate files
3. Place in `infrastructure/nginx/ssl/`:
   - `cert.pem` (your certificate)
   - `key.pem` (your private key)
4. Set permissions:
   ```bash
   chmod 600 infrastructure/nginx/ssl/key.pem
   chmod 644 infrastructure/nginx/ssl/cert.pem
   ```

## 🔍 Testing Your Setup

### Test SSL Configuration
```bash
./infrastructure/ssl-setup.sh test
```

### Test Certificate Validity
```bash
# Check certificate details
openssl x509 -in infrastructure/nginx/ssl/cert.pem -text -noout

# Check private key
openssl rsa -in infrastructure/nginx/ssl/key.pem -check -noout

# Test nginx configuration
docker run --rm -v "$(pwd)/infrastructure/nginx:/etc/nginx" nginx:alpine nginx -t
```

### Test HTTPS Connection
```bash
# After starting services
curl -k https://localhost/health
```

## 🌐 Domain Configuration

### Update Domain Name
```bash
# Interactive
./infrastructure/ssl-setup.sh update-domain

# Direct command
./infrastructure/ssl-setup.sh update-domain your-domain.com
```

### Manual Domain Update
If you need to manually update the domain:

1. **Update nginx configuration:**
   ```bash
   sed -i 's/server_name localhost;/server_name your-domain.com;/g' infrastructure/nginx/conf.d/default.conf
   ```

2. **Update production docker-compose:**
   ```bash
   sed -i 's|https://your-domain.com|https://your-actual-domain.com|g' infrastructure/prod/docker-compose.prod.yml
   ```

## 🚀 Starting Services with SSL

### Development (Self-Signed)
```bash
cd infrastructure
docker-compose up --build
```

### Production
```bash
cd infrastructure
./prod.sh
```

## 🔒 Security Best Practices

### Certificate Security
- Keep private keys secure (600 permissions)
- Never commit private keys to version control
- Use strong key sizes (2048+ bits)
- Regular certificate renewal

### Nginx Security
- Use strong SSL ciphers
- Enable HSTS headers
- Disable weak protocols (TLS 1.0/1.1)
- Regular security updates

### File Permissions
```bash
# Private key
chmod 600 infrastructure/nginx/ssl/key.pem

# Certificate
chmod 644 infrastructure/nginx/ssl/cert.pem

# Directory
chmod 700 infrastructure/nginx/ssl/
```

## 🛠️ Troubleshooting

### Common Issues

**1. Certificate not found**
```bash
# Check if certificates exist
ls -la infrastructure/nginx/ssl/
```

**2. Permission denied**
```bash
# Fix permissions
chmod 600 infrastructure/nginx/ssl/key.pem
chmod 644 infrastructure/nginx/ssl/cert.pem
```

**3. Nginx configuration errors**
```bash
# Test configuration
docker run --rm -v "$(pwd)/infrastructure/nginx:/etc/nginx" nginx:alpine nginx -t
```

**4. SSL handshake errors**
```bash
# Check certificate validity
openssl s_client -connect localhost:443 -servername localhost
```

**5. Browser security warnings (self-signed)**
- This is normal for self-signed certificates
- Click "Advanced" → "Proceed to localhost (unsafe)"
- For production, use Let's Encrypt or commercial certificates

### Debug Commands
```bash
# Check nginx logs
docker-compose logs nginx

# Check certificate expiration
openssl x509 -in infrastructure/nginx/ssl/cert.pem -noout -dates

# Test SSL connection
openssl s_client -connect localhost:443 -servername localhost
```

## 📚 Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [SSL Labs SSL Test](https://www.ssllabs.com/ssltest/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

## ✅ Checklist

- [ ] SSL certificates generated/installed
- [ ] Domain name configured
- [ ] Nginx configuration updated
- [ ] File permissions set correctly
- [ ] SSL configuration tested
- [ ] Services start successfully
- [ ] HTTPS accessible
- [ ] Auto-renewal configured (Let's Encrypt)
- [ ] Security headers enabled
- [ ] Backup strategy in place

## 🎯 Next Steps

After SSL setup:
1. Configure environment variables
2. Set up monitoring and alerting
3. Configure backups
4. Set up CI/CD pipeline
5. Document deployment procedures 