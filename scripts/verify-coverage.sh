#!/bin/bash
# Coverage Verification Script

echo "🧪 EchoForge Coverage Verification"
echo "==================================
"

# Run coverage
echo "📦 Running coverage..."
npx nx run-many --target=coverage --all --skip-nx-cache

# Check results
echo ""
echo "✅ Verification complete!"
echo ""
echo "📊 Coverage files generated:"
ls -lh coverage/apps/backend-api/coverage-summary.json 2>/dev/null && echo "  ✓ Backend API" || echo "  ✗ Backend API (missing)"
ls -lh coverage/packages/storage-utils/coverage-summary.json 2>/dev/null && echo "  ✓ Storage Utils" || echo "  ✗ Storage Utils (missing)"
echo ""
echo "View HTML reports:"
echo "  open coverage/apps/backend-api/index.html"
echo "  open coverage/packages/storage-utils/index.html"
