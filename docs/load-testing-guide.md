# Load Testing Guide

## Overview

This guide provides comprehensive documentation for running and interpreting load tests for Graceful Books' sync relay and CRDT conflict resolution infrastructure.

**Requirements:** I7 - Load Testing Infrastructure

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Test Profiles](#test-profiles)
4. [Running Tests](#running-tests)
5. [Understanding Results](#understanding-results)
6. [Interpreting Metrics](#interpreting-metrics)
7. [Performance Baselines](#performance-baselines)
8. [Regression Detection](#regression-detection)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Quick Start

```bash
# Install k6 (if not already installed)
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo snap install k6

# Run light load test (100 VUs)
npm run load:test:light

# Run medium load test (500 VUs)
npm run load:test:medium

# Run heavy load test (1000 VUs)
npm run load:test:heavy

# Run all tests sequentially
npm run load:test:all
```

## Prerequisites

### Required Software

1. **k6** - Load testing tool
   - Installation: https://k6.io/docs/getting-started/installation/
   - Version: Latest stable

2. **Node.js** - Runtime environment
   - Version: 18.x or higher
   - Required for running the application

3. **Git** - Version control
   - For checking out code and tracking results

### Environment Setup

1. **Local Development:**
   ```bash
   # Clone repository
   git clone <repo-url>
   cd graceful_books

   # Install dependencies
   npm ci

   # Build application
   npm run build

   # Start preview server
   npm run preview
   ```

2. **CI/CD Environment:**
   - Tests run automatically on PR (light profile)
   - Nightly tests run medium profile
   - Manual trigger available for heavy profile

## Test Profiles

### Light Profile (100 VUs)

**Purpose:** Quick validation for pull requests

| Parameter | Value |
|-----------|-------|
| Concurrent Users | 100 |
| Duration | 5 minutes |
| Ramp Up | 30 seconds |
| Sustained Load | 2 minutes |
| Ramp Down | 30 seconds |

**Use Cases:**
- PR validation
- Quick regression checks
- Development testing

**Expected Performance:**
- RPS: 200-400
- P95 Response Time: <500ms
- Error Rate: <5%

### Medium Profile (500 VUs)

**Purpose:** Comprehensive nightly testing

| Parameter | Value |
|-----------|-------|
| Concurrent Users | 500 |
| Duration | 10 minutes |
| Ramp Up | 1 minute |
| Sustained Load | 8 minutes |
| Ramp Down | 1 minute |

**Use Cases:**
- Nightly regression testing
- Pre-deployment validation
- Performance trend monitoring

**Expected Performance:**
- RPS: 1000-2000
- P95 Response Time: <800ms
- Error Rate: <5%

### Heavy Profile (1000 VUs)

**Purpose:** Stress testing and capacity planning

| Parameter | Value |
|-----------|-------|
| Concurrent Users | 1000 |
| Duration | 15 minutes |
| Ramp Up | 2 minutes |
| Sustained Load | 11 minutes |
| Ramp Down | 2 minutes |

**Use Cases:**
- Finding breaking points
- Capacity planning
- Infrastructure sizing
- Scalability validation

**Expected Performance:**
- RPS: 2000-4000
- P95 Response Time: <1500ms
- Error Rate: <10% (acceptable under extreme load)

## Running Tests

### Local Execution

1. **Start the application:**
   ```bash
   npm run build
   npm run preview
   ```

2. **Run tests in a separate terminal:**
   ```bash
   # Light load test
   npm run load:test:light

   # Or use the script directly
   bash scripts/run-load-tests.sh light
   ```

3. **Monitor results:**
   - Results saved to `tests/load/results/`
   - Summary JSON files contain key metrics
   - k6 provides real-time console output

### CI/CD Execution

**Automatic Triggers:**
- PRs to main/master: Light profile automatically runs
- Nightly at 2 AM UTC: Medium profile automatically runs

**Manual Trigger:**
1. Go to GitHub Actions
2. Select "Load Tests" workflow
3. Click "Run workflow"
4. Choose profile (light/medium/heavy/all)

### Custom Configuration

Override environment variables:

```bash
# Custom base URL
BASE_URL=http://staging.example.com npm run load:test:light

# Custom VU count
VUS_PEAK=200 npm run load:test:light

# Custom duration (modify scenario file)
```

## Understanding Results

### Console Output

k6 provides real-time metrics during test execution:

```
     ✓ push: status is 200
     ✓ push: response has correct structure
     ✓ push: response time acceptable

     █ Light User Journey
       ✓ light: pull successful
       ✓ light: transaction created

     http_reqs......................: 12543  41.81/s
     http_req_duration..............: avg=245ms  p(95)=420ms  p(99)=890ms
     http_req_failed................: 2.34%
```

### Result Files

**JSON Output:**
- Location: `tests/load/results/`
- Naming: `{profile}_{scenario}_{timestamp}.json`
- Contains: All metrics, tags, and checks

**Summary JSON:**
- Location: `tests/load/results/`
- Naming: `{profile}_{scenario}_{timestamp}_summary.json`
- Contains: Aggregated metrics and thresholds

### Key Metrics

1. **http_reqs** - Total HTTP requests
2. **http_req_duration** - Response time distribution
3. **http_req_failed** - Request failure rate
4. **custom metrics** - Domain-specific metrics

## Interpreting Metrics

### Response Time Metrics

| Metric | Description | Good | Warning | Critical |
|--------|-------------|------|---------|----------|
| **avg** | Average response time | <300ms | 300-600ms | >600ms |
| **p(50)** | Median response time | <200ms | 200-400ms | >400ms |
| **p(95)** | 95th percentile | <500ms | 500-1000ms | >1000ms |
| **p(99)** | 99th percentile | <1000ms | 1000-2000ms | >2000ms |
| **max** | Maximum response time | <2000ms | 2000-5000ms | >5000ms |

### Error Metrics

| Metric | Description | Good | Warning | Critical |
|--------|-------------|------|---------|----------|
| **http_req_failed** | HTTP error rate | <2% | 2-5% | >5% |
| **push_success_rate** | Sync push success | >98% | 95-98% | <95% |
| **pull_success_rate** | Sync pull success | >98% | 95-98% | <95% |
| **merge_success_rate** | CRDT merge success | >95% | 90-95% | <90% |

### Throughput Metrics

| Profile | Target RPS | Warning | Critical |
|---------|-----------|---------|----------|
| **Light** | 200-400 | <150 | <100 |
| **Medium** | 1000-2000 | <750 | <500 |
| **Heavy** | 2000-4000 | <1500 | <1000 |

## Performance Baselines

Baseline metrics are documented in `tests/load/baselines/BASELINE.md`.

### Establishing Baselines

1. **Initial Run:**
   ```bash
   npm run load:test:all
   ```

2. **Record Metrics:**
   - Document all key metrics
   - Note hardware specifications
   - Record test conditions

3. **Update Baseline File:**
   - Fill in TBD values in BASELINE.md
   - Set alert thresholds
   - Document any anomalies

### Maintaining Baselines

- **Update Frequency:** After significant infrastructure changes
- **Review Schedule:** Monthly
- **Version Control:** Baseline file is tracked in git

## Regression Detection

### Automatic Detection

CI workflow automatically checks for:

1. **Response Time Regression:**
   - Critical: >50% increase in p95
   - Warning: >20% increase in p95

2. **Error Rate Regression:**
   - Critical: >10% error rate
   - Warning: >5% error rate

3. **Throughput Regression:**
   - Critical: >40% decrease in RPS
   - Warning: >20% decrease in RPS

### Manual Analysis

Compare results with baseline:

```bash
# View baseline
cat tests/load/baselines/BASELINE.md

# View latest results
ls -lt tests/load/results/ | head -10

# Compare specific runs (manual)
# Use jq or similar tools to compare JSON files
```

### Investigating Regressions

When regression detected:

1. **Verify Environment:**
   - Check system resources
   - Verify network conditions
   - Confirm test configuration

2. **Identify Changes:**
   - Review recent commits
   - Check dependency updates
   - Review infrastructure changes

3. **Reproduce Locally:**
   - Run same test profile
   - Enable verbose logging
   - Profile application

4. **Analyze Bottlenecks:**
   - Review application logs
   - Check database performance
   - Monitor memory usage

## Troubleshooting

### Common Issues

#### k6 Not Found

**Problem:** `k6: command not found`

**Solution:**
```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo snap install k6
```

#### Application Not Starting

**Problem:** Tests fail because application isn't running

**Solution:**
```bash
# Check if port 3000 is in use
lsof -i :3000  # macOS/Linux
netstat -an | findstr 3000  # Windows

# Kill existing process
kill <PID>

# Restart application
npm run build
npm run preview
```

#### High Error Rates

**Problem:** Error rate >10%

**Possible Causes:**
1. Application not handling load
2. Mock server limitations
3. Test configuration too aggressive
4. Resource constraints

**Solutions:**
1. Reduce VU count
2. Increase ramp-up time
3. Check application logs
4. Monitor system resources

#### Slow Response Times

**Problem:** Response times exceed thresholds

**Investigation:**
1. Check CPU usage
2. Monitor memory consumption
3. Review network latency
4. Profile application code

#### Tests Timing Out

**Problem:** Tests don't complete within expected time

**Solutions:**
1. Increase timeout in CI workflow
2. Reduce test duration
3. Optimize application performance

### Getting Help

- **Documentation:** This guide
- **k6 Docs:** https://k6.io/docs/
- **Issue Tracker:** GitHub Issues
- **Team Chat:** #performance-testing channel

## Best Practices

### Before Running Tests

1. **Prepare Environment:**
   - Close unnecessary applications
   - Ensure stable network connection
   - Verify adequate system resources

2. **Establish Baseline:**
   - Run tests on clean system
   - Document conditions
   - Record results

3. **Plan Test Strategy:**
   - Choose appropriate profile
   - Define success criteria
   - Prepare monitoring

### During Tests

1. **Monitor System:**
   - Watch CPU/memory usage
   - Check application logs
   - Observe real-time metrics

2. **Don't Interfere:**
   - Avoid other intensive operations
   - Don't modify application
   - Let tests complete

### After Tests

1. **Review Results:**
   - Check all metrics
   - Compare with baseline
   - Identify trends

2. **Document Findings:**
   - Record any anomalies
   - Note performance changes
   - Update baseline if needed

3. **Take Action:**
   - Address regressions
   - Optimize bottlenecks
   - Plan capacity upgrades

### Regular Testing

1. **Schedule:**
   - Light tests on every PR
   - Medium tests nightly
   - Heavy tests weekly or monthly

2. **Trend Analysis:**
   - Track metrics over time
   - Identify gradual degradation
   - Plan proactive improvements

3. **Continuous Improvement:**
   - Optimize based on results
   - Update test scenarios
   - Refine thresholds

## Advanced Topics

### Custom Scenarios

Create custom test scenarios in `tests/load/scenarios/`:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
};

export default function() {
  // Your custom test logic
}
```

### Integration with Monitoring

Integrate k6 with monitoring tools:

- **Grafana:** Real-time dashboards
- **Prometheus:** Metric storage
- **Datadog:** APM integration
- **New Relic:** Performance monitoring

### Distributed Load Testing

For higher load:

1. Use k6 Cloud (commercial)
2. Run multiple k6 instances
3. Use container orchestration

### Performance Profiling

Deep dive into performance:

```bash
# Enable tracing
npm run dev -- --trace

# Use Chrome DevTools
# Use Node.js profiling
node --inspect
```

## Appendix

### File Structure

```
tests/load/
├── scenarios/           # Test scenario files
│   ├── sync-relay.js
│   ├── crdt-conflicts.js
│   └── mixed-workload.js
├── config/             # Configuration profiles
│   ├── light.json
│   ├── medium.json
│   └── heavy.json
├── utils/              # Helper utilities
│   └── helpers.js
├── results/            # Test results (gitignored)
└── baselines/          # Baseline metrics
    └── BASELINE.md

scripts/
└── run-load-tests.sh   # Test runner script

.github/workflows/
└── load-tests.yml      # CI/CD workflow
```

### References

- **k6 Documentation:** https://k6.io/docs/
- **Performance Testing Guide:** https://k6.io/docs/test-types/introduction/
- **Sync Relay Implementation:** `src/sync/syncClient.ts`
- **CRDT Implementation:** `src/db/crdt.ts`
- **Baseline Metrics:** `tests/load/baselines/BASELINE.md`

### Glossary

- **VU (Virtual User):** Simulated concurrent user
- **RPS (Requests Per Second):** Throughput metric
- **p95/p99:** 95th/99th percentile response time
- **CRDT:** Conflict-free Replicated Data Type
- **LWW:** Last-Write-Wins conflict resolution
- **Sync Relay:** Server for syncing encrypted data

---

**Last Updated:** 2026-01-18
**Version:** 1.0.0
**Maintained By:** Infrastructure Team
