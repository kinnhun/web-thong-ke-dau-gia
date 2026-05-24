const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, '..');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        search(fullPath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.env')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('mongodb://') || content.includes('MONGODB_URI')) {
        console.log(`Found in: ${fullPath}`);
        // print lines containing mongodb
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('mongodb') || line.includes('MONGO')) {
            console.log(`  Line ${idx+1}: ${line}`);
          }
        });
      }
    }
  }
}

search(projectDir);
