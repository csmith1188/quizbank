const fs = require('fs');
const path = require('path');

module.exports.readDirTree = function (dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    return entries.map(entry => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            return {
                name: entry.name,
                type: 'directory',
                children: module.exports.readDirTree(fullPath) // recurse
            };
        } else {
            return {
                name: entry.name,
                type: 'file'
            };
        }
    });
}

// gets all files in a directory and its subdirectories and returns them as an array of paths relative to the given directory
module.exports.readDirPaths = function(dir, fileList = [], baseDir = dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
  
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        module.exports.readDirPaths(fullPath, fileList, baseDir);
      } else if (entry.isFile()) {
        // Normalize to forward slashes
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        fileList.push(relativePath);
      }
    });
  
    return fileList;
  }