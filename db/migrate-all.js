const fs = require('fs');
const path = require('path');

// Run every migration script in this folder (and init-db) in a stable order.
// Each script is a standalone Node program that executes on require().

const thisDir = __dirname;

function isMigrationFile(name) {
  return (
    name.endsWith('.js') &&
    (name === 'init-db.js' || name.startsWith('migrate-'))
  );
}

function main() {
  const files = fs
    .readdirSync(thisDir)
    .filter(isMigrationFile)
    .sort();

  files.forEach((file) => {
    const fullPath = path.join(thisDir, file);
    // eslint-disable-next-line global-require, import/no-dynamic-require
    require(fullPath);
  });
}

main();

