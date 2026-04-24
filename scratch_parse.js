const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('scratch_561061.html', 'utf8');
const $ = cheerio.load(html);

console.log("Tìm kiếm text 'Thông báo liên quan':");
let foundCount = 0;
$('*').each((i, el) => {
  if ($(el).children().length === 0 && $(el).text().includes('Thông báo liên quan')) {
     console.log('Found in tag:', el.tagName);
     console.log('Parent HTML:', $(el).parent().html().substring(0, 300));
     foundCount++;
  }
});

console.log("--- Lấy danh sách link ---");
$('a').each((i, el) => {
  const text = $(el).text().trim();
  const href = $(el).attr('href');
  if (text.toLowerCase().includes('thông báo việc đấu giá') || (href && href.includes('558066'))) {
      console.log('Link:', text, '=>', href);
  }
});
