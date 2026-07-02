const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const helpers = require('../src/utils/helpers');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  const ids = [165387, 270309, 241414, 139756, 569814, 572310, 572311, 403446];
  const notices = await AuctionNotice.find({ sourceId: { $in: ids } }).lean();

  for (const id of ids) {
    const n = notices.find(x => x.sourceId === id);
    if (n) {
      console.log(`\nID: ${id}`);
      console.log(`Name: ${n.name}`);
      console.log(`isGeneric: ${helpers.isGenericTitle(n.name)}`);
      
      const clean = helpers.removeDiacritics(n.name.toLowerCase())
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const boilerplatePhrases = [
        'tai san thi hanh an',
        'quy dinh cua phap luat',
        'thi hanh an dan su',
        'quyen su dung dat',
        'quyen so huu nha',
        'va tai san khac gan lien',
        'tai san bao dam',
        'giao dich bao dam',
        'tang vat phuong tien vi pham',
        'tich thu sung quy nha nuoc',
        'xe o to da qua su dung',
        'xe mo to da qua su dung',
        'tai san nha nuoc',
        'quan ly su dung tai san'
      ];
      const genericWords = [
        'tai san', 'lo', 'so', 'lan', 'dot', 'nhom', 'dan', 'danh sach', 'chi tiet', 'kem theo',
        'ban thanh ly', 'thanh ly', 'thu hoi', 'khong co nhu cau su dung', 'vat tu', 'thiet bi',
        'quy quyen', 'giay chung nhan'
      ];
      let remaining = clean;
      for (const phrase of boilerplatePhrases) {
        remaining = remaining.replace(new RegExp(phrase, 'g'), ' ');
      }
      for (const word of genericWords) {
        remaining = remaining.replace(new RegExp('\\b' + word + '\\b', 'g'), ' ');
      }
      remaining = remaining.replace(/[0-9]/g, ' ');
      remaining = remaining.replace(/\b[a-z]\b/g, ' ');
      remaining = remaining.replace(/\s+/g, '').trim();
      
      console.log(`Remaining length: ${remaining.length} ("${remaining}")`);
    }
  }

  await mongoose.connection.close();
}

run().catch(console.error);
