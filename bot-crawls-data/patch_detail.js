const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/scrapers/detail.scraper.js');
let content = fs.readFileSync(p, 'utf8');

const errorPart = `    let payload = {};
    const Model = type === 'org' ? OrgSelection : AuctionNotice;
    
    // Rút gọn mô tả để search API (chỉ lấy phần cốt lõi đầu tiên, bỏ các từ khóa pháp lý)
    const escapedName = escapeRegex(name).replace(/"/g, '');
    let searchName = escapedName;
    
    // ... skipped the unchanged parts, wait, I can just replace lines 535 to 540, and 639 to 645 separately\r
\r
    let payload = { numberPerPage: 20, p: 1, typeOrder: 2 };`;

const fix = `    let payload = { numberPerPage: 20, p: 1, typeOrder: 2 };`;

content = content.replace(errorPart, fix);
content = content.replace(errorPart.replace(/\r\n/g, '\n'), fix.replace(/\r\n/g, '\n'));

const targetQuery = `    // ★ THỰC THI TẤT CẢ QUERIES (API + 3 DB QUERIES) SONG SONG
    const [apiRes, dbCandidates, dbCandidatesRegex, dbCandidatesStrong] = await Promise.all([
      fetchAPI(endpoint, payload).catch(err => { console.error(\`[API Search] Lỗi \${sourceId}:\`, err.message); return null; }),`;

const fixQuery = `    // ★ THỰC THI TẤT CẢ QUERIES (API + 3 DB QUERIES) SONG SONG
    const [apiRes, dbCandidates, dbCandidatesRegex, dbCandidatesStrong] = await Promise.all([
      skipApiSearch ? Promise.resolve(null) : fetchAPI(endpoint, payload).catch(err => { console.error(\`[API Search] Lỗi \${sourceId}:\`, err.message); return null; }),`;

content = content.replace(targetQuery, fixQuery);
content = content.replace(targetQuery.replace(/\r\n/g, '\n'), fixQuery.replace(/\r\n/g, '\n'));

fs.writeFileSync(p, content, 'utf8');
console.log("Patched detail scraper!");
