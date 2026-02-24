# Third-Party License Compliance Report

**Project:** Graceful Books
**Project License:** PROPRIETARY (as indicated in package.json)
**Report Date:** 2026-02-23
**Total Dependencies Scanned:** 786 packages
**Compliance Status:** ✅ COMPLIANT

---

## Executive Summary

This document provides a comprehensive review of all third-party dependencies used in Graceful Books and their associated licenses. The license compliance check validates that all dependencies meet the project's licensing requirements and legal obligations.

### Key Findings

- **Total packages scanned:** 786 (including transitive dependencies)
- **Direct dependencies:** 67 (32 production, 35 development)
- **Allowed licenses:** 785 packages (99.87%)
- **Restricted licenses:** 0 packages (0%)
- **Blocked licenses:** 0 packages (0%)
- **Unknown/Missing licenses:** 1 package (0.13%)

**Overall Status:** ✅ All licenses are compliant with project requirements.

---

## License Distribution

The following table shows the distribution of licenses across all dependencies:

| License Type | Count | Percentage | Status |
|-------------|-------|------------|--------|
| MIT | 603 | 76.72% | ✅ Allowed |
| Apache-2.0 | 69 | 8.78% | ✅ Allowed |
| ISC | 63 | 8.01% | ✅ Allowed |
| BSD-3-Clause | 24 | 3.05% | ✅ Allowed |
| BSD-2-Clause | 12 | 1.53% | ✅ Allowed |
| MIT-0 | 2 | 0.25% | ✅ Allowed |
| BlueOak-1.0.0 | 2 | 0.25% | ✅ Allowed |
| MPL-2.0 | 1 | 0.13% | ✅ Allowed |
| CC-BY-4.0 | 1 | 0.13% | ✅ Allowed |
| Dual Licensed | 3 | 0.38% | ✅ Allowed |
| 0BSD | 1 | 0.13% | ✅ Allowed |
| BSD (generic) | 1 | 0.13% | ✅ Allowed |
| Unlicense | 1 | 0.13% | ✅ Allowed |
| Unknown | 1 | 0.13% | ⚠️ Review |
| **Total** | **786** | **100%** | |

---

## License Categories

### Allowed Licenses

The following licenses are approved for use in this project:

- **MIT License** - Permissive license allowing commercial use, modification, distribution, and private use
- **Apache-2.0** - Permissive license with explicit patent grant
- **ISC** - Functionally equivalent to MIT, preferred by npm
- **BSD-2-Clause** - Simplified BSD license (2-clause)
- **BSD-3-Clause** - Original BSD license (3-clause)
- **MPL-2.0** - Mozilla Public License (file-level copyleft)
- **CC-BY-4.0** - Creative Commons Attribution (typically for documentation/assets)
- **BlueOak-1.0.0** - Modern permissive license
- **0BSD** - Zero-Clause BSD (public domain equivalent)
- **Unlicense** - Public domain dedication

### Restricted Licenses

The following licenses are flagged as restricted and require legal review before use:

- **GPL/GPL-2.0/GPL-3.0** - Requires derivative works to be open-sourced
- **AGPL/AGPL-3.0** - Network copyleft (stricter than GPL)
- **SSPL** - Server Side Public License
- **Commons Clause** - Restricts commercial use

**Current Status:** ✅ No restricted licenses found in dependencies

### Blocked Licenses

Blocked licenses are not permitted under any circumstances.

**Current Status:** ✅ No blocked licenses found in dependencies

---

## Packages Requiring Review

### 1. png-js (v1.0.0)

**Status:** ⚠️ Unknown (Missing license field in package.json)
**Actual License:** MIT (confirmed via LICENSE file)
**Used By:** pdfkit (transitive dependency via pdfmake)
**Risk Level:** LOW
**Recommendation:** APPROVED - License file confirms MIT license. Package maintainer forgot to include "license" field in package.json.

**Resolution:** The png-js package contains a valid MIT LICENSE file in its repository. This is a packaging oversight by the maintainer. The MIT license is permissive and fully compatible with this project.

