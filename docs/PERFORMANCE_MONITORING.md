# Performance Monitoring

This document describes the performance monitoring infrastructure for Graceful Books, including bundle size tracking, build time benchmarking, test execution monitoring, and Lighthouse CI integration.

## Overview

Performance monitoring is integrated into the CI/CD pipeline to ensure the application meets performance targets and to detect regressions early. The system tracks multiple performance metrics over time and provides automated alerts when performance degrades.

## Performance Targets

Based on the project requirements in `CLAUDE.md`, Graceful Books has the following performance targets:

- **Page load:** <2 seconds
- **Transaction save:** <500ms
- **Report generation:** <5 seconds (standard), <30 seconds (complex)
- **Sync completion:** <5 seconds (typical changes)
- **Encryption/decryption:** Imperceptible to user
- **Bundle size:** <1MB total, <500KB JavaScript, <100KB CSS

## Components

### 1. Bundle Size Tracking

**Script:** `scripts/bundle-size-check.js`

Analyzes the built application and tracks bundle sizes across builds. Detects regressions when bundle size increases by more than 10%.

**Features:**
- Categorizes files by type (JS, CSS, assets)
- Compares with previous builds
- Enforces size limits
- Generates detailed markdown reports
- Posts size diff to PR comments

**Size Limits:**
- Total bundle: 1MB
- JavaScript: 500KB
- CSS: 100KB
- Assets: 400KB

**Usage:**
```bash
npm run build
npm run perf:bundle-size
```

**Output:**
- `.benchmarks/bundle-sizes.json` - Historical data
- `.benchmarks/bundle-size-report.md` - Latest report

### 2. Build Time Benchmarking

**Script:** `scripts/benchmark-build.js`

Measures the time it takes to build the application and tracks trends over time.

**Features:**
- Measures build duration
- Tracks memory usage
- Stores historical data (last 100 builds)
- Calculates statistics (avg, median, min, max)
- Detects regressions (>10% slower than median)

**Usage:**
```bash
npm run perf:benchmark-build
```

**Output:**
- `.benchmarks/build-times.json` - Historical build times

**Regression Detection:**
- Compares current build time against median of previous builds
- Fails if current build is >10% slower than median
- Requires at least 3 previous builds for regression detection

### 3. Test Execution Benchmarking

**Script:** `scripts/benchmark-tests.js`

Measures the time it takes to run the test suite and tracks performance over time.

**Features:**
- Measures test execution duration
- Tracks test counts (total, passed, failed, pending)
- Tracks memory usage
- Stores historical data (last 100 runs)
- Detects regressions (>10% slower than median)

**Usage:**
```bash
npm run perf:benchmark-tests
```

**Output:**
- `.benchmarks/test-times.json` - Historical test execution times

### 4. Lighthouse CI

**Config:** `lighthouserc.js`

Runs Lighthouse audits on built pages to measure Core Web Vitals and performance scores.

**Metrics Tracked:**
- **Core Web Vitals:**
  - First Contentful Paint (FCP): <2s
  - Largest Contentful Paint (LCP): <2.5s
  - Cumulative Layout Shift (CLS): <0.1
  - Total Blocking Time (TBT): <300ms
  - Speed Index: <3s
  - Time to Interactive (TTI): <3.5s

- **Performance Scores:**
  - Performance: >90
  - Accessibility: >90 (WCAG 2.1 AA compliance)
  - Best Practices: >90
  - SEO: >90

**Pages Tested:**
- Home page
- Dashboard
- Transactions
- Reports

**Usage:**
```bash
npm run build
npx @lhci/cli autorun
```

## CI/CD Integration

The performance monitoring workflow (`.github/workflows/performance.yml`) runs on every pull request and push to main/master.

### Jobs

1. **bundle-size** - Analyzes bundle sizes and posts report to PR
2. **build-benchmark** - Measures build time and detects regressions
3. **test-benchmark** - Measures test execution time and detects regressions
4. **lighthouse** - Runs Lighthouse audits and posts scores to PR
5. **performance-dashboard** - Generates overall performance dashboard (main/master only)
6. **performance-success** - Status check that all performance checks passed

### Artifacts

Performance data is stored as GitHub Actions artifacts:

- **bundle-analysis** - Bundle size data (90 days retention)
- **build-benchmarks** - Build time data (90 days retention)
- **test-benchmarks** - Test execution data (90 days retention)
- **lighthouse-results** - Lighthouse audit results (30 days retention)
- **performance-dashboard** - Overall performance dashboard (90 days retention)

### PR Comments

On pull requests, the following information is automatically posted as comments:

1. **Bundle Size Report** - Detailed breakdown of bundle sizes with comparison to previous build
2. **Lighthouse Scores** - Core Web Vitals and performance scores for each tested page

## Local Usage

You can run all performance checks locally:

