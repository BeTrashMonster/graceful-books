# Pull Request

## Description
<!-- Provide a clear and concise description of what this PR does -->

## Related Issue
<!-- Link to the related issue or roadmap item (e.g., "Closes #123" or "Implements D10") -->

## Type of Change
<!-- Mark the relevant option with an 'x' -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes, code improvements)
- [ ] Documentation update
- [ ] Test coverage improvement
- [ ] Performance improvement
- [ ] Infrastructure/build changes

## Roadmap Item
<!-- If this implements a roadmap item, specify which group and item (e.g., "Group D, Item D3") -->

## Implementation Details
<!-- Describe your implementation approach and any key technical decisions -->

## Testing Strategy
<!-- Describe how you tested this change -->
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed
- [ ] Tested offline functionality (if applicable)
- [ ] Tested with encryption enabled (if handling user data)

## Security Considerations
<!-- For features handling user data or authentication -->
- [ ] Sensitive data is encrypted before storage
- [ ] Zero-knowledge architecture principles followed
- [ ] Input validation implemented
- [ ] Audit logging added (for financial changes)
- [ ] No secrets or credentials in code
- [ ] XSS/injection attack prevention considered

## User Experience
<!-- For user-facing changes -->
- [ ] DISC-adapted messaging implemented (Steadiness approach)
- [ ] Progressive disclosure patterns followed
- [ ] Error messages are helpful and non-blaming
- [ ] Tooltips/help text added for accounting terms
- [ ] WCAG 2.1 AA accessibility verified
- [ ] Joy opportunities/delight details included

## Code Quality Checklist
- [ ] Code follows existing patterns and conventions
- [ ] TypeScript used properly (no `any` types)
- [ ] Error handling implemented
- [ ] Logging added for debugging
- [ ] SOLID principles followed
- [ ] Code comments added for complex logic
- [ ] No console.log statements left in code

## Testing Checklist
- [ ] All new code has test coverage
- [ ] All tests pass locally (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Test coverage meets requirements (>80%)
- [ ] Edge cases and error scenarios tested

## Documentation
- [ ] README updated (if needed)
- [ ] API/service interfaces documented
- [ ] Type definitions updated
- [ ] Code comments added for complex logic
- [ ] Breaking changes documented

## Performance
- [ ] No performance regressions
- [ ] Page load time acceptable (<2s)
- [ ] Transaction operations fast (<500ms)
- [ ] Report generation within targets

## Database Changes
<!-- If this PR includes database schema changes -->
- [ ] Migration script created (if applicable)
- [ ] Backward compatibility considered
- [ ] Encryption applied to sensitive fields
- [ ] Audit log structure maintained

## Screenshots/Videos
<!-- If this includes UI changes, add screenshots or videos showing the changes -->

## Deployment Notes
<!-- Any special considerations for deployment? -->

## Follow-up Work
<!-- List any known limitations or follow-up tasks needed -->

---

## Agent Review Checklist (if applicable)
<!-- For agent-based implementations, verify AGENT_REVIEW_CHECKLIST.md was followed -->
- [ ] Pre-implementation review completed
- [ ] Architecture review completed
- [ ] Test strategy review completed
- [ ] Code quality standards met
- [ ] Security & privacy review completed
- [ ] User experience standards met
- [ ] All acceptance criteria met
- [ ] Roadmap item marked complete

## Reviewer Notes
<!-- Space for reviewer comments and feedback -->
