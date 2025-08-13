package scraper

import (
	"context"
	"net/url"
	"sync"
	"time"

	"github.com/kareemsasa3/arachne/internal/circuit_breaker"
	"github.com/kareemsasa3/arachne/internal/config"
	"github.com/kareemsasa3/arachne/internal/errors"
	"github.com/kareemsasa3/arachne/internal/logger"
	"github.com/kareemsasa3/arachne/internal/metrics"
	"github.com/kareemsasa3/arachne/internal/strategy"
	"github.com/kareemsasa3/arachne/internal/types"
)

// Scraper handles concurrent web scraping with rate limiting
type Scraper struct {
	config          *config.Config
	logger          *logger.Logger
	metrics         *metrics.Metrics
	strategy        strategy.ScrapingStrategy
	rateLimiter     chan struct{}
	domainLimiters  map[string]chan struct{}
	circuitBreakers map[string]*circuit_breaker.CircuitBreaker
	wg              sync.WaitGroup
	mu              sync.RWMutex
}

// NewScraper creates a new scraper with configurable concurrency
func NewScraper(cfg *config.Config) *Scraper {
	var strat strategy.ScrapingStrategy
	if cfg.UseHeadless {
		strat = strategy.NewHeadlessStrategy()
	} else {
		strat = strategy.NewHTTPStrategy(cfg)
	}

	scraper := &Scraper{
		config:          cfg,
		logger:          logger.NewLogger(cfg.LogLevel),
		metrics:         metrics.NewMetrics(),
		strategy:        strat,
		rateLimiter:     make(chan struct{}, cfg.MaxConcurrent),
		domainLimiters:  make(map[string]chan struct{}),
		circuitBreakers: make(map[string]*circuit_breaker.CircuitBreaker),
	}

	// Initialize domain-specific rate limiters
	for domain, limit := range cfg.DomainRateLimit {
		scraper.domainLimiters[domain] = make(chan struct{}, limit)
	}

	return scraper
}

// scrapeURL fetches a single URL and extracts basic information with retry logic
func (s *Scraper) scrapeURL(ctx context.Context, urlStr string, resultsChan chan<- types.ScrapedData) {
	defer s.wg.Done()

	// Acquire rate limiters
	s.acquireRateLimiters(urlStr)
	defer s.releaseRateLimiters(urlStr)

	// Perform the actual scraping
	data := s.doScrape(ctx, urlStr)

	// Send result to channel
	resultsChan <- data
}

// doScrape contains the core scraping logic shared between concurrent and sync operations
func (s *Scraper) doScrape(ctx context.Context, urlStr string) types.ScrapedData {
	// Validate URL
	if err := errors.ValidateURL(urlStr); err != nil {
		s.logger.Error("Invalid URL: %s", urlStr)
		return types.ScrapedData{
			URL:     urlStr,
			Error:   err.Error(),
			Scraped: time.Now(),
		}
	}

	// Extract domain for rate limiting and circuit breaker
	parsedURL, _ := url.Parse(urlStr)
	domain := parsedURL.Host

	// Get or create circuit breaker for this domain
	s.mu.Lock()
	cb, exists := s.circuitBreakers[domain]
	if !exists {
		cb = circuit_breaker.NewCircuitBreaker(s.config.CircuitBreakerThreshold, s.config.CircuitBreakerTimeout)
		s.circuitBreakers[domain] = cb
	}
	s.mu.Unlock()

	data := types.ScrapedData{
		URL:     urlStr,
		Scraped: time.Now(),
	}

	// Record request in metrics
	s.metrics.RecordRequest()

	// Attempt scraping with retry logic and circuit breaker
	var lastErr error
	for attempt := 1; attempt <= s.config.RetryAttempts; attempt++ {
		start := time.Now()

		// Execute request with circuit breaker protection
		err := cb.Execute(func() error {
			// Delegate the actual scraping to the strategy
			result, err := s.strategy.Execute(ctx, urlStr, s.config)
			if err != nil {
				return err
			}

			// Record success in metrics
			duration := time.Since(start)
			s.metrics.RecordSuccess(domain, result.StatusCode, int64(len(result.Body)), duration)

			// Log success
			s.logger.LogSuccess(urlStr, result.StatusCode, len(result.Body), duration)

			// Set data
			data.Status = result.StatusCode
			data.Title = result.Title
			data.NextURL = result.NextURL

			// Truncate content to configured max bytes, compute size from full body length
			fullLen := len(result.Body)
			data.Size = fullLen
			if s.config.MaxContentBytes > 0 && fullLen > s.config.MaxContentBytes {
				data.Content = result.Body[:s.config.MaxContentBytes]
			} else {
				data.Content = result.Body
			}

			return nil
		})

		if err != nil {
			lastErr = err

			// Check if it's a circuit breaker error
			if circuit_breaker.IsCircuitBreakerError(err) {
				s.logger.Warn("Circuit breaker open for %s: %v", domain, err)
				break
			}

			// Log retry attempt if retryable
			if scraperErr, ok := err.(*errors.ScraperError); ok && scraperErr.IsRetryable() && attempt < s.config.RetryAttempts {
				s.metrics.RecordRetry()
				s.logger.LogRetry(urlStr, attempt, err)
				time.Sleep(s.config.RetryDelay * time.Duration(attempt)) // Exponential backoff
				continue
			}
			break
		}

		// Success - break out of retry loop
		lastErr = nil
		break
	}

	// Handle final error if all retries failed
	if lastErr != nil {
		data.Error = lastErr.Error()
		s.metrics.RecordFailure(domain, 0)
		s.logger.LogFailure(urlStr, lastErr)
	}

	return data
}

