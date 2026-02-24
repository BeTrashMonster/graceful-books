# Agent Review Checklist
**Ensure Quality & Consistency Across All Agent Work**

Every agent working on Graceful Books features MUST complete this checklist before marking work as complete.

---

## 🎯 Pre-Implementation Checklist

### Documentation Review
- [ ] Read ROADMAP.md section for assigned feature (complete acceptance criteria)
- [ ] Read IC_AND_J_IMPLEMENTATION_GUIDELINES.md (user stories + WCAG requirements)
- [ ] Read CLAUDE.md (project principles, tech stack, communication style)
- [ ] Read SPEC.md (if needed for architectural context)
- [ ] Review related feature docs in docs/ directory

### Dependencies Check
- [ ] Verify all dependencies are satisfied (Group A before B, etc.)
- [ ] Check if backend services exist (e.g., IC-0 validates Group I backends)
- [ ] Verify database schema includes required tables
- [ ] Confirm auth/access control requirements understood

---

## 💻 Implementation Checklist

### Code Quality
- [ ] Follow existing code patterns (check similar components first)
- [ ] Use TypeScript with proper types (no `any` without justification)
- [ ] Component files: One component per file, named exports
- [ ] Service files: Clear separation of concerns, single responsibility
- [ ] Proper error handling (try/catch, user-friendly messages)
- [ ] No hardcoded strings (use constants or i18n keys)
- [ ] No console.log in production code (use proper logging)

### Steadiness Communication Style
- [ ] Patient, supportive messaging ("You're making great progress!")
- [ ] Clear expectations ("Here's what happens next...")
- [ ] Never blame users ("Oops! Something unexpected happened" not "Invalid input")
- [ ] Step-by-step guidance (no overwhelming walls of text)
- [ ] Reassuring tone throughout

### Zero-Knowledge Architecture
- [ ] All financial data encrypted client-side (never plaintext to server)
- [ ] Use existing encryption utilities (src/utils/encryption.ts)
- [ ] Master key never transmitted (user-derived with Argon2id)
- [ ] View-keys used correctly (for J7 advisor access)
- [ ] Audit trail for all financial changes

### WCAG 2.1 AA Compliance (UI Components Only)
- [ ] Color contrast ≥ 4.5:1 for normal text (use WebAIM checker)
- [ ] Color contrast ≥ 3:1 for large text (18pt+ or 14pt+ bold)
- [ ] Color contrast ≥ 3:1 for UI components (buttons, borders)
- [ ] All functionality keyboard-accessible (Tab, Enter, Space, Esc, Arrow keys)
- [ ] No keyboard traps (user can navigate away from any element)
- [ ] Focus indicators visible (blue outline or similar)
- [ ] Focus order logical (top-to-bottom, left-to-right)
- [ ] Form labels visible (not just placeholders)
- [ ] Error messages clear and associated with fields (aria-describedby)
- [ ] Required fields marked (* or "required" label)
- [ ] Screen reader support (aria-label, aria-labelledby, role attributes)
- [ ] Status messages announced (aria-live regions)
- [ ] Modals have focus trap (Tab cycles within, Esc closes)
- [ ] Modals have aria-modal="true" and role="dialog"
- [ ] Images/icons have alt text
- [ ] Information not conveyed by color alone (use icons + text)

### Performance
- [ ] No unnecessary re-renders (use React.memo, useMemo, useCallback)
- [ ] Lazy loading for heavy components
- [ ] Debounce user input handlers (search, autocomplete)
- [ ] Pagination for large lists (don't render 1000+ items)
- [ ] Optimistic updates for user actions (instant feedback)

### Security
- [ ] Input validation (both client and server side)
- [ ] XSS prevention (sanitize user input, use DOMPurify)
- [ ] CSRF tokens for state-changing requests
- [ ] SQL injection prevention (use parameterized queries)
- [ ] Authentication checks (verify user before sensitive operations)
- [ ] Authorization checks (verify user has permission)

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] Test file created for every service/component
- [ ] Test file naming: `*.test.ts` or `*.test.tsx`
- [ ] Minimum 80% code coverage (aim for 90%+)
- [ ] Test happy paths (successful operations)
- [ ] Test error paths (failed operations, invalid input)
- [ ] Test edge cases (empty arrays, null values, extreme numbers)
- [ ] Test accessibility (keyboard navigation, screen reader labels)
- [ ] Use descriptive test names ("should create invoice with tax calculation")
- [ ] No skipped tests (`test.skip`) without documented reason