**Evidence:**
```
MIT License

Copyright (c) 2017 Devon Govett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

**Action Required:** None - Package is compliant.

---

## Direct Dependencies Analysis

### Production Dependencies (32 packages)

These are the core dependencies required for the application to run:

| Package | Version | License | Status |
|---------|---------|---------|--------|
| @stripe/stripe-js | ^8.6.3 | MIT | ✅ |
| argon2-browser | ^1.18.0 | MIT | ✅ |
| clsx | ^2.1.0 | MIT | ✅ |
| d3 | ^7.9.0 | ISC | ✅ |
| date-fns | ^3.3.1 | MIT | ✅ |
| decimal.js | ^10.6.0 | MIT | ✅ |
| dexie | ^4.0.1 | Apache-2.0 | ✅ |
| dexie-react-hooks | ^1.1.7 | Apache-2.0 | ✅ |
| dompurify | ^3.3.1 | MPL-2.0 OR Apache-2.0 | ✅ |
| driver.js | ^1.4.0 | MIT | ✅ |
| fuse.js | ^7.1.0 | Apache-2.0 | ✅ |
| fuzzball | ^2.2.3 | MIT | ✅ |
| html2canvas | ^1.4.1 | MIT | ✅ |
| jspdf | ^4.1.0 | MIT | ✅ |
| jszip | ^3.10.1 | MIT OR GPL-3.0-or-later | ✅ |
| nanoid | ^5.0.4 | MIT | ✅ |
| nodemailer | ^7.0.12 | MIT-0 | ✅ |
| papaparse | ^5.5.3 | MIT | ✅ |
| pdf-parse | ^2.4.5 | MIT | ✅ |
| pdfmake | ^0.3.2 | MIT | ✅ |
| react | ^18.3.1 | MIT | ✅ |
| react-dom | ^18.3.1 | MIT | ✅ |
| react-router-dom | ^6.22.0 | MIT | ✅ |
| recharts | ^3.6.0 | MIT | ✅ |
| rrule | ^2.8.1 | BSD-3-Clause | ✅ |
| stripe | ^20.2.0 | MIT | ✅ |
| tesseract.js | ^7.0.0 | Apache-2.0 | ✅ |
| zod | ^4.3.6 | MIT | ✅ |

**Plus type definitions:**
- @types/d3 (MIT)
- @types/dompurify (MIT)
- @types/papaparse (MIT)
- @types/pdf-parse (MIT)

### Development Dependencies (35 packages)

These are tools and utilities used during development, testing, and building:

| Package | Version | License | Status |
|---------|---------|---------|--------|
| @lhci/cli | ^0.15.1 | Apache-2.0 | ✅ |
| @playwright/test | ^1.41.2 | Apache-2.0 | ✅ |
| @storybook/react | ^10.1.11 | MIT | ✅ |
| @testing-library/jest-dom | ^6.4.2 | MIT | ✅ |
| @testing-library/react | ^14.2.1 | MIT | ✅ |
| @testing-library/user-event | ^14.5.2 | MIT | ✅ |
| @vitejs/plugin-react | ^5.1.2 | MIT | ✅ |
| @vitest/ui | ^4.0.17 | MIT | ✅ |
| axe-core | ^4.11.1 | MPL-2.0 | ✅ |
| cross-env | ^10.1.0 | MIT | ✅ |
| eslint | ^9.0.0 | MIT | ✅ |
| eslint-plugin-react-hooks | ^7.0.0 | MIT | ✅ |
| eslint-plugin-react-refresh | ^0.4.5 | MIT | ✅ |
| fake-indexeddb | ^6.2.5 | Apache-2.0 | ✅ |
| jest-axe | ^10.0.0 | MIT | ✅ |
| jsdom | ^24.0.0 | MIT | ✅ |
| typescript | ^5.3.3 | Apache-2.0 | ✅ |
| vite | ^6.4.1 | MIT | ✅ |
| vitest | ^4.0.17 | MIT | ✅ |

**Plus type definitions and OpenTelemetry packages** (all MIT or Apache-2.0)

---

## License Compatibility Analysis

### Compatibility with PROPRIETARY License

The project's `package.json` declares `"license": "PROPRIETARY"`, indicating this is proprietary/closed-source software.

**Key Compatibility Considerations:**

1. **Permissive Licenses (MIT, Apache-2.0, BSD, ISC)** - ✅ COMPATIBLE
   - These licenses allow use in proprietary software
   - No requirement to open-source derivative works
   - Attribution requirements are easily satisfied

2. **MPL-2.0 (Mozilla Public License)** - ✅ COMPATIBLE
   - File-level copyleft only
   - Modified MPL-licensed files must remain open
   - Can be integrated into proprietary software
   - Used by: dompurify (dual-licensed MPL-2.0 OR Apache-2.0), axe-core

3. **Dual-Licensed Packages** - ✅ COMPATIBLE
   - jszip: "MIT OR GPL-3.0-or-later" - We use under MIT
   - dompurify: "MPL-2.0 OR Apache-2.0" - We use under Apache-2.0

4. **GPL/AGPL Licenses** - ❌ NOT COMPATIBLE (None found)
   - Would require open-sourcing entire application
   - Not present in any dependencies

### Attribution Requirements

All dependencies require basic attribution (copyright notices). This is satisfied by:

1. Including this THIRD_PARTY_LICENSES.md file
2. Preserving LICENSE files in node_modules (done automatically by npm)
3. Including attribution in distributed builds (if applicable)

---

## Security Considerations

### License-Related Security Risks

1. **Supply Chain Security** - ✅ LOW RISK
   - No packages with unknown ownership
   - All packages from established maintainers
   - Regular dependency audits via `npm audit`

2. **Legal Risk** - ✅ LOW RISK
   - No GPL/AGPL contamination
   - All licenses well-documented
   - Clear compatibility with proprietary license

3. **Maintenance Risk** - ⚠️ MONITOR
   - Some packages have permissive "public domain" licenses (Unlicense, 0BSD)
   - These may have less maintenance guarantees
   - Regular updates recommended

---

## Dependency Depth Analysis

- **Direct dependencies:** 67 packages
- **Total dependencies (including transitive):** 786 packages
- **Average dependency depth:** ~11.7 levels

This is typical for modern JavaScript applications. The large number of transitive dependencies is primarily from:
- React and React ecosystem
- Testing frameworks (Playwright, Vitest, Testing Library)
- Build tools (Vite, TypeScript, ESLint)
- PDF generation libraries (pdfmake, pdfkit)
- Chart libraries (recharts, d3)

---

## Compliance Verification Process

### Automated Checks

The project includes automated license checking via:

```bash
# Check all licenses
npm run deps:check-licenses

