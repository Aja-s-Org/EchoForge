# Test Coverage Summary

This document provides an overview of test coverage across the EchoForge monorepo.

## Viewing Current Coverage

Coverage reports are automatically posted to pull requests. To view locally:

```bash
# Run tests with coverage
npm test

# View HTML reports
open coverage/apps/backend-api/index.html
open coverage/packages/storage-utils/index.html
```

## Test Statistics

| Package | Test Files | Key Focus Areas |
|---------|------------|-----------------|
| **backend-api** | 4 | API endpoints, validation, security, storage operations |
| **storage-utils** | 1 | Presigned URLs, AWS/GCP providers, error handling |

## Running Tests

### Local Development

Run all tests:
```bash
npm test
```

Run tests for a specific package:
```bash
npm test --workspace=apps/backend-api
# or
cd apps/backend-api && npm test
```

Run with coverage:
```bash
npm run test:coverage --workspace=apps/backend-api
```

### CI/CD Pipeline

Tests run automatically on:
- Pull requests (affected projects only)
- Pushes to main branch (all projects)

Coverage reports are posted as PR comments via `dkhunt27/action-nx-code-coverage@v3`.

### Test Coverage by Provider

## Coverage Report Locations

Coverage reports are generated in:
```
coverage/
├── apps/
│   └── backend-api/
│       ├── coverage-summary.json    # Machine-readable summary
│       ├── coverage-final.json      # Full coverage data
│       └── index.html               # Human-readable HTML report
└── packages/
    └── storage-utils/
        ├── coverage-summary.json
        ├── coverage-final.json
        └── index.html
```

View HTML reports:
```bash
open coverage/apps/backend-api/index.html
open coverage/packages/storage-utils/index.html
```

## Coverage Goals

### Targets
- **Lines/Statements:** 80%+ (enforced in CI)
- **Branches:** 80%+ (enforced in CI)
- **Functions:** 80%+ (enforced in CI)

### Philosophy
- ✅ All business logic must be tested
- ✅ All security validations must be tested
- ✅ All error paths must be covered
- ⚠️ Bootstrap/config code may be excluded (minimal logic)

## CI/CD Integration

### GitHub Actions Workflow

The test pipeline runs via `.github/workflows/build-test-common.yml`:

1. **Checkout code** (with main branch for Nx affected)
2. **Install dependencies** (`npm ci`)
3. **Build projects** (`npm run build`)
4. **Run tests with coverage** (`npm run test`)
5. **Post coverage to PR** (via `dkhunt27/action-nx-code-coverage@v3`)

### Coverage Action Configuration

```yaml
- name: Comment Code Coverage on PR
  uses: dkhunt27/action-nx-code-coverage@v3
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    no-coverage-ran: false
    coverage-folder: ./coverage          # Root coverage directory
    gist-processing: false
    color: green
    named-logo: jest
    hide-coverage-reports: false
    hide-unchanged: false
```

The action expects `coverage-summary.json` in each project's coverage directory, which Vitest generates automatically via the `json-summary` reporter.

## Test Framework Configuration

### Vitest Configuration

Both projects use Vitest with v8 coverage provider:

```typescript
// vite.config.ts
test: {
  globals: true,
  environment: 'node',
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'json-summary'],
    reportsDirectory: '../../coverage/{apps|packages}/{project}'
  }
}
```

### Project Configuration

Each project has two test targets in `project.json`:

**test** - Run tests without coverage (fast feedback)
```bash
npx nx test backend-api
```

**coverage** - Run tests with coverage reports (CI/pre-commit)
```bash
npx nx coverage backend-api
```

## Maintenance Guidelines

### Adding New Tests

1. **Place test files next to source files**: `feature.ts` → `feature.spec.ts`
2. **Follow naming convention**: `*.spec.ts` for unit tests, `*.test.ts` for integration tests
3. **Mock external dependencies**: AWS SDK, GCP SDK, network calls
4. **Test security validations**: Always test boundary conditions and malicious inputs
5. **Include edge cases**: Empty strings, max lengths, special characters, unicode

### Updating Coverage Thresholds

To enforce minimum coverage, add to `vite.config.ts`:

```typescript
coverage: {
  // ... existing config
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80
  }
}
```

### Skipping Coverage for Files

Add ignore comments:
```typescript
/* c8 ignore start */
function bootstrapCode() {
  // This won't be counted in coverage
}
/* c8 ignore stop */
```

## Related Documentation

- [Backend API README](./apps/backend-api/README.md) - API documentation and architecture
- [Storage Utils README](./packages/storage-utils/README.md) - Storage library usage and design
- [GitHub Workflows](./.github/workflows/build-test-common.yml) - CI/CD pipeline configuration
