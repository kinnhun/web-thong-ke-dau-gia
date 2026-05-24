const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, '..');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.next' && file !== 'scratch') {
        search(fullPath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('recoverMissingDuplicates')) {
        console.log(`Found in: ${fullPath}`);
      }
    }
  }
}

search(projectDir);