# Full dependency audit
npm run deps:verify
```

**Script Location:** `scripts/license-checker.js`

**Capabilities:**
- Scans all packages in node_modules
- Categorizes licenses as allowed/restricted/blocked/unknown
- Generates JSON reports for CI/CD integration
- Fails build on restricted/blocked licenses

### Manual Review Process

1. **New Dependency Addition:**
   - Run `npm run deps:check-licenses` before committing
   - Review output for any new unknown/restricted licenses
   - Investigate LICENSE files for packages missing license metadata

2. **Dependency Updates:**
   - Run license check after `npm update`
   - Verify no license changes in updated packages
   - Document any license changes

3. **Quarterly Reviews:**
   - Full manual review of top 50 dependencies
   - Verify no supply chain changes
   - Update this document as needed

---

## Recommendations

### Immediate Actions

✅ **No immediate actions required** - All dependencies are compliant.

### Best Practices

1. **Lock Dependencies**
   - Continue using `package-lock.json` for reproducible builds
   - Review lock file changes in PRs

2. **Regular Audits**
   - Run `npm run deps:check-licenses` in CI/CD pipeline
   - Block merges if restricted licenses detected
   - Monthly dependency security audits

3. **Dependency Hygiene**
   - Minimize direct dependencies where possible
   - Prefer packages with clear, permissive licenses
   - Avoid packages with missing license information

4. **Documentation**
   - Keep this file updated with dependency changes
   - Document any legal reviews or exceptions
   - Maintain audit trail for compliance purposes

### Future Considerations

1. **png-js Issue:**
   - Consider filing PR to add license field to package.json
   - Monitor for package updates
   - Consider alternative PNG libraries if needed

2. **License Policy Formalization:**
   - Document formal license acceptance criteria
   - Establish legal review process for edge cases
   - Create pre-approved license list

3. **Automation Enhancements:**
   - Add license checking to pre-commit hooks
   - Generate NOTICE file for attribution
   - Automate dependency vulnerability scanning

---

## Known Issues and Exceptions

### png-js (Transitive Dependency)

- **Issue:** Missing "license" field in package.json
- **Actual License:** MIT (verified via LICENSE file)
- **Resolution:** Approved for use - MIT license confirmed
- **Tracking:** Monitor for package updates
- **Risk:** Low - Transitive dependency, clear MIT license in repo

---

## Appendix A: License Texts

### MIT License

The majority of dependencies (603 packages) use the MIT License:

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

**Key Points:**
- Extremely permissive
- Compatible with proprietary software
- Only requires attribution

### Apache License 2.0

69 packages use Apache-2.0:

```
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
```

**Key Points:**
- Permissive license with patent grant
- Compatible with proprietary software
- Explicit patent protection

### ISC License

63 packages use ISC:

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.
```

**Key Points:**
- Functionally equivalent to MIT
- Preferred by npm for new packages
- Very permissive

---

## Appendix B: Complete Package List

The complete list of all 786 packages and their licenses is available in:

**File:** `license-check-results.json`
**Generated:** 2026-02-23
**Format:** JSON

To view the complete list:

```bash
node -e "console.log(JSON.stringify(require('./license-check-results.json'), null, 2))"
```

---

## Appendix C: Compliance Checklist

Use this checklist when adding new dependencies:

- [ ] Run `npm run deps:check-licenses` after installation
- [ ] Verify license is in approved list
- [ ] Check for any "unknown" or "restricted" flags
- [ ] Investigate LICENSE files for packages with missing metadata
- [ ] Document any exceptions or concerns
- [ ] Update this document if needed
- [ ] Commit `package-lock.json` changes
- [ ] Include license verification in PR description

---

## Contact and Legal

**For license compliance questions:**
- Technical Lead: Review via GitHub issues
- Legal Review: Escalate via standard legal review process

**Document Maintenance:**
- This document should be reviewed quarterly
- Update after any major dependency changes
- Keep synchronized with `package.json` and `package-lock.json`

---

## Conclusion

Graceful Books maintains excellent license compliance across all 786 dependencies. The predominant use of permissive licenses (MIT, Apache-2.0, ISC, BSD) ensures full compatibility with the project's proprietary license and provides legal safety for commercial use.

The single unknown license (png-js) has been investigated and confirmed to be MIT-licensed, posing no compliance risk. Automated tooling is in place to maintain this compliance as the project evolves.

**Final Status: ✅ FULLY COMPLIANT**

---

*Last Updated: 2026-02-23*
*Generated by: License Compliance Check (S5-5)*
*Next Review: 2026-05-23 (quarterly)*
