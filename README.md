<p align="center">
  <img src="./assets/arachne-logo-transparent.png" alt="Arachne Logo" width="400">
</p>

<h1 align="center">Arachne</h1>

<p align="center">
  A scalable, production-ready Go web scraping service with an asynchronous job API, persistent job state, and a fully automated CI/CD pipeline.
</p>

<p align="center">
  <a href="https://goreportcard.com/report/github.com/kareemsasa3/arachne"><img src="https://goreportcard.com/badge/github.com/kareemsasa3/arachne" /></a>
  <a href="https://github.com/kareemsasa3/arachne/blob/main/LICENSE"><img src="https://img.shields.io/github/license/kareemsasa3/arachne?style=flat-square&color=blue" /></a>
  <a href="https://hub.docker.com/r/kareemsasa3/arachne"><img src="https://img.shields.io/docker/pulls/kareemsasa3/arachne.svg" /></a>
  <a href="https://github.com/kareemsasa3/arachne/releases/latest"><img src="https://img.shields.io/github/v/release/kareemsasa3/arachne" /></a>
</p>

## ✨ Features

- **🚀 Asynchronous API**: Submit scraping jobs and poll for results later.
- **💾 Persistent Job State**: Redis backend ensures jobs survive restarts and crashes.
- **🏆 Proven Performance**: Successfully scraped 92.5% of 40+ real-world, challenging sites.
- **🐳 Fully Containerized**: Get started in minutes with a single `docker-compose up` command.
- **🤖 Automated CI/CD**: Every commit is tested, and every release is built and published automatically.
- **🛡️ Resilient by Design**: Features circuit breakers and exponential backoff to handle failures gracefully.
- **📈 Scalable Architecture**: Ready for distributed job processing.

## 📊 Performance Benchmark

Arachne was benchmarked against a diverse list of 40+ real-world websites to test its capabilities against dynamic content, large pages, and international sites.

| Category | Success Rate | Notable Successes |
|:---|:---:|:---|
| **Tech News & APIs** | 100% | GitHub Trending, Hacker News, Mozilla Docs |
| **Dynamic JS Content** | 100% | React, Vue, Angular, Next.js showcase sites |
| **E-commerce** | 60% | **Amazon (945KB), Stripe (2.1MB)**, Shopify |
| **Government & Edu** | 100% | **NASA.gov**, White House, MIT, Stanford |
| **International** | 100% | Wikipedia, BBC, Le Monde, **Spiegel.de (2MB)** |

**Key takeaway:** Arachne demonstrates a high success rate against complex, real-world targets and handles large pages with ease.

## 🚀 Quick Start

### Prerequisites
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### Run with Docker Compose

```bash
# Clone the repository
git clone https://github.com/kareemsasa3/arachne.git
cd arachne

# Start the service
docker-compose up --build
```

**Services Available:**
- **API Server**: http://localhost:8080
- **Redis Commander UI**: http://localhost:8081

### 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/scrape` | Submit a new scraping job |
| `GET` | `/scrape/status?id=<job_id>` | Get job status and results |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |

### 📝 Example Usage

**Submit a Scrape Job:**

```bash
curl -X POST http://localhost:8080/scrape \
  -H 'Content-Type: application/json' \
  -d '{
    "urls": ["https://golang.org", "https://github.com/trending"]
  }'
```

This will return a `job_id`.

**Check Job Status:**

```bash
# Replace <job_id> with the ID from the previous step
curl "http://localhost:8080/scrape/status?id=<job_id>" | jq
```

## 🏗️ Architecture & Design

### Architecture Overview

- **🌐 API Layer**: Handles HTTP requests, creates jobs, and persists them in Redis.
- **🔧 Worker Model**: Jobs are processed asynchronously in the background. The design is ready to be extended to a distributed worker model using a message queue.
- **🛡️ Resilience**: Incorporates circuit breakers and exponential backoff to protect against cascading failures from unreliable external sites.
- **🐳 Containerization**: A multi-stage Dockerfile creates a small, efficient production image (~17MB). docker-compose orchestrates the entire application stack.

### 💾 Data Persistence

Arachne is designed to be resilient and stateful. Your scraping jobs and results are persisted across application restarts and crashes.

- **🚀 Primary Storage (Redis)**: All active and completed jobs are stored in Redis.
  - **Default TTL**: Jobs and their results are kept in Redis for 24 hours.
  - **Resilience**: The `docker-compose.yml` file configures a named Docker volume (`redis_data`) to ensure your Redis data persists even if the container is removed.
- **📝 Secondary Storage (JSON Files)**: For long-term archival, results can also be saved to JSON files within the `results` directory, which is mounted as a volume.
- **🔍 Live Inspection**: You can inspect the live data in Redis at any time using the Redis Commander web UI at http://localhost:8081.

## 🤖 Development & CI/CD

This project is managed with a professional, automated CI/CD pipeline using GitHub Actions to ensure code quality and streamline releases.

For details on the specific workflows, branch protection rules, and how to contribute, please see our [CONTRIBUTING.md](CONTRIBUTING.md) file.

## ⚙️ Configuration

Environment variables can be set in a `.env` file. See `.env.example` for a full list of options.

| Variable | Description | Default |
|----------|-------------|---------|
| `SCRAPER_API_PORT` | API server port | `8080` |
| `SCRAPER_REDIS_ADDR` | Redis host | `redis:6379` |
| `SCRAPER_MAX_CONCURRENT` | Max concurrent scraping requests | `5` |
| `SCRAPER_REQUEST_TIMEOUT` | Timeout for each HTTP request | `10s` |

## 🧪 Testing

Run all local tests, including coverage report:

```bash
go test -v -cover ./...
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 