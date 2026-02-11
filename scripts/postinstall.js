#!/usr/bin/env node
/**
 * Postinstall script to apply patches after npm install
 * This ensures node_modules edits are preserved across installs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const patchDir = path.join(__dirname, 'patches');
const hasPatches = fs.existsSync(patchDir) && fs.readdirSync(patchDir).length > 0;

if (hasPatches) {
  console.log('🔧 Applying patches to node_modules...');
  try {
    execSync('npx patch-package', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Patches applied successfully');
  } catch (error) {
    console.warn('⚠️  Failed to apply patches. This may be expected on first install.');
    console.warn('Run "npx patch-package --create-patch <package-name>" to create patches after making edits.');
  }
} else {
  console.log('📦 No patches found. Skipping patch-package.');
}