### Integration Tests (if applicable)
- [ ] Test feature workflows end-to-end
- [ ] Test component integration (parent + child)
- [ ] Test service integration (multiple services working together)
- [ ] Test database operations (CRUD, transactions)

### Manual Testing
- [ ] Feature works in dev environment
- [ ] Feature works without JavaScript errors (check console)
- [ ] Feature works on mobile screen sizes (responsive)
- [ ] Feature works with keyboard only (unplug mouse, test)
- [ ] Feature works with screen reader (NVDA on Windows, VoiceOver on Mac)

### Test Execution
- [ ] All tests passing locally: `npm test`
- [ ] No new TypeScript errors: `npm run typecheck`
- [ ] No new ESLint errors: `npm run lint`
- [ ] Build succeeds: `npm run build`

### Using test_fix_checklist.md
- [ ] If ANY tests fail, follow test_fix_checklist.md systematically
- [ ] Document root cause of failures
- [ ] Fix tests properly (don't skip or comment out)
- [ ] Re-run tests until 100% passing

---

## 📝 Documentation Checklist

### Code Documentation
- [ ] JSDoc comments for all exported functions/classes
- [ ] Inline comments for complex logic (not obvious code)
- [ ] README.md in component directory (usage examples)
- [ ] Type definitions documented (TypeScript interfaces with descriptions)

### Feature Documentation
- [ ] Implementation summary created (docs/[FEATURE]_IMPLEMENTATION_SUMMARY.md)
- [ ] User-facing guide created (if applicable)
- [ ] API documentation updated (if backend changes)
- [ ] Database schema changes documented

### Summary Document Contents
- [ ] What was built (overview)
- [ ] Files created/modified (list with line counts)
- [ ] Key features (bullet points)
- [ ] Acceptance criteria status (checked off)
- [ ] Test results (passing count)
- [ ] Next steps (integration, deployment)
- [ ] Known issues (if any)

---

## ✅ Acceptance Criteria Verification

### ROADMAP.md Criteria
- [ ] Find feature in ROADMAP.md
- [ ] Review all acceptance criteria checkboxes
- [ ] Verify EACH criterion is met
- [ ] Check off completed criteria in ROADMAP.md
- [ ] If ANY criteria cannot be met, document why and propose solution

### User Story Validation
- [ ] Review user story from IC_AND_J_IMPLEMENTATION_GUIDELINES.md
- [ ] Verify feature solves user's problem ("As a [user], I want [goal], so that [benefit]")
- [ ] Test feature from user's perspective
- [ ] Confirm UX flow is intuitive (no confusing steps)

---

## 🎨 UI/UX Checklist (for UI features)

### Design Consistency
- [ ] Matches existing component patterns (check src/components/)
- [ ] Uses design system colors/typography (CSS custom properties)
- [ ] Button styles consistent (primary, secondary, danger)
- [ ] Form layouts consistent (labels above inputs, spacing)
- [ ] Loading states implemented (spinners, skeletons)
- [ ] Empty states implemented (friendly messages, CTAs)
- [ ] Error states implemented (clear messages, recovery actions)

### Micro-Celebrations (Joy Opportunities)
- [ ] Success messages encouraging ("You're building real momentum!")
- [ ] Subtle animations for satisfaction (confetti for milestones)
- [ ] Progress indicators show advancement
- [ ] First-time experiences celebrated (first invoice, first reconciliation)

### Mobile Responsiveness
- [ ] Works on 320px width (iPhone SE)
- [ ] Works on 768px width (tablet)
- [ ] Works on 1920px width (desktop)
- [ ] Touch targets ≥ 44x44px (accessibility requirement)
- [ ] No horizontal scrolling (unless intentional, like tables)

---

## 🔗 Integration Checklist

### Database Integration
- [ ] Schema changes merged (version incremented)
- [ ] Migrations tested (up and down)
- [ ] Indexes added for query performance
- [ ] Foreign keys enforce referential integrity
- [ ] Soft deletes used (never hard delete financial records)

### Service Integration
- [ ] Service methods use correct interfaces
- [ ] Service methods handle errors gracefully
- [ ] Service methods return consistent response format
- [ ] Service methods log important operations

### Component Integration
- [ ] Component uses existing stores (Zustand)
- [ ] Component triggers correct actions
- [ ] Component handles loading/error states from stores
- [ ] Component cleans up on unmount (useEffect cleanup)

---

## 🚀 Pre-Completion Checklist

### Final Verification
- [ ] Feature works end-to-end (user can complete full workflow)
- [ ] No console errors or warnings
- [ ] No TypeScript errors
- [ ] All tests passing (100%)
- [ ] Code reviewed by self (read every line)
- [ ] Documentation complete and accurate
- [ ] ROADMAP.md acceptance criteria checked off

### Git Commit
- [ ] Stage only relevant files (no temp files, logs, or secrets)
- [ ] Commit message follows convention:
  - Format: `feat(scope): description` or `fix(scope): description`
  - Examples: `feat(billing): add Stripe subscription management`
  - Include "Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
- [ ] Commit includes all necessary files (code + tests + docs)
- [ ] No large binary files committed (use .gitignore)

### Handoff
- [ ] Summary document created (for next agent or user review)
- [ ] Known issues documented (if any)
- [ ] Next steps outlined (what comes after this feature)
- [ ] Agent ID saved (for resuming work if needed)

---

## 🔴 Blockers & Escalation

### When to Ask for Help
- [ ] Acceptance criteria unclear or contradictory → Ask user for clarification
- [ ] Dependency missing (backend service doesn't exist) → Flag blocker, propose solution
- [ ] Technical limitation (can't achieve requirement) → Document limitation, propose alternative
- [ ] Test failures can't be resolved after following test_fix_checklist.md → Ask for guidance

### How to Report Blockers
1. Describe what you're trying to achieve (acceptance criterion)
2. Describe what's blocking you (missing dependency, unclear requirement)
3. Propose solution or alternatives
4. Ask specific question

Example:
> "I'm implementing IC2 Stripe billing (acceptance criterion: 'Proration works for mid-month tier changes'). The Stripe API requires a proration_behavior parameter, but the ROADMAP doesn't specify if we should prorate immediately or at end of cycle. Should I use 'create_prorations' (immediate) or 'always_invoice' (end of cycle)?"

---

## ✨ Quality Standards Summary

**Every feature MUST meet ALL of these:**
1. ✅ All acceptance criteria from ROADMAP.md completed
2. ✅ All tests passing (100%)
3. ✅ WCAG 2.1 AA compliant (for UI features)
4. ✅ Zero-knowledge architecture maintained (for financial data)
5. ✅ Steadiness communication style used (all user-facing text)
6. ✅ Documentation complete (implementation summary)
7. ✅ Code quality high (TypeScript, error handling, security)
8. ✅ Performance acceptable (page load < 2s, actions < 500ms)

**If ANY of these are not met, work is NOT complete.**

---

## 📋 Checklist Template for Agent Use

Copy this to your summary document:

```markdown
## Agent Review Checklist Status

### Pre-Implementation
- [x] Documentation reviewed
- [x] Dependencies verified

### Implementation
- [x] Code quality standards met
- [x] Steadiness communication style used
- [x] Zero-knowledge architecture maintained
- [x] WCAG 2.1 AA compliance achieved
- [x] Performance optimized
- [x] Security best practices followed

### Testing
- [x] Unit tests written (coverage: XX%)
- [x] All tests passing (XXX/XXX)
- [x] Manual testing complete
- [x] Accessibility tested

### Documentation
- [x] Code documentation complete
- [x] Implementation summary created
- [x] User guide created (if applicable)

### Acceptance Criteria
- [x] All ROADMAP.md criteria met (XX/XX)
- [x] User story validated

### Integration
- [x] Database integration complete
- [x] Service integration complete
- [x] Component integration complete

### Pre-Completion
- [x] Feature works end-to-end
- [x] No console errors
- [x] Git commit prepared
- [x] Handoff documentation complete
```

---

**Remember:** Quality over speed. Take the time to do it right the first time.

**Last Updated:** 2026-01-19
