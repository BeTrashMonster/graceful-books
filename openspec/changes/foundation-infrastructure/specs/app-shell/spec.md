# Application Shell Specification

**Capability:** app-shell

## Overview

This capability provides the main application container, navigation, and page routing. It includes the layout structure, navigation sidebar, route definitions, page loading states, error boundary handling, and the overall structure that holds the application together.

## ADDED Requirements

### Requirement: Application Layout Structure
The system SHALL provide a consistent application layout structure with header, navigation sidebar, main content area, and footer that adapts responsively across devices.

**ID:** TECH-002
**Priority:** High

#### Scenario: Desktop Layout with Persistent Sidebar

**GIVEN** the application is viewed on a desktop device (>1024px width)
**WHEN** a user navigates to any page
**THEN** the navigation sidebar is persistently visible on the left
**AND** the main content area takes the remaining horizontal space
**AND** the header spans the full width
**AND** the layout remains stable during navigation

#### Scenario: Mobile Layout with Collapsible Menu

**GIVEN** the application is viewed on a mobile device (<640px width)
**WHEN** a user navigates to any page
**THEN** the navigation sidebar is collapsed by default
**AND** a hamburger menu icon is visible in the header
**AND** tapping the icon opens the navigation drawer
**AND** the drawer overlays the main content
**AND** tapping outside or selecting an item closes the drawer

#### Scenario: Responsive Layout Transition

**GIVEN** a user resizes their browser window
**WHEN** the width crosses a breakpoint threshold
**THEN** the layout smoothly transitions between mobile and desktop modes
**AND** navigation state is preserved during transition
**AND** no content is lost or inaccessible

---

### Requirement: Navigation Routing System
The system SHALL implement client-side routing with URL-based navigation, browser history support, and deep linking capabilities.

**ID:** TECH-002
**Priority:** Critical

#### Scenario: Navigate to Route via Sidebar Link

**GIVEN** a user is on the dashboard page
**WHEN** they click "Transactions" in the sidebar
**THEN** the URL changes to `/transactions`
**AND** the transactions page content is loaded
**AND** the navigation updates to show "Transactions" as active
**AND** browser back button returns to dashboard

#### Scenario: Direct URL Access (Deep Linking)

**GIVEN** a user bookmarks or shares a direct URL like `/reports/profit-loss`
**WHEN** they navigate to that URL
**THEN** the application loads with the sidebar visible
**AND** the Profit & Loss report page is displayed
**AND** navigation shows "Reports" section as active
**AND** authentication is checked before rendering protected routes

#### Scenario: Invalid Route Handling

**GIVEN** a user navigates to a non-existent route like `/invalid-page`
**WHEN** the route is processed
**THEN** a 404 Not Found page is displayed
**AND** the page includes helpful navigation links
**AND** a friendly message suggests returning to dashboard
**AND** the URL remains `/invalid-page` for clarity

#### Scenario: Protected Route Authentication Check

**GIVEN** a user is not authenticated
**WHEN** they attempt to access `/dashboard`
**THEN** they are redirected to `/login`
**AND** the original URL is saved as redirect target
**AND** after successful login, they are returned to `/dashboard`

---

### Requirement: Page Loading States
The system SHALL provide appropriate loading states during navigation and data fetching with accessibility announcements.

**ID:** TECH-002
**Priority:** Medium

#### Scenario: Page Transition Loading State

**GIVEN** a user navigates to a new page with data to load
**WHEN** the route changes but data is still loading
**THEN** a loading indicator is displayed in the main content area
**AND** the indicator uses a calm pulse animation (respecting prefers-reduced-motion)
**AND** screen readers announce "Loading" via aria-live
**AND** the loading state is shown for minimum 300ms to avoid flashing

#### Scenario: Skeleton Screen for Content Loading

**GIVEN** a page with complex content is loading
**WHEN** the page is first rendered
**THEN** skeleton screens (placeholder shapes) are shown
**AND** the skeleton approximates the final layout
**AND** content smoothly replaces skeletons as it loads
**AND** the experience feels fast even if data takes time

#### Scenario: Loading Error State

**GIVEN** a page fails to load due to network or data error
**WHEN** the error occurs
**THEN** an error message is displayed instead of loading indicator
**AND** the message is user-friendly and non-technical
**AND** a "Try Again" button is provided
**AND** error details are logged for debugging (not shown to user)

---

### Requirement: Error Boundary Handling
The system SHALL implement React error boundaries to gracefully handle component errors without crashing the entire application.

**ID:** TECH-002
**Priority:** High

#### Scenario: Component Error Caught by Boundary

**GIVEN** a component throws an unhandled error during render
**WHEN** the error occurs
**THEN** the error boundary catches the error
**AND** a fallback UI is displayed instead of crashing
**AND** the error message is friendly: "Oops! Something unexpected happened."
**AND** the error is logged with stack trace for debugging
**AND** the rest of the application continues to function

