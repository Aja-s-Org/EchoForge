# Testing Quick Start Guide

Quick reference for running tests in the EchoForge monorepo.

## 🚀 Run All Tests

```bash
# Run all tests (affected by changes)
npm test

# Run all tests with coverage
npx nx run-many --target=coverage --all
```

## 📦 Run Tests for Specific Package

### Backend API
```bash
# From root
npx nx test backend-api
npx nx coverage backend-api

# From package directory
cd apps/backend-api
npm test
npm run test:coverage
```

### Storage Utils
```bash
# From root
npx nx test @echoforge/storage-utils
npx nx coverage @echoforge/storage-utils

# From package directory
cd packages/storage-utils
npm test
npm run test:coverage
```

## 📊 View Coverage Reports

```bash
# Open HTML coverage reports
open coverage/apps/backend-api/index.html
open coverage/packages/storage-utils/index.html
```

## 🔍 Run Tests in Watch Mode (Development)

```bash
# Backend API
cd apps/backend-api
npx vitest

# Storage Utils
cd packages/storage-utils
npx vitest
```

## 🐛 Debug Tests in VS Code

Add this launch configuration to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npx",
  "runtimeArgs": ["vitest", "--run", "--no-coverage"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## ✅ Pre-Commit Checklist

Before committing:
```bash
# 1. Run tests
npm test

# 2. Check coverage (optional but recommended)
npx nx coverage backend-api

# 3. Lint
npm run lint

# 4. Format
npm run prettier:fix
```

## 📝 Writing New Tests

### File Naming
- Place tests next to source files: `feature.ts` → `feature.spec.ts`
- Use `.spec.ts` for unit tests
- Use `.test.ts` for integration tests

### Test Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup
    vi.clearAllMocks();
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Mocking External Dependencies
```typescript
// Mock module
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  HeadObjectCommand: vi.fn(),
}));

// Mock function
const mockFn = vi.fn().mockResolvedValue('result');
```

## 🎯 Coverage Goals

| Metric | Target | Notes |
|--------|--------|-------|
| Lines | 80%+ | All business logic must be covered |
| Statements | 80%+ | All business logic must be covered |
| Functions | 80%+ | Excluding barrel exports |
| Branches | 80%+ | All error paths must be tested |

**View current coverage:**
```bash
npm test
open coverage/apps/backend-api/index.html
```

## 🔧 Troubleshooting

### Tests Failing After Dependency Update
```bash
# Clear Nx cache
npx nx reset

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Run tests again
npm test
```

### Coverage Reports Not Generating
```bash
# Ensure @vitest/coverage-v8 is installed
npm install --save-dev @vitest/coverage-v8

# Check vite.config.ts has coverage configuration
# Should include: reporter: ['text', 'json', 'html', 'json-summary']
```

### Tests Running Slowly
```bash
# Run tests in parallel (default)
npx nx run-many --target=test --parallel

# Increase parallel workers (if needed)
npx nx run-many --target=test --parallel=4
```

### Mocks Not Working
```bash
# Ensure vi.mock() is called BEFORE imports
# BAD:
import { S3Client } from '@aws-sdk/client-s3';
vi.mock('@aws-sdk/client-s3');

# GOOD:
vi.mock('@aws-sdk/client-s3');
import { S3Client } from '@aws-sdk/client-s3';
```

## 📚 More Information

- [Full Test Coverage Documentation](./TEST_COVERAGE.md)
- [Backend API Documentation](./apps/backend-api/README.md)
- [Storage Utils Documentation](./packages/storage-utils/README.md)
- [Vitest Documentation](https://vitest.dev/)
- [NX Testing Documentation](https://nx.dev/recipes/running-tasks/run-tests)

## 🤝 Contributing

When adding new features:
1. ✅ Write tests FIRST (TDD approach recommended)
2. ✅ Ensure 80%+ coverage on new code
3. ✅ Test security validations (path traversal, injection, etc.)
4. ✅ Test error cases and edge cases
5. ✅ Update this documentation if needed

## ⚡ CI/CD

Tests run automatically on:
- **Pull Requests** - Only affected projects
- **Main Branch** - All projects

Coverage reports are posted as PR comments automatically.

---

**Questions?** Check the full [TEST_COVERAGE.md](./TEST_COVERAGE.md) or reach out to the team.
