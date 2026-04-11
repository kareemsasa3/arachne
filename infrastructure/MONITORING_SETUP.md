# Monitoring & Observability Stack

This document describes the comprehensive monitoring and observability stack for the personal arachne website.

## 🎯 Overview

The monitoring stack provides real-time insights into the health, performance, and resource usage of all services and the host machine using:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Node Exporter** - Host system metrics
- **Nginx Exporter** - Web server metrics
- **Redis Exporter** - Database metrics
- **Custom Metrics** - Application-specific metrics from AI Backend and Arachne

## 🏗️ Architecture

```
┌──────────────────┐
│      User        │
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│     Grafana      │  <── Queries metrics
│  (Dashboards)    │
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│    Prometheus    │  <── Scrapes /metrics
│    (Metrics DB)  │      endpoints
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│    Your App      │
│ (Arachne, AI, etc)├─────────────────►│    Prometheus    │  <── Scrapes /metrics
│ (Arachne, AI, etc)├─────────────────►│    (Metrics DB)  │      endpoints
└──────────────────┘
        ▲                                       ▲
        │                                       │
┌──────────────────┐                  ┌──────────────────┐
│  Redis Exporter  │                  │  Nginx Exporter  │
└──────────────────┘                  └──────────────────┘
```

## 📁 File Structure

```
infrastructure/
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml        # Prometheus scrape configurations
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── datasources/
│   │   │   │   └── default.yml   # Auto-configures Prometheus datasource
│   │   │   └── dashboards/
│   │   │       └── default.yml   # Tells Grafana where to find dashboards
│   │   └── dashboards/
│   │       └── (empty for now)   # Where you will place dashboard JSON files
│   └── docker-compose.monitoring.yml # Docker compose for monitoring services
└── prod/
    └── docker-compose.monitoring.prod.yml # Production overrides (e.g., resource limits)
```

## 🚀 Quick Start

### Development Environment

1. **Start the monitoring stack:**
   ```bash
   cd infrastructure
   ./setup-monitoring.sh
   ```

2. **Access the monitoring tools:**
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000 (`GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`)

### Production Environment

1. **Start with monitoring:**
   ```bash
   cd infrastructure/prod
   ./prod.sh --with-monitoring
   ```

2. **Access the monitoring tools:**
   - Prometheus: http://your-domain:9090
   - Grafana: http://your-domain:3000 (`GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`)

## 📊 Metrics Collected

### Application Metrics

#### AI Backend (Node.js)
- HTTP request duration and count
- AI chat request success/failure rates
- AI response time histograms
- Default Node.js metrics (CPU, memory, etc.)

#### Arachne (Go)
- Scraping request success/failure rates
- Domain-specific response times
- Circuit breaker states
- Retry attempt counts
- Bytes scraped per domain

### Infrastructure Metrics

#### Nginx
- Request rates and response codes
- Connection counts
- Bytes transferred
- Upstream response times

#### Redis
- Memory usage and evictions
- Command statistics
- Connection counts
- Replication status

#### Host System (Node Exporter)
- CPU, memory, and disk usage
- Network statistics
- File system metrics
- System load averages

## 📈 Recommended Dashboards

### Import these dashboards in Grafana:

1. **Node Exporter Full** (ID: 1860)
   - Comprehensive host system metrics
   - CPU, memory, disk, network visualization

2. **Redis Dashboard** (ID: 11835)
   - Redis performance and health metrics
   - Memory usage, command rates, connections

3. **Nginx Prometheus Exporter** (ID: 12797)
   - Nginx web server metrics
   - Request rates, response codes, upstream health

### Custom Dashboards

Create custom dashboards for:
- AI Backend performance
- Arachne scraping metrics
- Application-specific business metrics

### Local Provisioning

- Place JSON files in `infrastructure/monitoring/grafana/dashboards/` (Grafana auto-loads)
- Custom stubs included:
  - `custom/ai.json`
  - `custom/arachne.json`
