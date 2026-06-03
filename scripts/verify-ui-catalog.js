/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');

try {
  // Get git porcelain status to identify modified, added, deleted, or renamed files
  const stdout = execSync('git status --porcelain', { encoding: 'utf8' });
  const lines = stdout.split('\n');

  const modifiedFiles = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // Status occupies the first 2 characters, followed by a space
    const filePart = line.substring(3).trim();
    if (filePart.includes(' -> ')) {
      // Handles git renames, e.g., "R old_path -> new_path"
      const parts = filePart.split(' -> ');
      modifiedFiles.push(parts[0], parts[1]);
    } else {
      modifiedFiles.push(filePart);
    }
  }

  // Determine if UI files or globals.css are modified
  const hasUiChanges = modifiedFiles.some(f => 
    f.startsWith('components/') || 
    f === 'app/globals.css'
  );

  const hasCatalogChanges = modifiedFiles.some(f => 
    f === 'docs/ui-catalog.md'
  );

  if (hasUiChanges && !hasCatalogChanges) {
    console.error('\n\x1b[31m[ERROR] UI components or styling changed, but docs/ui-catalog.md was not updated.\x1b[0m');
    console.error('\x1b[33mModified UI files:\x1b[0m');
    modifiedFiles
      .filter(f => f.startsWith('components/') || f === 'app/globals.css')
      .forEach(f => console.error(`  - ${f}`));
    console.error('\n\x1b[36mPlease document any new, renamed, or modified UI components/patterns in docs/ui-catalog.md and stage it.\x1b[0m');
    process.exit(1);
  }

  console.log('\x1b[32m[SUCCESS] UI Catalog verification passed.\x1b[0m');
  process.exit(0);
} catch (err) {
  // If not in a git repo or git is unavailable, pass warning but do not break the build
  console.warn('[WARNING] Git status check skipped:', err.message || err);
  process.exit(0);
}
