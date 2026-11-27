/**
 * Test to verify that all dependencies are properly installed.
 * This test should pass after completing Task 2: Install Dependencies.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

describe('Dependency Verification', () => {
  const projectRoot = join(__dirname, '..');
  
  test('package.json has required dependencies', () => {
    const packageJson = readJson(join(projectRoot, 'package.json'));
    
    // Check for required dev dependencies (shared tooling such as
    // @types/node comes from the workspace root)
    expect(packageJson.devDependencies).toBeDefined();
    expect(packageJson.devDependencies['node-gyp']).toBeDefined();
    
    // Check for required dependencies
    expect(packageJson.dependencies).toBeDefined();
    expect(packageJson.dependencies['tslib']).toBeDefined();
  });

  test('binding.gyp exists', () => {
    const bindingGypPath = join(projectRoot, 'binding.gyp');
    expect(existsSync(bindingGypPath)).toBe(true);
  });

  test('C++ source directory exists', () => {
    const cppDir = join(projectRoot, 'src', 'cpp');
    expect(existsSync(cppDir)).toBe(true);
    
    // Check for key C++ files
    expect(existsSync(join(cppDir, 'addon.cc'))).toBe(true);
    expect(existsSync(join(cppDir, 'voice_cloner.cc'))).toBe(true);
  });

  test('Include directory exists', () => {
    const includeDir = join(projectRoot, 'include');
    expect(existsSync(includeDir)).toBe(true);
    expect(existsSync(join(includeDir, 'voice_cloner.h'))).toBe(true);
  });

  test('Python service files exist', () => {
    const pythonDir = join(projectRoot, 'src', 'python');
    expect(existsSync(pythonDir)).toBe(true);
    
    expect(existsSync(join(pythonDir, 'voice_cloning_service.py'))).toBe(true);
    expect(existsSync(join(pythonDir, 'voice_cloning_client.ts'))).toBe(true);
  });

  test('Installation documentation exists', () => {
    expect(existsSync(join(projectRoot, 'INSTALL.md'))).toBe(true);
    expect(existsSync(join(projectRoot, 'scripts', 'setup-macos.sh'))).toBe(true);
  });
});