```bash
# Run all performance checks
npm run perf:all

# Run individual checks
npm run perf:bundle-size
npm run perf:benchmark-build
npm run perf:benchmark-tests
```

## Interpreting Results

### Bundle Size Report

```markdown
| Category | Size | Limit | Status |
|----------|------|-------|--------|
| **Total** | 800.00KB | 1000KB | ✅ |
| JavaScript | 400.00KB | 500KB | ✅ |
| CSS | 80.00KB | 100KB | ✅ |
| Assets | 320.00KB | 400KB | ✅ |
```

- ✅ = Within limits
- ❌ = Exceeds limits

### Build Benchmark Results

```
📊 Build Benchmark Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Duration: 12.34s
Success: ✅
Timestamp: 2026-01-17T10:36:00Z
Branch: feature/new-feature
Commit: abc1234

📈 Historical Statistics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average: 11.50s
Median: 11.20s
Min: 10.50s
Max: 13.00s
Count: 15 builds

🔍 Regression Check:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Build time within expected range (12.34s vs median 11.20s)
```

### Lighthouse Report

The Lighthouse CI action posts a detailed report to PRs showing:
- Performance score
- Accessibility score
- Best practices score
- SEO score
- Core Web Vitals metrics
- Detailed recommendations for improvements

## Regression Detection

All performance checks use a 10% threshold for regression detection:

- **Bundle Size:** Fails if total bundle size increases by >10%
- **Build Time:** Fails if build time increases by >10% compared to median
- **Test Execution:** Fails if test execution time increases by >10% compared to median
- **Lighthouse:** Fails if any Core Web Vital metric exceeds threshold or score drops below minimum

## Troubleshooting

### Bundle Size Regression

If bundle size increases unexpectedly:

1. Review the "Largest Files" section in the bundle report
2. Use `npm run build` and inspect `dist/` directory
3. Consider code splitting or lazy loading
4. Check for accidentally bundled dependencies
5. Review vite.config.ts `manualChunks` configuration

### Build Time Regression

If build time increases:

1. Check if new dependencies were added
2. Review TypeScript compilation time
3. Check for complex transformations in vite.config.ts
4. Consider enabling caching for expensive operations

### Test Execution Regression

If test execution slows down:

1. Review recently added tests for inefficiencies
2. Check for slow async operations
3. Ensure proper cleanup in test teardown
4. Consider parallelizing test execution

### Lighthouse Failures

If Lighthouse scores drop:

1. Review the detailed Lighthouse report
2. Check for large images or unoptimized assets
3. Review JavaScript bundle size
4. Check for render-blocking resources
5. Ensure lazy loading is implemented for routes

## Best Practices

1. **Run performance checks before pushing** - Catch regressions early
2. **Review bundle reports on PRs** - Stay aware of size changes
3. **Investigate regressions immediately** - Don't let performance debt accumulate
4. **Set up local baseline** - Run benchmarks on your machine to understand local performance
5. **Monitor trends** - Look at historical data to identify gradual degradation

## Configuration

### Bundle Size Limits

Edit `scripts/bundle-size-check.js`:

```javascript
const SIZE_LIMIT_KB = {
  total: 1000, // 1MB total
  js: 500, // 500KB for all JS
  css: 100, // 100KB for all CSS
  assets: 400, // 400KB for other assets
};
```

### Lighthouse Budgets

Edit `lighthouserc.js`:

```javascript
assertions: {
  'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
  // ... more assertions
}
```

### Regression Threshold

The 10% threshold is defined in each benchmark script. To change:

```javascript
// In benchmark scripts
const threshold = stats.median * 1.1; // Change 1.1 to desired multiplier
```

## Data Storage

Performance data is stored in `.benchmarks/`:

- `bundle-sizes.json` - Bundle size history
- `build-times.json` - Build time history
- `test-times.json` - Test execution history
- `bundle-size-report.md` - Latest bundle size report
- `dashboard.md` - Performance dashboard (generated in CI)

**Note:** `.benchmarks/` is git-ignored but preserved in CI artifacts.

## Future Enhancements

Potential improvements to the performance monitoring system:

1. **Performance Dashboard Web UI** - Interactive charts showing trends
2. **Slack/Email Notifications** - Alert team of regressions
3. **Custom Metrics** - Track application-specific performance metrics
4. **Memory Profiling** - Detect memory leaks and high memory usage
5. **Network Performance** - Track API response times
6. **Database Query Performance** - Monitor IndexedDB operation times
7. **Encryption Performance** - Specific benchmarks for cryptographic operations

## References

- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Web Vitals](https://web.dev/vitals/)
- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
- [Performance Budgets](https://web.dev/performance-budgets-101/)

---

**Last Updated:** 2026-01-17
**Maintainer:** F9 Performance Monitoring Agent
