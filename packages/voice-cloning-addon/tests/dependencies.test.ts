/**
 * Test to verify that all dependencies are properly installed.
 * This test should pass after completing Task 2: Install Dependencies.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Dependency Verification', () => {
  const projectRoot = join(__dirname, '..');
  
  test('f5-tts submodule exists', () => {
    const f5ttsPath = join(projectRoot, '..', '..', 'third_party', 'f5-tts');
    expect(existsSync(f5ttsPath)).toBe(true);
    
    // Check for key f5-tts files
    expect(existsSync(join(f5ttsPath, 'README.md'))).toBe(true);
    expect(existsSync(join(f5ttsPath, 'pyproject.toml'))).toBe(true);
  });

  test('package.json has required dependencies', () => {
    const packageJson = require(join(projectRoot, 'package.json'));
    
    // Check for required dev dependencies
    expect(packageJson.devDependencies).toBeDefined();
    expect(packageJson.devDependencies['@types/node']).toBeDefined();
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

  // This test is disabled by default because it requires system dependencies
  // Uncomment and run manually after installing system dependencies
  test.skip('System dependencies can be checked (manual test)', () => {
    // This test would check for system dependencies like:
    // - libsndfile
    // - portaudio
    // - CMake
    // - node-gyp
    // But it's skipped because it requires actual system installation
    
    // Example of what could be checked:
    // try {
    //   execSync('cmake --version', { stdio: 'pipe' });
    //   execSync('node-gyp --version', { stdio: 'pipe' });
    // } catch (error) {
    //   console.warn('System dependencies not fully installed. See INSTALL.md');
    // }
  });
});