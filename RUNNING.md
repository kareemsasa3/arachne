# 🚀 Running the Go Web Scraper

This guide will help you get the enhanced Go web scraper up and running quickly.

## 📋 Prerequisites

- **Go 1.24.4 or later** - [Download Go](https://golang.org/dl/)
- **Git** - For cloning the repository
- **Terminal/Command Prompt** - For running commands

## 🔧 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/kareemsasa3/go-practice.git
cd go-practice
```

### 2. Verify Go Installation
```bash
go version
# Should show: go version go1.24.4 darwin/amd64 (or similar)
```

### 3. Run the Scraper (Basic)
```bash
go run *.go
```

That's it! The scraper will run with default settings and show you the results.

## 🎯 Different Ways to Run

### **Method 1: Basic Run (Recommended for first time)**
```bash
go run *.go
```
- Uses default settings
- Scrapes 8 test URLs
- Shows results in terminal
- Saves results to `scraping_results.json`

### **Method 2: Using Makefile (Recommended for development)**
```bash
# Show all available commands
make help

# Run with default settings
make run

# Run with debug logging
make run-debug

# Run performance tests
make perf-test
```

### **Method 3: Custom Configuration**
```bash
# High concurrency
go run *.go -concurrent=10

# Debug mode
go run *.go -log-level=debug

# Custom timeouts
go run *.go -timeout=15s -total-timeout=60s

# All options
go run *.go -concurrent=5 -timeout=10s -log-level=info -metrics=true
```

### **Method 4: Environment Variables**
```bash
# Set environment variables
export SCRAPER_MAX_CONCURRENT=5
export SCRAPER_LOG_LEVEL=debug
export SCRAPER_ENABLE_METRICS=true

# Run
go run *.go
```

## 📊 Command-Line Options

| Flag | Description | Default | Example |
|------|-------------|---------|---------|
| `-concurrent` | Max concurrent requests | 3 | `-concurrent=5` |
| `-timeout` | Request timeout | 10s | `-timeout=15s` |
| `-total-timeout` | Total timeout | 30s | `-total-timeout=60s` |
| `-output` | Output file | scraping_results.json | `-output=my_results.json` |
| `-retries` | Retry attempts | 3 | `-retries=5` |
| `-retry-delay` | Retry delay | 1s | `-retry-delay=2s` |
| `-log-level` | Log level | info | `-log-level=debug` |
| `-metrics` | Enable metrics | true | `-metrics=false` |
| `-logging` | Enable logging | true | `-logging=false` |
| `-user-agent` | User-Agent string | Go-Scraper/2.0 | `-user-agent="MyBot/1.0"` |

## 🌍 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SCRAPER_MAX_CONCURRENT` | Max concurrent requests | 3 |
| `SCRAPER_REQUEST_TIMEOUT` | Request timeout | 10s |
| `SCRAPER_TOTAL_TIMEOUT` | Total timeout | 30s |
| `SCRAPER_OUTPUT_FILE` | Output file | scraping_results.json |
| `SCRAPER_RETRY_ATTEMPTS` | Retry attempts | 3 |
| `SCRAPER_RETRY_DELAY` | Retry delay | 1s |
| `SCRAPER_LOG_LEVEL` | Log level | info |
| `SCRAPER_ENABLE_METRICS` | Enable metrics | true |
| `SCRAPER_ENABLE_LOGGING` | Enable logging | true |
| `SCRAPER_USER_AGENT` | User-Agent string | Go-Scraper/2.0 |

## 🎯 Use Case Examples

### **Quick Test Run**
```bash
go run *.go -concurrent=2 -log-level=info
```
Perfect for testing if everything works.

### **Development Mode**
```bash
go run *.go -log-level=debug -metrics=true
```
Shows detailed logs and performance metrics.

### **High-Performance Run**
```bash
go run *.go -concurrent=10 -timeout=5s -retries=2
```
For scraping many URLs quickly.

### **Production Settings**
```bash
export SCRAPER_MAX_CONCURRENT=5
export SCRAPER_REQUEST_TIMEOUT=15s
export SCRAPER_LOG_LEVEL=warn
export SCRAPER_ENABLE_METRICS=true
go run *.go
```
Conservative settings for production use.

### **Custom URLs (Advanced)**
To scrape your own URLs, you'll need to modify the `urls` slice in `main.go`:

```go
urls := []string{
    "https://your-website.com",
    "https://api.example.com/data",
    "https://another-site.com",
}
```

## 📁 Output Files

After running, you'll find:

- **`scraping_results.json`** - Scraped data and results
- **`scraping_metrics.json`** - Performance metrics (if enabled)

### Example Output Structure
```json
[
  {
    "url": "https://golang.org",
    "title": "The Go Programming Language",
    "status": 200,
    "size": 62937,
    "scraped": "2025-06-30T19:27:00.750403-05:00"
  }
]
```

## 🔍 Understanding the Output

### **Terminal Output**
```
🚀 Starting Enhanced Concurrent Web Scraper in Go!
Configuration: Config{MaxConcurrent: 5, RequestTimeout: 10s, ...}
Scraping 8 URLs with rate limiting...

ℹ️  INFO  ✅ Scraped https://golang.org (Status: 200, Size: 62937 bytes, Duration: 530ms)

=== Scraping Results (8 URLs) ===
✅ https://golang.org (Status: 200, Size: 62937 bytes)
   Title: The Go Programming Language

📊 Scraping Metrics Summary
========================
⏱️  Total Duration: 4.26s
📈 Total Requests: 8
✅ Successful: 5 (62.5%)
❌ Failed: 3
🔄 Retry Attempts: 4
```

### **Log Levels**
- **DEBUG** - Detailed information for debugging
- **INFO** - General information about progress
- **WARN** - Warning messages (retries, etc.)
- **ERROR** - Error messages (failures, etc.)

## 🛠️ Development Commands

### **Testing**
```bash
# Run all tests
make test

# Run tests with verbose output
make test-verbose

# Run performance benchmarks
make benchmark
```

### **Code Quality**
```bash
# Format code
make format

# Check dependencies
make check-deps

# Build binary
make build
```

### **Cleanup**
```bash
# Remove build artifacts and output files
make clean
```

## 🚨 Troubleshooting

### **Common Issues**

1. **"command not found: go"**
   - Install Go from [golang.org/dl](https://golang.org/dl/)
   - Add Go to your PATH

2. **"cannot find package"**
   - Run `go mod tidy` to download dependencies

3. **Permission denied**
   - Check file permissions
   - Run `chmod +x` on scripts if needed

4. **Network timeouts**
   - Increase timeout: `-timeout=30s`
   - Check your internet connection

5. **Rate limiting**
   - Reduce concurrency: `-concurrent=1`
   - Increase retry delay: `-retry-delay=5s`

### **Getting Help**
```bash
# Show help
go run *.go -h

# Show Makefile help
make help

# Run with debug logging
go run *.go -log-level=debug
```

## 🎉 Success Indicators

You'll know it's working when you see:
- ✅ Green checkmarks for successful scrapes
- 📊 Metrics summary with statistics
- 📄 "JSON saved to scraping_results.json" message
- ⏱️ Reasonable execution time (2-10 seconds)

## 🔄 Next Steps

After running successfully:
1. Check the generated JSON files
2. Try different configurations
3. Modify the URL list for your own scraping
4. Explore the code to understand how it works
5. Run tests to ensure everything is working

Happy scraping! 🚀 