// acquireRateLimiters acquires both global and domain-specific rate limiters
func (s *Scraper) acquireRateLimiters(urlStr string) {
	// Acquire global rate limiter slot
	s.rateLimiter <- struct{}{}

	// Acquire domain-specific rate limiter if configured
	parsedURL, _ := url.Parse(urlStr)
	domain := parsedURL.Host

	s.mu.RLock()
	domainLimiter, hasDomainLimit := s.domainLimiters[domain]
	s.mu.RUnlock()

	if hasDomainLimit {
		domainLimiter <- struct{}{}
	}
}

// releaseRateLimiters releases both global and domain-specific rate limiters
func (s *Scraper) releaseRateLimiters(urlStr string) {
	// Release global rate limiter
	<-s.rateLimiter

	// Release domain-specific rate limiter if configured
	parsedURL, _ := url.Parse(urlStr)
	domain := parsedURL.Host

	s.mu.RLock()
	domainLimiter, hasDomainLimit := s.domainLimiters[domain]
	s.mu.RUnlock()

	if hasDomainLimit {
		<-domainLimiter
	}
}

// ScrapeURLs concurrently scrapes multiple URLs
func (s *Scraper) ScrapeURLs(urls []string) []types.ScrapedData {
	ctx, cancel := context.WithTimeout(context.Background(), s.config.TotalTimeout)
	defer cancel()

	s.logger.Info("Starting to scrape %d URLs with %d max concurrent requests", len(urls), s.config.MaxConcurrent)

	// Create a new results channel for this scraping session
	resultsChan := make(chan types.ScrapedData, len(urls))

	// Start scraping goroutines
	for _, url := range urls {
		s.wg.Add(1)
		go s.scrapeURL(ctx, url, resultsChan)
	}

	// Close results channel when all goroutines complete
	go func() {
		s.wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	var results []types.ScrapedData
	for data := range resultsChan {
		results = append(results, data)
	}

	// Finish metrics collection
	s.metrics.Finish()

	return results
}

// ScrapeSite scrapes a site with pagination support
func (s *Scraper) ScrapeSite(startURL string) []types.ScrapedData {
	ctx, cancel := context.WithTimeout(context.Background(), s.config.TotalTimeout)
	defer cancel()

	s.logger.Info("Starting to scrape site %s with pagination support", startURL)

	// Create a new results channel for this scraping session
	resultsChan := make(chan types.ScrapedData, s.config.MaxPages)

	urlsToScrape := []string{startURL}
	scrapedURLs := make(map[string]bool)
	pageCount := 0

	for len(urlsToScrape) > 0 && pageCount < s.config.MaxPages {
		// Pop the next URL
		url := urlsToScrape[0]
		urlsToScrape = urlsToScrape[1:]

		if scrapedURLs[url] {
			continue
		}
		scrapedURLs[url] = true
		pageCount++

		s.logger.Info("Scraping page %d: %s", pageCount, url)

		// Scrape this URL and get the result
		result := s.scrapeURLSync(ctx, url)

		// Add the result to our channel
		resultsChan <- result

		// If we got a next URL and haven't reached max pages, add it to the queue
		if result.NextURL != "" && pageCount < s.config.MaxPages {
			urlsToScrape = append(urlsToScrape, result.NextURL)
			s.logger.Info("Found next page: %s", result.NextURL)
		}
	}

	// Close results channel
	close(resultsChan)

	// Collect results
	var results []types.ScrapedData
	for data := range resultsChan {
		results = append(results, data)
	}

	// Finish metrics collection
	s.metrics.Finish()

	return results
}

// scrapeURLSync scrapes a single URL synchronously and returns the result
func (s *Scraper) scrapeURLSync(ctx context.Context, urlStr string) types.ScrapedData {
	// Acquire rate limiters for synchronous operation
	s.acquireRateLimiters(urlStr)
	defer s.releaseRateLimiters(urlStr)

	// Use the shared scraping logic
	return s.doScrape(ctx, urlStr)
}

// GetMetrics returns the metrics from the scraper
func (s *Scraper) GetMetrics() interface{} {
	return s.metrics.GetMetrics()
}

// GetCircuitBreakerStats returns statistics for all circuit breakers
func (s *Scraper) GetCircuitBreakerStats() map[string]map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := make(map[string]map[string]interface{})
	for domain, cb := range s.circuitBreakers {
		stats[domain] = cb.GetStats()
	}
	return stats
}
