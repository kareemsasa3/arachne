# AI Usage Analytics: Metrics & Queries

This document outlines product analytics metrics for the AI assistant. These can be implemented via Prometheus + Grafana (for operational/volume metrics) and optionally exported to a product analytics system later.

## Key Events & Counters (Prometheus)

- ai_chat_requests_total{status}
  - success|error
  - Use as base for volume, success rate, error rate
- ai_chat_response_time_seconds (histogram)
  - Track latency SLOs and percentiles
- http_requests_total{route,method,status_code}
  - Operational HTTP view per route
- Quota events (optional future): ai_quota_rejections_total
  - Count when daily quota exceeded (HTTP 429)

## Core KPIs

- Request volume (total and by status)
- Success rate = sum(rate(ai_chat_requests_total{status="success"}[5m])) / sum(rate(ai_chat_requests_total[5m]))
- Error rate = 1 - success rate
- P50/P90/P99 response time from ai_chat_response_time_seconds
- 4xx/5xx rates from http_requests_total

## Suggested Grafana Panels (PromQL)

- Requests by status (rate):
  - sum by (status) (rate(ai_chat_requests_total[5m]))
- Success rate (%):
  - 100 * sum(rate(ai_chat_requests_total{status="success"}[5m])) / sum(rate(ai_chat_requests_total[5m]))
- Error rate (%):
  - 100 - success_rate
- Latency percentiles:
  - histogram_quantile(0.5, sum(rate(ai_chat_response_time_seconds_bucket[5m])) by (le))
  - histogram_quantile(0.9, sum(rate(ai_chat_response_time_seconds_bucket[5m])) by (le))
  - histogram_quantile(0.99, sum(rate(ai_chat_response_time_seconds_bucket[5m])) by (le))
- Average latency:
  - sum(rate(ai_chat_response_time_seconds_sum[5m])) / sum(rate(ai_chat_response_time_seconds_count[5m]))
- HTTP status breakdown (rate):
  - sum by (status_code) (rate(http_requests_total[5m]))
- Route-level throughput (top N):
  - topk(5, sum by (route) (rate(http_requests_total[5m])))

## Dimensions (Labels)

- status: success|error
- route: Express route path (e.g., /chat)
- method: HTTP method
- status_code: HTTP status code

## Future Enhancements

- Add ai_quota_rejections_total counter (increment on 429) for quota monitoring
- Add request size/response size histograms if needed
- Export anonymized usage counts to a product analytics store for cohort analysis


