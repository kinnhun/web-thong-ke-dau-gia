const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'bot-crawls-data/src/api/routes.js');
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  {
    regex: /catch \(err\) \{ console\.error\('\[TRIGGER\] Lỗi:', err\); \}/g,
    replacement: "catch (err) { console.error('[TRIGGER] Lỗi:', err); } finally { const { closeBrowser } = require('../browser'); await closeBrowser().catch(()=>{}); }"
  },
  {
    regex: /catch \(err\) \{ console\.error\('\[TRIGGER\] Lỗi List Crawl:', err\); \}/g,
    replacement: "catch (err) { console.error('[TRIGGER] Lỗi List Crawl:', err); } finally { const { closeBrowser } = require('../browser'); await closeBrowser().catch(()=>{}); }"
  },
  {
    regex: /console\.error\(`\[RECRAWL BG\] ❌ Lỗi xử lý ngầm #\$\{sourceId\}:`, err\.message\);\n\s+\}/g,
    replacement: "console.error(`[RECRAWL BG] ❌ Lỗi xử lý ngầm #${sourceId}:`, err.message);\n      } finally { const { closeBrowser } = require('../browser'); await closeBrowser().catch(()=>{}); }"
  },
  {
    regex: /console\.error\('\[MEGA-DETAIL\] Background job failed:', err\.message\);\n\s+\}\n\s+\}\)\(\);/g,
    replacement: "console.error('[MEGA-DETAIL] Background job failed:', err.message);\n      } finally { const { closeBrowser } = require('../browser'); await closeBrowser().catch(()=>{}); }\n    })();"
  },
  {
    regex: /console\.error\('\[RECRAWL-PROPS\] Cursor close failed:', closeErr\.message\);\n\s+\}\n\s+\}\n\s+\}\)\(\);/g,
    replacement: "console.error('[RECRAWL-PROPS] Cursor close failed:', closeErr.message);\n          }\n        }\n        const { closeBrowser } = require('../browser');\n        await closeBrowser().catch(()=>{});\n      }\n    })();"
  },
  {
    regex: /console\.error\('\[TRIGGER\] Error starting duplicate scan:', err\);\n\s+\}\n\s+\}\)\(\);/g,
    replacement: "console.error('[TRIGGER] Error starting duplicate scan:', err);\n      } finally { const { closeBrowser } = require('../browser'); await closeBrowser().catch(()=>{}); }\n    })();"
  }
];

let changed = false;
replacements.forEach(r => {
  if (content.match(r.regex)) {
    content = content.replace(r.regex, r.replacement);
    changed = true;
  }
});

if (changed) {
  fs.writeFileSync(file, content);
  console.log('Patched routes.js');
} else {
  console.log('No changes made');
}
