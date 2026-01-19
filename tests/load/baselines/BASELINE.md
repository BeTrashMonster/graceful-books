# Load Testing Baseline Performance Metrics

## Overview

This document records baseline performance metrics for the Graceful Books sync relay and CRDT conflict resolution infrastructure. These baselines are used to detect performance regressions and guide capacity planning.

**Last Updated:** 2026-01-18
**Test Environment:** Local Development
**Hardware:** Standard developer workstation
**k6 Version:** Latest

## Test Configuration

### Light Load (100 VUs)
- **Concurrent Users:** 100
- **Duration:** 5 minutes
- **Purpose:** PR validation, quick regression checks

### Medium Load (500 VUs)
- **Concurrent Users:** 500
- **Duration:** 10 minutes
- **Purpose:** Nightly testing, pre-deployment validation

### Heavy Load (1000 VUs)
- **Concurrent Users:** 1000
- **Duration:** 15 minutes
- **Purpose:** Stress testing, capacity planning, finding breaking points

## Baseline Metrics (Initial)

### Sync Relay Performance

| Metric | Light (100 VUs) | Medium (500 VUs) | Heavy (1000 VUs) | Target |
|--------|----------------|------------------|------------------|--------|
| **Requests/Second** | TBD | TBD | TBD | >100 RPS |
| **Response Time (p50)** | TBD | TBD | TBD | <200ms |
| **Response Time (p95)** | TBD | TBD | TBD | <500ms |
| **Response Time (p99)** | TBD | TBD | TBD | <1000ms |
| **Error Rate** | TBD | TBD | TBD | <5% |
| **Push Success Rate** | TBD | TBD | TBD | >95% |
| **Pull Success Rate** | TBD | TBD | TBD | >95% |

### CRDT Conflict Resolution

| Metric | Light (100 VUs) | Medium (500 VUs) | Heavy (1000 VUs) | Target |
|--------|----------------|------------------|------------------|--------|
| **Conflict Detection Rate** | TBD | TBD | TBD | >0% |
| **Conflict Resolution Time (p95)** | TBD | TBD | TBD | <2000ms |
| **Merge Success Rate** | TBD | TBD | TBD | >90% |
| **Concurrent Modifications/sec** | TBD | TBD | TBD | >50 |

### Mixed Workload

| Metric | Light (100 VUs) | Medium (500 VUs) | Heavy (1000 VUs) | Target |
|--------|----------------|------------------|------------------|--------|
| **User Journey Success Rate** | TBD | TBD | TBD | >90% |
| **Read Operations/sec** | TBD | TBD | TBD | >60 |
| **Write Operations/sec** | TBD | TBD | TBD | >30 |
| **Heavy Operations/sec** | TBD | TBD | TBD | >5 |
| **Avg Operation Time** | TBD | TBD | TBD | <1500ms |

## Alert Thresholds

Performance regressions that trigger alerts:

### Critical (Fail Build)
- Response time p95 increases by >50%
- Error rate exceeds 10%
- Success rate drops below 85%
- RPS decreases by >40%

### Warning (Review Required)
- Response time p95 increases by >20%
- Error rate exceeds 5%
- Success rate drops below 90%
- RPS decreases by >20%

## Infrastructure Details

### Test Environment
- **OS:** Windows 11 / Linux (CI)
- **Node Version:** 18.x
- **Memory:** 16GB
- **CPU:** 8 cores
- **Database:** IndexedDB (local-first)

### Sync Relay
- **Protocol Version:** 1.0.0
- **Batch Size:** 10 changes
- **Max Retries:** 3
- **Sync Interval:** 30 seconds

### CRDT Configuration
- **Strategy:** Last-Write-Wins (LWW)
- **Version Vector:** Per-device clocks
- **Conflict Resolution:** Automatic

## Historical Results

### Run 1 - 2026-01-18 (Baseline Establishment)
Status: **PENDING**

To establish baseline:
```bash
npm run load:test:all
```

Results will be recorded in `tests/load/results/` directory.

## Performance Regression Examples

### Example 1: Sync Latency Regression
**Date:** TBD
**Issue:** Push response time p95 increased from 400ms to 850ms
**Cause:** TBD
**Resolution:** TBD

### Example 2: CRDT Conflict Resolution Slowdown
**Date:** TBD
**Issue:** Conflict resolution time p95 increased from 1500ms to 3200ms
**Cause:** TBD
**Resolution:** TBD

## Capacity Planning

### Current Limits (Estimated)
- **Max Concurrent Users:** TBD (to be determined from heavy load tests)
- **Max RPS:** TBD
- **Breaking Point:** TBD VUs

### Scaling Recommendations
- **100-500 users:** Single sync relay instance sufficient
- **500-2000 users:** Consider horizontal scaling
- **2000+ users:** Implement load balancing and multiple relay instances

## Test Execution History

| Date | Test Type | VUs | Duration | RPS | P95 Latency | Error Rate | Notes |
|------|-----------|-----|----------|-----|-------------|------------|-------|
| TBD  | Light     | 100 | 5m       | TBD | TBD         | TBD        | Baseline |
| TBD  | Medium    | 500 | 10m      | TBD | TBD         | TBD        | Baseline |
| TBD  | Heavy     | 1000| 15m      | TBD | TBD         | TBD        | Baseline |

## Notes

1. **TBD Values:** Will be populated after first baseline test run
2. **Environment Variability:** Results may vary based on hardware and network conditions
3. **Mock Server:** Current tests use localStorage-backed mock sync server
4. **Production Targets:** Real production server may have different performance characteristics

## Next Steps

1. Run initial baseline tests
2. Record actual performance metrics
3. Set alert thresholds based on results
4. Integrate with CI/CD pipeline
5. Schedule regular load testing (nightly medium load tests)

## References

- Load test scenarios: `tests/load/scenarios/`
- Configuration files: `tests/load/config/`
- Test runner script: `scripts/run-load-tests.sh`
- CI workflow: `.github/workflows/load-tests.yml`