- Fetch recommended dashboards:
  ```bash
  cd infrastructure
  ./fetch-grafana-dashboards.sh
  ```

## 🔧 Configuration

### Prometheus Configuration

The Prometheus configuration (`monitoring/prometheus/prometheus.yml`) defines:
- Scrape intervals for each service
- Target endpoints for metrics collection
- Retention policies for data storage

### Grafana Configuration

Grafana is automatically configured with:
- Prometheus as the default data source
- Dashboard provisioning from the `dashboards/` directory
- Admin user setup from `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`

### Environment Variables

Key environment variables for monitoring:
- `DOMAIN_NAME` - Used for Grafana URL configuration
- `DOCKER_NETWORK_NAME` - Network name for service communication
- `GRAFANA_ADMIN_USER` - Required Grafana admin username
- `GRAFANA_ADMIN_PASSWORD` - Required Grafana admin password

## 🛠️ Management Commands

### Development
```bash
# Start monitoring stack
docker-compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml up -d

# View logs
docker-compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml logs -f

# Stop monitoring
docker-compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml down
```

### Production
```bash
# Start with monitoring
./prod.sh --with-monitoring

# View monitoring logs
docker-compose -f docker-compose.yml -f prod/docker-compose.prod.yml -f prod/docker-compose.monitoring.prod.yml logs -f

# Stop monitoring
docker-compose -f docker-compose.yml -f prod/docker-compose.prod.yml -f prod/docker-compose.monitoring.prod.yml down
```

## 🔍 Troubleshooting

### Common Issues

1. **Prometheus targets showing DOWN:**
   - Check if services are running: `docker-compose ps`
   - Verify network connectivity between containers
   - Check if metrics endpoints are accessible

2. **Grafana can't connect to Prometheus:**
   - Verify Prometheus is running: `docker-compose ps prometheus`
   - Check Prometheus logs: `docker-compose logs prometheus`
   - Ensure both services are on the same network

3. **No metrics appearing:**
   - Check if applications are exposing metrics endpoints
   - Verify Prometheus configuration is correct
   - Check application logs for metric collection errors

### Verification Steps

1. **Check Prometheus targets:**
   - Visit http://localhost:9090/targets
   - All targets should show "UP" status

2. **Check metrics endpoints:**
   - AI Backend: http://localhost:3001/metrics
   - Arachne: http://localhost:8080/prometheus
   - Node Exporter: http://localhost:9100/metrics

3. **Check service health:**
   ```bash
   docker-compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml ps
   ```

## 🔒 Security Considerations

### Production Security

1. **Change default passwords:**
   - Grafana admin password
   - Consider using environment variables for sensitive data

2. **Network security:**
   - Restrict access to monitoring ports (9090, 3000)
   - Use reverse proxy with authentication for Grafana
   - Consider VPN access for monitoring endpoints

3. **Data retention:**
   - Configure appropriate retention periods in Prometheus
   - Monitor disk usage for metrics storage
   - Set up backup strategies for Grafana dashboards

### Access Control

1. **Grafana users:**
   - Create read-only users for dashboards
   - Use role-based access control
   - Enable LDAP/SSO if available

2. **Prometheus access:**
   - Consider using Prometheus Operator for Kubernetes
   - Implement proper authentication for Prometheus API

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node Exporter Documentation](https://github.com/prometheus/node_exporter)
- [Nginx Prometheus Exporter](https://github.com/nginxinc/nginx-prometheus-exporter)
- [Redis Exporter](https://github.com/oliver006/redis_exporter)

## 🎉 Success Metrics

Your monitoring stack is working correctly when:

✅ All Prometheus targets show "UP" status  
✅ Grafana can query Prometheus data  
✅ Custom application metrics are visible  
✅ Host system metrics are being collected  
✅ Dashboards display meaningful data  
✅ Alerts can be configured and triggered  

---

**Next Steps:** Import recommended dashboards, create custom dashboards for your application metrics, and set up alerting rules for critical thresholds. 
