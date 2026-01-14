# Graceful Books

[![codecov](https://codecov.io/gh/YOUR_USERNAME/graceful_books/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/graceful_books)
![Build Status](https://github.com/YOUR_USERNAME/graceful_books/workflows/CI/badge.svg)
![License](https://img.shields.io/badge/license-Proprietary-red)

An educational accounting platform for entrepreneurs who are numbers-adverse.

## Overview

Graceful Books helps small business owners build financial confidence through:

- **Zero-knowledge encryption** - Your data stays private with local-first architecture
- **Progressive disclosure** - Features reveal as you're ready, preventing overwhelm
- **Patient, supportive guidance** - Clear, step-by-step communication throughout
- **GAAP compliance** - Professional accounting beneath an accessible interface

## Business Phases

Users are guided through four phases based on their assessment:

1. **Stabilize** - Separate accounts, catch up on records
2. **Organize** - Consistent processes, proper categorization
3. **Build** - Advanced features, reporting, forecasting
4. **Grow** - Multi-entity, analytics, team collaboration

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Development Commands

```bash
# Start dev server (opens at http://localhost:3000)
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Testing
npm test                # Run tests in watch mode
npm run test:ui         # Open Vitest UI
npm run test:coverage   # Generate coverage report

# E2E Testing
npm run e2e             # Run Playwright tests
npm run e2e:ui          # Open Playwright UI

# Build
npm run build           # Build for production
npm run build:staging   # Build for staging environment
npm run build:production # Build for production environment
npm run preview         # Preview production build

# Deployment
npm run deploy:staging      # Deploy to staging (requires VERCEL_TOKEN)
npm run deploy:production   # Deploy to production (requires VERCEL_TOKEN)
```

## Deployment

### Staging Environment

Staging deploys automatically on push to `main` branch via GitHub Actions.

**View staging:** Check GitHub Actions logs or Vercel dashboard for staging URL.

**Manual deploy to staging:**
```bash
npm run deploy:staging
```

### Production Environment

Production deploys on release tags or manual workflow dispatch.

**Deploy via release:**
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

**Manual deploy to production:**
1. Go to GitHub Actions
2. Select "Deploy to Production" workflow
3. Run workflow with confirmation

**Documentation:**
- See [docs/STAGING_SETUP.md](docs/STAGING_SETUP.md) for initial setup
- See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full deployment guide

## Technology Stack

- **Frontend:** React 18+ with TypeScript
- **Build Tool:** Vite
- **UI Components:** Custom component library (built from scratch)
- **Local Database:** Dexie.js (IndexedDB wrapper)
- **Encryption:** Web Crypto API with argon2-browser for key derivation
- **State Management:** React Context + hooks
- **Styling:** CSS Modules with CSS custom properties
- **Testing:** Vitest + React Testing Library
- **E2E Testing:** Playwright

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

- Tests run automatically on every PR
- Build verification on every commit
- TypeScript type checking enforced
- ESLint standards enforced
- Security scanning for vulnerabilities
- PRs blocked from merge if checks fail

**Test locally before pushing:**
```bash
# Windows PowerShell
.\.github\workflows\test-ci-locally.ps1

# macOS/Linux
./.github/workflows/test-ci-locally.sh
```

See [.github/workflows/README.md](.github/workflows/README.md) for full CI/CD documentation.

## Project Structure

```
graceful_books/
├── .github/
│   └── workflows/       # CI/CD pipeline configuration
│       ├── ci.yml       # Main CI workflow
│       ├── README.md    # CI/CD documentation
│       └── QUICK_START.md # Quick reference guide
├── src/
│   ├── components/       # UI components
│   │   ├── ui/          # Base UI component library
│   │   ├── forms/       # Form-specific components
│   │   └── layout/      # Layout components
│   ├── lib/             # Core libraries
│   │   ├── db/          # Database layer (Dexie)
│   │   ├── crypto/      # Encryption utilities
│   │   └── sync/        # Sync relay client
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── services/        # Business logic services
│   │   ├── accounts/    # Account management
│   │   ├── transactions/# Transaction handling
│   │   ├── reports/     # Report generation
│   │   └── auth/        # Authentication
│   ├── store/           # State management
│   ├── pages/           # Page components
│   ├── assets/          # Static assets
│   ├── styles/          # Global styles
│   └── test/            # Test utilities
├── SPEC.md              # Full product specification
├── ROADMAP.md           # Implementation roadmap
└── CLAUDE.md            # Development guidance
```

## Architecture Highlights

### Zero-Knowledge Encryption
- All user financial data encrypted client-side before transmission
- Master key derived from passphrase using Argon2id
- Hierarchical key derivation for multi-user access
- Sync relay servers are "dumb pipes" with no decryption capability

### Local-First Data
- Primary data store is client-side (IndexedDB via Dexie)
- Full functionality works offline
- CRDTs for automatic conflict resolution
- Sync queue for changes made while offline

### Progressive Feature Disclosure
- All features technically available from day one
- UI shows only features relevant to user's current phase
- Hidden features accessible through intentional exploration

## Pricing

- $40/month ($5 goes to a charity of your choice)
- 14-day free trial

## License

Proprietary

## Documentation

### Project Documentation
- `SPEC.md` - Complete product requirements
- `ROADMAP.md` - Detailed implementation plan
- `CLAUDE.md` - Development guidance for AI agents

### Development Guides
- `docs/STAGING_SETUP.md` - Initial staging environment setup
- `docs/DEPLOYMENT.md` - Full deployment guide (staging and production)
- `docs/CODECOV_SETUP.md` - Code coverage tracking setup
- `.github/workflows/README.md` - CI/CD pipeline documentation