#### Scenario: Reset Error Boundary

**GIVEN** an error boundary is showing a fallback UI
**WHEN** the user clicks "Try Again" or navigates to another route
**THEN** the error boundary resets
**AND** the component attempts to render again
**AND** if successful, normal UI is restored

#### Scenario: Critical Error Escalation

**GIVEN** the root-level error boundary catches an error
**WHEN** the error is critical and affects the entire app
**THEN** a full-page error UI is shown
**AND** the user is offered options to reload or contact support
**AND** local data is protected and not lost
**AND** the error is reported to error tracking service

---

### Requirement: Page Transitions and Animations
The system SHALL provide smooth page transitions that feel like turning pages in a friendly notebook, not clinical screen changes.

**ID:** TECH-002 (UX enhancement)
**Priority:** Low

#### Scenario: Smooth Page Transition Animation

**GIVEN** a user navigates between pages
**WHEN** the route changes
**THEN** the old page fades out smoothly
**AND** the new page fades in smoothly
**AND** the transition takes 200-300ms
**AND** the transition respects prefers-reduced-motion

#### Scenario: Reduced Motion Page Transition

**GIVEN** a user has prefers-reduced-motion enabled
**WHEN** they navigate between pages
**THEN** pages change instantly without fade/slide animations
**AND** all other functionality works identically

---

### Requirement: Breadcrumb Navigation
The system SHALL provide breadcrumb navigation for deep pages to help users understand their location and navigate back easily.

**ID:** TECH-002
**Priority:** Medium

#### Scenario: Breadcrumbs Show Current Path

**GIVEN** a user is on the Profit & Loss report page
**WHEN** the page is rendered
**THEN** breadcrumbs show "Dashboard > Reports > Profit & Loss"
**AND** each breadcrumb is clickable except the current page
**AND** clicking a breadcrumb navigates to that level
**AND** breadcrumbs are accessible via screen reader and keyboard

#### Scenario: Mobile Breadcrumb Simplification

**GIVEN** breadcrumbs are rendered on a mobile device
**WHEN** the viewport is narrow
**THEN** only the previous page and current page are shown
**AND** earlier levels are collapsed into "..." with dropdown
**AND** the breadcrumb trail remains accessible

## Technical Details

### Routing Library
- **Library:** React Router v6+ or similar
- **Features:**
  - Client-side routing
  - Nested routes
  - Route parameters
  - Query string parsing
  - Protected route HOCs

### Layout Components
```
AppShell
├── Header
│   ├── Logo
│   ├── Search (global)
│   └── UserMenu
├── Sidebar
│   ├── Navigation
│   ├── Phase indicator
│   └── Charity display
├── MainContent
│   ├── Breadcrumbs
│   ├── PageTitle
│   └── Content
└── Footer (optional)
```

### Route Structure
```
/
├── /login
├── /signup
├── /onboarding
│   ├── /onboarding/assessment
│   └── /onboarding/setup
├── /dashboard (protected)
├── /transactions (protected)
├── /reports (protected)
│   ├── /reports/profit-loss
│   ├── /reports/balance-sheet
│   └── /reports/cash-flow
├── /settings (protected)
└── /404
```

### Loading States
- **Page loading:** Skeleton screens or spinner
- **Component loading:** Inline spinners
- **Data loading:** Progress indicators
- **Background sync:** Subtle status indicator

### Error Boundaries
- **Root boundary:** Catches all unhandled errors
- **Page boundaries:** Isolate errors to page level
- **Component boundaries:** Protect critical components
- **Fallback UI:** User-friendly error messages

## Dependencies

- `ui-foundation` capability for navigation components
- `authentication` capability for route protection
- React Router or similar routing library
- React Error Boundary library or custom implementation

## User Experience

### Navigation Patterns
- Single-click navigation (no double-click required)
- Visual feedback on hover and active state
- Smooth transitions between pages
- Persistent state where appropriate

### Loading Messages (DISC-adapted)
- Default: "Loading..."
- D (Direct): "Getting your data..."
- I (Influencing): "Just a moment! Fetching your info..."
- S (Steady): "Taking a moment to load..."
- C (Conscientious): "Retrieving data..."

### Error Messages (Friendly)
- "Oops! Something unexpected happened. Don't worry - your data is safe."
- "We couldn't load that page. Let's try again."
- "Lost connection? We'll retry when you're back online."

## Testing

- Unit tests for routing logic
- Integration tests for navigation flows
- Error boundary tests for various error types
- Accessibility tests for navigation
- Keyboard navigation tests
- Mobile responsiveness tests
- Loading state tests
- Performance tests for route transitions
