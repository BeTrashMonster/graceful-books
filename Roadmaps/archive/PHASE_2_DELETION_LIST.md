# Phase 2: DISC Infrastructure Deletion List

**DO NOT DELETE THESE FILES YET** - This list is prepared for Phase 2 cleanup after Phase 1 changes are verified.

## Summary
Total files to delete: 24 infrastructure files + their test files

## Core DISC Assessment System (5 files)
**Location:** `src/features/disc/`

- [ ] `src/features/disc/assessment.ts` - DISC assessment logic
- [ ] `src/features/disc/assessment.test.ts` - Assessment tests
- [ ] `src/features/disc/questions.ts` - DISC questionnaire
- [ ] `src/features/disc/scoring.ts` - DISC scoring algorithm
- [ ] `src/features/disc/scoring.test.ts` - Scoring tests

**Command to delete:**
```bash
rm -rf src/features/disc/
```

## DISC UI Components (4 files)
**Location:** `src/components/disc/`

- [ ] `src/components/disc/DISCAssessment.tsx` - Assessment form component
- [ ] `src/components/disc/DISCAssessment.test.tsx` - Component tests
- [ ] `src/components/disc/DISCBadge.tsx` - Badge showing user's DISC type
- [ ] `src/components/disc/DISCResults.tsx` - Results display component

**Command to delete:**
```bash
rm -rf src/components/disc/
```

## Message Adaptation System (5 files)
**Location:** `src/features/messaging/`

- [ ] `src/features/messaging/adaptiveMessages.ts` - DISC message adaptation logic
- [ ] `src/features/messaging/adaptiveMessages.test.ts` - Adaptation tests
- [ ] `src/features/messaging/messageLibrary.ts` - Library of DISC-adapted messages
- [ ] `src/features/messaging/useAdaptiveMessage.ts` - React hook for adaptive messages
- [ ] `src/features/messaging/index.ts` - Feature exports

**Command to delete:**
```bash
rm -rf src/features/messaging/
```

## Adaptive UI Components (5 files)
**Location:** `src/components/messaging/`

- [ ] `src/components/messaging/AdaptiveHelp.tsx` - Help text that adapts to DISC
- [ ] `src/components/messaging/AdaptiveHelp.test.tsx` - Component tests
- [ ] `src/components/messaging/AdaptiveToast.tsx` - Toast notifications adapted to DISC
- [ ] `src/components/messaging/AdaptiveToast.test.tsx` - Component tests
- [ ] `src/components/messaging/index.ts` - Component exports

**Command to delete:**
```bash
rm -rf src/components/messaging/
```

## Database & Storage (3 files)

- [ ] `src/db/schema/discProfile.schema.ts` - DISC profile database schema
- [ ] `src/store/discProfiles.ts` - DISC profile data access layer
- [ ] `src/store/discProfiles.test.ts` - Store tests

**Commands to delete:**
```bash
rm src/db/schema/discProfile.schema.ts
rm src/store/discProfiles.ts
rm src/store/discProfiles.test.ts
```

## Utilities (2 files)

- [ ] `src/utils/discMessageAdapter.ts` - Message adaptation utility
- [ ] `src/utils/discMessageAdapter.test.ts` - Utility tests

**Commands to delete:**
```bash
rm src/utils/discMessageAdapter.ts
rm src/utils/discMessageAdapter.test.ts
```

## Test Files Related to Email System (to be updated or deleted)

These test files were written for the DISC-adapted email system and need to be rewritten for Steadiness-only approach:

- [ ] `src/services/email/emailTemplates.test.ts` - Rewrite tests for single template
- [ ] `src/services/email/emailContentGenerator.test.ts` - Remove DISC parameter tests
- [ ] `src/services/email/emailPreviewService.test.ts` - Remove DISC preview tests
- [ ] `src/services/email/emailRenderer.test.ts` - Update if needed
- [ ] `src/services/email/emailSchedulingService.test.ts` - Update if needed

**Note:** These should be rewritten rather than deleted to maintain test coverage.

## Other Test Files Mentioning DISC

These test files may have incidental DISC references that should be reviewed:

- [ ] `src/__tests__/integration/groupD.integration.test.ts` - Review for DISC references
- [ ] `src/services/reconciliationService.additional.test.ts` - Check for DISCREPANCIES vs DISC
- [ ] `src/services/coaWizardService.additional.test.ts` - Review for DISC references
- [ ] `src/data/industryTemplates.test.ts` - Review for DISC references

## Verification Steps After Deletion

1. **Run TypeScript compiler:**
   ```bash
   npm run type-check
   # or
   tsc --noEmit
   ```

2. **Run tests:**
   ```bash
   npm test
   ```

3. **Search for remaining DISC references:**
   ```bash
   grep -r "import.*DISC" src/
   grep -r "discType" src/
   grep -r "disc_profile" src/
   ```

4. **Verify imports are updated:**
   - Check that no files import from deleted directories
   - Verify all DISC-related type imports are removed

## Notes

- **IMPORTANT:** The string "DISCREPANCIES" in reconciliation files is NOT related to DISC profiling - do not modify those references
- These deletions should only be performed AFTER Phase 1 changes are verified and tested
- Create a backup or git commit before performing Phase 2 deletions
- Consider running the full test suite before and after deletion to catch any missed references
