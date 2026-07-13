const fs = require('fs');
const path = require('path');

function parseReport(filename) {
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`${filename} does not exist.`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`=== STATS FOR ${filename} ===`);
  
  // Extract values using regex
  const webMatch = content.match(/<div class="label">Web báo \(tổng\)<\/div>\s*<div class="value">([\d.,]+)<\/div>/);
  const localMatch = content.match(/<div class="label">Local DB \(tổng\)<\/div>\s*<div class="value">([\d.,]+)<\/div>/);
  const matchMatch = content.match(/<div class="label">Trùng khớp<\/div>\s*<div class="value">([\d.,]+)<\/div>/);
  const missingMatch = content.match(/<div class="label">📉 THIẾU ở local<\/div>\s*<div class="value">([\d.,]+)<\/div>/);
  const extraMatch = content.match(/<div class="label">📈 THỪA ở local<\/div>\s*<div class="value">([\d.,]+)<\/div>/);
  
  console.log(`Web Count: ${webMatch ? webMatch[1] : 'N/A'}`);
  console.log(`Local Count: ${localMatch ? localMatch[1] : 'N/A'}`);
  console.log(`Trùng khớp: ${matchMatch ? matchMatch[1] : 'N/A'}`);
  console.log(`Thiếu: ${missingMatch ? missingMatch[1] : 'N/A'}`);
  console.log(`Thừa: ${extraMatch ? extraMatch[1] : 'N/A'}`);
  
  // Count lines / table rows roughly
  const missingTableMatch = content.match(/Bản ghi THIẾU ở local[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (missingTableMatch) {
    const missingRows = (missingTableMatch[1].match(/<tr>/g) || []).length;
    console.log(`Missing Rows in Table: ${missingRows}`);
  }
  
  const extraTableMatch = content.match(/Bản ghi THỪA ở local[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (extraTableMatch) {
    const extraRows = (extraTableMatch[1].match(/<tr>/g) || []).length;
    console.log(`Extra Rows in Table: ${extraRows}`);
  }
  console.log('\n');
}

parseReport('audit_report_2026-07-09.html');
parseReport('audit_report_2026-07-10.html');
