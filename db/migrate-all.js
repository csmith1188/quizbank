const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Run every migration script in this folder (and init-db) in a stable order.
// Each script is a standalone Node program that executes on require().

const thisDir = __dirname;

function isMigrationFile(name) {
  return (
    name.endsWith('.js') &&
    (name === 'init-db.js' || (name.startsWith('migrate-') && name !== 'migrate-all.js'))
  );
}

function main() {
  const files = fs
    .readdirSync(thisDir)
    .filter(isMigrationFile)
    .sort();

  for (const file of files) {
    const fullPath = path.join(thisDir, file);
    const result = spawnSync(process.execPath, [fullPath], {
      stdio: 'inherit',
      cwd: path.join(thisDir, '..')
    });
    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  }
}

main();

