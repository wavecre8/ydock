# Contributing to YamlDocDock

## Development Setup

### Prerequisites
- Node.js (v18 or later recommended)
- npm

### Installation
```bash
npm install
```

### Development Commands
```bash
# Build
npm run build

# Development Mode (Watch Mode)
npm run dev -- -c sample/setting.config.yml --watch

# Test
npm test

# Lint & Format
npm run lint
npm run format
```

## Tech Stack
- **TypeScript**: Core logic implementation
- **EJS**: HTML template engine
- **Tailwind CSS**: Styling (Loaded via CDN)
- **Vitest**: Unit testing framework

## Coding Standards
- **Linting**: We use ESLint + Prettier. You must pass `npm run lint` before committing.
- **Type Safety**: Avoid `any` where possible. Define and use appropriate types.

## Directory Structure
- `src/core/`: Core application logic
- `src/modes/`: Mode-specific logic (e.g., CloudFormation)
- `src/templates/`: HTML templates (EJS) and client-side JS
- `sample/`: Sample files for verification
