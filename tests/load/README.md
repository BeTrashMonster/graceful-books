# Load Testing Infrastructure

Comprehensive load testing suite for Graceful Books sync relay and CRDT conflict resolution.

## Quick Start

```bash
# Install k6
brew install k6  # macOS
choco install k6  # Windows
snap install k6  # Linux

# Run tests
npm run load:test:light   # 100 VUs, 5 min
npm run load:test:medium  # 500 VUs, 10 min
npm run load:test:heavy   # 1000 VUs, 15 min
```

## Directory Structure

```
tests/load/
├── scenarios/          # Test scenarios
│   ├── sync-relay.js           # Sync relay load tests
│   ├── crdt-conflicts.js       # CRDT conflict testing
│   └── mixed-workload.js       # Realistic user workflows
├── config/             # Test configurations
│   ├── light.json              # 100 VUs
│   ├── medium.json             # 500 VUs
│   └── heavy.json              # 1000 VUs
├── utils/              # Helper utilities
│   └── helpers.js              # Shared test utilities
├── results/            # Test results (gitignored)
└── baselines/          # Performance baselines
    └── BASELINE.md             # Documented baseline metrics
```

## Test Scenarios

### 1. Sync Relay (`sync-relay.js`)

Tests the sync relay server under concurrent load.

**Scenarios:**
- Concurrent push operations (40%)
- Concurrent pull operations (30%)
- Full sync operations (30%)

**Metrics:**
- Push/pull success rates
- Response time (p50, p95, p99)
- Changes accepted/rejected
- Throughput (RPS)

### 2. CRDT Conflicts (`crdt-conflicts.js`)

Tests CRDT conflict resolution with concurrent modifications.

**Scenarios:**
- Concurrent modifications to same entity (50%)
- Conflicting updates (30%)
- Rapid sequential updates (20%)

**Metrics:**
- Conflict detection rate
- Conflict resolution time
- Merge success rate
- Concurrent modifications/sec

### 3. Mixed Workload (`mixed-workload.js`)

Simulates realistic user behavior.

**User Types:**
- Light users: Occasional check-ins
- Active users: Regular usage
- Power users: Heavy batch operations

**Operations:**
- Dashboard loading (read-heavy)
- Transaction creation (write)
- Invoice management (mixed)
- Batch imports (heavy)

**Metrics:**
- User journey success rate
- Read vs write ratio
- Operation response times
- Resource utilization

## Test Profiles

### Light (100 VUs)

**Purpose:** PR validation, quick regression checks

| Metric | Target |
|--------|--------|
| Duration | 5 minutes |
| RPS | 200-400 |
| P95 Latency | <500ms |
| Error Rate | <5% |

### Medium (500 VUs)

**Purpose:** Nightly testing, comprehensive validation

| Metric | Target |
|--------|--------|
| Duration | 10 minutes |
| RPS | 1000-2000 |
| P95 Latency | <800ms |
| Error Rate | <5% |

### Heavy (1000 VUs)

**Purpose:** Stress testing, capacity planning

| Metric | Target |
|--------|--------|
| Duration | 15 minutes |
| RPS | 2000-4000 |
| P95 Latency | <1500ms |
| Error Rate | <10% |

## Running Tests

### Local Execution

1. **Build and start application:**
   ```bash
   npm run build
   npm run preview
   ```

2. **Run tests:**
   ```bash
   npm run load:test:light
   ```

3. **View results:**
   ```bash
   ls -lt tests/load/results/
   ```

### CI/CD Execution

- **Automatic:** Light tests on PR, medium tests nightly
- **Manual:** GitHub Actions > Load Tests > Run workflow

## Understanding Results

### Console Output

k6 shows real-time metrics:

```
✓ push: status is 200
✓ push: response time acceptable

http_reqs......................: 12543  41.81/s
http_req_duration..............: avg=245ms  p(95)=420ms
http_req_failed................: 2.34%
```

### Result Files

- **JSON:** `results/{profile}_{scenario}_{timestamp}.json`
- **Summary:** `results/{profile}_{scenario}_{timestamp}_summary.json`

### Key Metrics

| Metric | Description | Good | Bad |
|--------|-------------|------|-----|
| http_req_duration (p95) | Response time | <500ms | >1000ms |
| http_req_failed | Error rate | <5% | >10% |
| push_success_rate | Sync push success | >95% | <90% |
| merge_success_rate | CRDT merge success | >90% | <85% |

## Performance Baselines

Baseline metrics documented in `baselines/BASELINE.md`.

**Update baselines when:**
- Infrastructure changes
- Major optimizations
- Monthly review

## Troubleshooting

### k6 Not Found

```bash
# Install k6
brew install k6  # macOS
choco install k6  # Windows
snap install k6  # Linux
```

### Application Not Running

```bash
# Check port 3000
lsof -i :3000  # macOS/Linux
netstat -an | findstr 3000  # Windows

# Restart application
npm run build && npm run preview
```

### High Error Rates

**Possible causes:**
1. Application overloaded
2. Mock server limitations
3. Test too aggressive
4. Resource constraints

**Solutions:**
1. Reduce VU count
2. Increase ramp-up time
3. Check application logs
4. Monitor system resources

## Best Practices

1. **Before Testing:**
   - Establish clean baseline
   - Verify system resources
   - Close unnecessary apps

2. **During Testing:**
   - Monitor system metrics
   - Don't interfere
   - Let tests complete

3. **After Testing:**
   - Review all metrics
   - Compare with baseline
   - Document findings

## Advanced Usage

### Custom Environment Variables

```bash
BASE_URL=http://staging.example.com \
VUS_PEAK=200 \
npm run load:test:light
```

### Custom Scenarios

Create new scenarios in `scenarios/`:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
};

export default function() {
  // Custom test logic
}
```

### Integration with Monitoring

- **Grafana:** Real-time dashboards
- **Prometheus:** Metric storage
- **Datadog:** APM integration

## Documentation

**Comprehensive guide:** `docs/load-testing-guide.md`

**Topics covered:**
- Prerequisites
- Test profiles
- Running tests
- Interpreting results
- Regression detection
- Troubleshooting
- Best practices

## CI/CD Integration

**Workflow:** `.github/workflows/load-tests.yml`

**Triggers:**
- PR to main: Light profile
- Nightly: Medium profile
- Manual: Any profile

**Artifacts:**
- Test results (30-90 day retention)
- Summary reports
- PR comments with key metrics

## Monitoring and Alerts

### Performance Regression Alerts

**Critical (Build Fails):**
- Response time p95 >50% increase
- Error rate >10%
- RPS >40% decrease

**Warning (Review Required):**
- Response time p95 >20% increase
- Error rate >5%
- RPS >20% decrease

## Support

- **Documentation:** `docs/load-testing-guide.md`
- **k6 Docs:** https://k6.io/docs/
- **Issues:** GitHub Issues
- **Team:** #performance-testing

---

**Requirements:** I7 - Load Testing Infrastructure
**Dependencies:** H8 (Sync Relay), I1 (CRDT Conflict Resolution)
**Last Updated:** 2026-01-18
