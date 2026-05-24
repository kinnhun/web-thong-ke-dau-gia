const { getBigrams, jaccardSimilarity, overlapSimilarity } = require('../bot-crawls-data/src/utils/helpers');

function removeDiacritics(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

function extractCoreIdentity(name) {
  if (!name) return '';
  let s = removeDiacritics(name.normalize('NFC').toLowerCase());

  // 0. Chuẩn hoá các từ viết tắt phổ biến trước khi xử lý
  s = s.replace(/\bqsdd\b/g, 'quyen su dung dat');
  s = s.replace(/\bgcn\b/g, 'giay chung nhan');
  s = s.replace(/\bbks\b/g, 'bien kiem soat');
  s = s.replace(/\btbd\b/g, 'to ban do');
  s = s.replace(/\bhdtd\b/g, 'hop dong tin dung');
  s = s.replace(/\bhdtc\b/g, 'hop dong the chap');

  // 0.1 Xoá các tiền tố phổ biến
  s = s.replace(/tai san dau gia (la|gom):?/g, ' ');
  s = s.replace(/thong bao dau gia:?/g, ' ');

  // 1. Xoá ngoặc đơn
  s = s.replace(/\([^)]*\)/g, ' ');

  // 2. Xoá boilerplate pháp lý (dài trước, ngắn sau)
  s = s.replace(/quyen su dung dat,?\s*quyen so huu nha o va tai san khac gan lien voi dat/g, ' ');
  s = s.replace(/quyen su dung dat o va quyen so huu nha o/g, ' ');
  s = s.replace(/quyen so huu nha o va quyen su dung dat o/g, ' ');
  s = s.replace(/quyen su dung dat va tai san\s*(khac\s*)?gan lien voi dat/g, ' ');
  s = s.replace(/tai san\s*(khac\s*)?gan lien\s*(voi\s*dat)?/g, ' ');
  s = s.replace(/quyen su dung dat\s*(o)?/g, ' ');
  s = s.replace(/quyen so huu nha\s*(o)?/g, ' ');
  s = s.replace(/tai dia chi\s*(so)?:?/g, ' ');
  s = s.replace(/nha dat\s*(so)?/g, ' ');
  s = s.replace(/can ho\s*(so)?/g, ' ');
  s = s.replace(/thua dat\s*(so)?/g, ' ');
  s = s.replace(/to ban do\s*(so)?/g, ' ');

  // 2.1 Xoá boilerplate THA, Kê biên, Toạ lạc
  s = s.replace(/bien ban ve viec ke bien,?\s*xu ly tai san/g, ' ');
  s = s.replace(/chi cuc thi hanh an dan su/g, ' ');
  s = s.replace(/cuc thi hanh an dan su/g, ' ');
  s = s.replace(/ngay\s+\d{1,2}\/\d{1,2}\/\d{4}/g, ' ');
  s = s.replace(/lo\s+gioi/g, ' ');
  s = s.replace(/hinh\s+thuc\s+su\s+dung/g, ' ');
  s = s.replace(/muc\s+dich\s+su\s+dung/g, ' ');
  s = s.replace(/thoi\s+han\s+su\s+dung/g, ' ');
  s = s.replace(/nguon\s+goc\s+su\s+dung/g, ' ');
  s = s.replace(/nguoi\s+co\s+tai\s+san/g, ' ');
  s = s.replace(/to\s+chuc\s+dau\s+gia/g, ' ');
  s = s.replace(/chi\s+cuc\s+thi\s+hanh\s+an/g, ' ');
  s = s.replace(/ubnd/g, ' ');
  s = s.replace(/theo\s+bien\s+ban/g, ' ');
  s = s.replace(/tai\s+thoi\s+diem\s+ke\s+bien/g, ' ');
  s = s.replace(/duoc\s+ban\s+dau\s+gia/g, ' ');
  s = s.replace(/co\s+dien\s+tich\s+xay\s+dung/g, ' ');
  s = s.replace(/chu\s+so\s+huu/g, ' ');
  s = s.replace(/tu\s+nguyen\s+thao\s+do/g, ' ');
  s = s.replace(/gia\s+khoi\s+diem/g, ' ');
  s = s.replace(/buoc\s+gia/g, ' ');
  s = s.replace(/tien\s+dat\s+truoc/g, ' ');
  s = s.replace(/ho\s+so\s+dau\s+gia/g, ' ');
  s = s.replace(/giay chung nhan quyen su dung dat/g, ' ');
  s = s.replace(/giay chung nhan quyen so huu nha o/g, ' ');
  s = s.replace(/quy dinh tai dieu\s*\d+[a-z]?/g, ' ');
  s = s.replace(/theo quy dinh cua phap luat/g, ' ');
  s = s.replace(/tu nguyen thao do de tra lai hien trang/g, ' ');
  s = s.replace(/thong tin tai san theo/g, ' ');
  s = s.replace(/toa lac tai/g, ' ');
  s = s.replace(/toa lac/g, ' ');

  // 3. Xoá tên tỉnh/thành phố và các viết tắt TPHCM/HCM
  s = s.replace(/thanh pho ho chi minh/g, ' ');
  s = s.replace(/tp\.?\s*ho chi minh/g, ' ');
  s = s.replace(/tp\.?\s*hcm/g, ' ');
  s = s.replace(/\btphcm\b/g, ' ');
  s = s.replace(/\bhcm\b/g, ' ');
  const provNamesNoDiac = [
    'an giang','ba ria vung tau','bac giang','bac kan','bac lieu','bac ninh','ben tre',
    'binh dinh','binh duong','binh phuoc','binh thuan','ca mau','cao bang','dak lak',
    'dak nong','dien bien','dong nai','dong thap','gia lai','ha giang','ha nam','ha noi',
    'ha tinh','hai duong','hai phong','hau giang','hoa binh','hung yen','khanh hoa',
    'kien giang','kon tum','lai chau','lam dong','lang son','lao cai','long an','nam dinh',
    'nghe an','ninh binh','ninh thuan','phu tho','phu yen','quang binh','quang nam',
    'quang ngai','quang ninh','quang tri','soc trang','son la','tay ninh','thai binh',
    'thai nguyen','thanh hoa','thua thien hue','tien giang','tra vinh','tuyen quang',
    'vinh long','vinh phuc','yen bai','can tho','da nang',
  ];
  for (const p of provNamesNoDiac) {
    s = s.replace(new RegExp('\\b' + p.replace(/ /g, '\\s+') + '\\b', 'g'), ' ');
  }

  // 7. Xoá các cụm thay đổi tên hành chính (nay là, trước đây là...)
  s = s.replace(/\b(nay|truoc|day|doi ten)\s+(la|thanh|la\s+phuong|la\s+quan)\s+[a-z0-9\s]{1,30}(?=,|$|\s+(quan|q|huyen|tinh|phuong|p)\b)/g, ' ');
  if (name.includes("253")) console.log("   After Step 7:", JSON.stringify(s));

  // 8. Xoá đơn vị hành chính kèm TÊN (hỗ trợ P.Tân Định, Q.1...)
  s = s.replace(/\b(phuong|p)\b\.?\s*[a-z0-9\s]{1,30}(?=,|$|\s+(quan|q|huyen|xa|tp|thanh pho|phuong|p)\b)/g, ' ');
  if (name.includes("253")) console.log("   After Step 8 (Communes):", JSON.stringify(s));
  s = s.replace(/\b(quan|q)\b\.?\s*[a-z0-9\s]{1,30}(?=,|$|\s+(tinh|tp|thanh pho|quan|q|huyen)\b)/g, ' ');
  if (name.includes("253")) console.log("   After Step 8 (Districts):", JSON.stringify(s));
  s = s.replace(/\b(xa|huyen|thi\s*xa|thi\s*tran)\b\.?\s*[a-z0-9\s]{1,30}(?=,|$|\s+(tinh|thanh pho|quan|q|huyen|xa)\b)/g, ' ');
  if (name.includes("253")) console.log("   After Step 8 (Communes 2):", JSON.stringify(s));

  // 4. Xoá đơn vị hành chính kèm số (VD: phường 12, quận 1, p1, q1)
  s = s.replace(/\b(phuong|quan|p|q|to|khu pho|kp|ap|thon)[\s\.\,\-]*\d+\b/g, ' ');

  // 5. Xoá nhãn đơn vị hành chính (bao gồm cả standlone p, q)
  s = s.replace(/\b(phuong|quan|huyen|thi xa|thi tran|xa|tinh|thanh pho|khu pho|to dan pho|p|q)\b/g, ' ');

  // 6. Xoá ngày tháng năm
  s = s.replace(/\b(ngay|thang|nam)\s*\d+([\/\-]\d+)*\b/g, ' ');
  s = s.replace(/\b(19\d{2}|20\d{2})\b/g, ' ');

  // 9. Xoá các đặc điểm kỹ thuật rác (diện tích xây dựng, sàn, kết cấu...)
  s = s.replace(/dien tich (xay dung|su dung|san|rieng|chung)[\s\d,\.m2]{1,30}/g, ' ');
  s = s.replace(/ket cau:?\s*[a-z0-9\s,\.;]{1,100}(?=\.|$)/g, ' ');
  s = s.replace(/lo gioi duong\s*[a-z0-9\s,]{1,30}/g, ' ');
  s = s.replace(/phan xay dung them khong duoc ban dau gia/g, ' ');
  s = s.replace(/hinh thuc su dung:?\s*[a-z0-9\s,]{1,50}/g, ' ');
  s = s.replace(/muc dich su dung dat:?\s*[a-z0-9\s,]{1,50}/g, ' ');
  s = s.replace(/thoi han su dung dat:?\s*[a-z0-9\s,]{1,50}/g, ' ');
  s = s.replace(/nguon goc su dung dat:?\s*[a-z0-9\s,]{1,100}/g, ' ');

  // 10. Xoá stop words
  s = s.replace(/\b(so|tai|va|cua|o|voi|cac|mot|la|cho|den|tren|duoi|trong|ngoai|nay|truoc|day|sau|lien|ke|dia chi|dia|thua|to|ban|do|giay|chung|nhan|qsdd|tai|san|gan|lien|dat|gom|gom|bao|thanh|hinh|thuc|muc|dich|thoi|han|nguon|goc|nhu|theo|chi|phi|chiu|thong|tin|bien|ban|ke|bien|xu|ly|luc|gio|phut|chi|cuc|thi|hanh|an|dan|su|lo|gioi|nguoi|chuc|dau|gia|ubnd|thoi|diem|duoc|xay|dung|chu|nguyen|thao|gia|khoi|diem|buoc|tien|dat|truoc|ho|so)\b/g, ' ');
  if (name.includes("253")) console.log("   After Step 10 (Stopwords):", JSON.stringify(s));

  // 11. Dọn dẹp
  s = s.replace(/[,\.\(\):\-;"']/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function extractPropertyIdentifiers(name) {
  if (!name) return {};
  let s = removeDiacritics(name.toLowerCase());
  // Xoá toạ lạc trước khi phân tích
  s = s.replace(/toa lac tai/g, ' ');
  s = s.replace(/toa lac/g, ' ');
  
  const ids = {};

  // 1. ĐẤT ĐAI: Thửa đất & Tờ bản đồ
  const plotMatch = s.match(/(?:\bthua\b|\bt\b)\s*(?:dat\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
  if (plotMatch) ids.plotNumber = plotMatch[1].replace(/\s+/g, '');

  const mapMatch = s.match(/(?:\bto\b|\btbd\b|\bban\s*do\b)\s*(?:ban\s*do\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
  if (mapMatch) ids.mapSheet = mapMatch[1].replace(/\s+/g, '');

  // 2. CHUNG CƯ / DỰ ÁN: Lô, Ô, Khu, Căn hộ, Tòa
  const aptMatch = s.match(/(?:can\s*ho|phong|ma\s*can|can|unit)\s*(?:so)?\s*[:\.]?\s*([a-z0-9]+(?:[.-][a-z0-9]+)?)/i);
  if (aptMatch) ids.apartment = aptMatch[1].toUpperCase();

  const blockMatch = s.match(/(?:toa\s*nha|toa|block|thap|tower|building)\s*[:\.]?\s*([a-z0-9]+)/i);
  if (blockMatch && blockMatch[1] && !/^(phuong|xa|quan|huyen|tinh|lac|do)$/i.test(blockMatch[1])) {
    ids.block = blockMatch[1].toUpperCase();
  }

  // 3. GIẤY TỜ PHÁP LÝ
  const certMatch = s.match(/(?:gcn|qsdd|so\s*do|so\s*hong|giay\s*chung\s*nhan|phat\s*hanh|seri|so\s*hieu)[^\d]{0,50}\b([a-z]{1,2}\s*[0-9]{4,9})\b/i);
  if (certMatch) ids.certificateNumber = certMatch[1].replace(/\s+/g, '').toUpperCase();

  const certEntryMatch = s.match(/(?:vao\s*so\s*cap|so\s*vao\s*so|vao\s*so)[^\d]{0,30}\b([a-z]{1,2}\s*[0-9]{3,9})\b/i);
  if (certEntryMatch) ids.certificateEntryNumber = certEntryMatch[1].replace(/\s+/g, '').toUpperCase();

  // 4. XE CỘ
  const bksMatch = s.match(/(?:bien\s*so|bks|bs|bien\s*kiem\s*soat|so\s*xe)[:\s]*([0-9]{2}[a-zđ][a-z0-9]?(?:[\s.-]*[0-9]){4,6})/i);
  if (bksMatch) ids.licensePlate = bksMatch[1].replace(/[\s.-]/g, '').toUpperCase();

  const skMatch = s.match(/(?:so\s*khung|sk)[:\s]*([a-z0-9]{6,25})/i);
  if (skMatch) ids.chassisNumber = skMatch[1].toUpperCase();

  const smMatch = s.match(/(?:so\s*may|sm)[:\s]*([a-z0-9]{6,25})/i);
  if (smMatch) ids.engineNumber = smMatch[1].toUpperCase();

  // Diện tích
  const areaMatch = s.match(/(\d+(?:[,\.]\d+)?)\s*(?:m2|met\s*vuong)/i);
  if (areaMatch) ids.area = areaMatch[1].replace(',', '.');

  // Trích xuất Phường/Xã và Quận/Huyện dưới dạng danh sách (để hỗ trợ đổi tên hành chính)
  // Xoá boilerplate đổi tên nhưng GIỮ LẠI các tên địa danh để trích xuất
  let sCleanParen = s.replace(/\(\s*(?:nay|truoc\s+day|truoc|doi\s+ten)\s+(?:la|thanh)\s*/gi, ' ');
  sCleanParen = sCleanParen.replace(/[\(\)]/g, ' ');
  
  const communes = [];
  const communeRegex = /\b(?:phuong\b|xa\b|thi\s*tran\b|p(?=\s|\.|\d))\.?\s*((?:(?!\b(?:phuong|quan|xa|huyen|p|q)\b)[a-z0-9\s]){1,30})(?=,|$|[\s]+(?:quan\b|huyen\b|tp\b|thanh\b|hcm\b|phuong\b|quan\b|xa\b|huyen\b|p\b|q\b))/gi;
  let comMatch;
  while ((comMatch = communeRegex.exec(sCleanParen)) !== null) {
    const com = comMatch[1].trim();
    if (!communes.includes(com)) communes.push(com);
  }
  if (communes.length > 0) {
    ids.communes = communes;
    ids.commune = communes[0];
  }

  const districts = [];
  const districtRegex = /\b(?:quan\b|huyen\b|thi\s*xa\b|tp\b|thanh\s*pho\b|q(?=\s|\.|\d))\.?\s*((?:(?!\b(?:phuong|quan|xa|huyen|p|q)\b)[a-z0-9\s]){1,30})(?=,|$|[\s]+(?:tinh\b|tp\b|thanh\b|hcm\b|phuong\b|quan\b|xa\b|huyen\b|p\b|q\b))/gi;
  let distMatch;
  while ((distMatch = districtRegex.exec(sCleanParen)) !== null) {
    const dist = distMatch[1].trim();
    if (!/^(ho chi minh|hcm|tphcm)$/i.test(dist)) {
      if (!districts.includes(dist)) districts.push(dist);
    }
  }
  if (districts.length > 0) {
    ids.districts = districts;
    ids.district = districts[0];
  }

  // Trích xuất Số nhà (House number)
  let houseMatch = s.match(/(?:so\s*nha|dia\s*chi|tai\s*so|nha\s*o\s*so|nha\s*dat\s*so|nha\s*so|toa\s*lac\s*tai|toa\s*lac)\s*[:\.]?\s*([0-9]+[a-z]?[\/-]?[0-9]*[a-z]?)\b/i);
  if (!houseMatch) {
    houseMatch = s.match(/\bso\s*[:\.]?\s*([0-9]+[a-z]?[\/-]+[0-9]*[a-z]?)\b/i);
  }
  if (houseMatch && !/^(19|20)\d{2}$/.test(houseMatch[1])) {
    ids.houseNumber = houseMatch[1].replace(/\s+/g, '').toUpperCase();
  }

  return ids;
}

function hasConflictingIdentifiers(idsA, idsB) {
  // So sánh arrays communes và districts (nếu có)
  if (idsA.districts && idsB.districts) {
    const commonDist = idsA.districts.filter(d => idsB.districts.includes(d));
    if (idsA.districts.length > 0 && idsB.districts.length > 0 && commonDist.length === 0) {
      return true;
    }
  } else if (idsA.district && idsB.district && idsA.district !== idsB.district) {
    return true;
  }

  if (idsA.communes && idsB.communes) {
    const commonCom = idsA.communes.filter(c => idsB.communes.includes(c));
    if (idsA.communes.length > 0 && idsB.communes.length > 0 && commonCom.length === 0) {
      return true;
    }
  } else if (idsA.commune && idsB.commune && idsA.commune !== idsB.commune) {
    return true;
  }

  // Khác biệt diện tích lớn (> 2.0m2)
  if (idsA.area && idsB.area) {
    const a = parseFloat(idsA.area);
    const b = parseFloat(idsB.area);
    if (!isNaN(a) && !isNaN(b) && Math.abs(a - b) > 2.0) {
      return true;
    }
  }

  // So sánh các trường thông tin dạng chuỗi còn lại
  const keys = [
    'plotNumber',
    'apartment',
    'block',
    'certificateNumber',
    'certificateEntryNumber',
    'licensePlate',
    'chassisNumber',
    'engineNumber',
    'debtorName',
    'taxCode',
    'contractNumber',
    'serialNumber',
    'kiosk',
    'shipNumber',
    'ownerName',
    'bankName',
    'bankBranch',
    'stockAmount',
    'houseNumber'
  ];

  for (const key of keys) {
    if (idsA[key] && idsB[key] && idsA[key] !== idsB[key]) {
      return true;
    }
  }

  return false;
}

function hasMatchingStrongIdentifiers(idsA, idsB) {
  // Các định danh mạnh (unique)
  const strongKeys = [
    'licensePlate',
    'chassisNumber',
    'engineNumber',
    'certificateNumber',
    'taxCode',
    'debtorName',
    'contractNumber',
    'serialNumber'
  ];

  for (const key of strongKeys) {
    if (idsA[key] && idsB[key] && idsA[key] === idsB[key]) {
      return true;
    }
  }

  // Trùng khớp đồng thời Thửa + Tờ bản đồ
  if (idsA.plotNumber && idsB.plotNumber && idsA.plotNumber === idsB.plotNumber &&
      idsA.mapSheet && idsB.mapSheet && idsA.mapSheet === idsB.mapSheet) {
    return true;
  }

  return false;
}

function getNumberTokens(name) {
  if (!name) return [];
  let s = removeDiacritics(name.toLowerCase());
  
  // Xoá ngoặc đơn trước khi tìm số để bỏ các diện tích phụ
  s = s.replace(/\([^)]*\)/g, ' ');
  
  // Xoá các nhãn hành chính kèm số (p1, q1...) vì số này không định danh tài sản
  s = s.replace(/\b(phuong|quan|p|q|to|khu pho|kp|ap|thon)[\s\.\,\-]*\d+\b/g, ' ');
  
  const tokens = s.match(/[\w/\\-]*\d+[\w/\\-]*/g) || [];
  return tokens.filter(t => {
    // Loại bỏ năm phát hành thông dụng
    if (/^(19|20)\d{2}$/.test(t)) return false;
    return true;
  });
}

function runTest(name, text1, text2) {
  console.log(`\n=================== TEST: ${name} ===================`);
  
  const ids1 = extractPropertyIdentifiers(text1);
  const ids2 = extractPropertyIdentifiers(text2);
  
  console.log('\n--- Identifiers 1 ---');
  console.log(JSON.stringify(ids1, null, 2));
  console.log('--- Identifiers 2 ---');
  console.log(JSON.stringify(ids2, null, 2));
  
  console.log('\n--- Comparisons ---');
  const conflict = hasConflictingIdentifiers(ids1, ids2);
  const strong = hasMatchingStrongIdentifiers(ids1, ids2);
  console.log('Has Conflict:', conflict);
  console.log('Is Strong Match:', strong);
  
  const core1 = extractCoreIdentity(text1);
  const core2 = extractCoreIdentity(text2);
  const bigrams1 = getBigrams(core1);
  const bigrams2 = getBigrams(core2);
  const coreSim = jaccardSimilarity(bigrams1, bigrams2);
  const ovSim = overlapSimilarity(bigrams1, bigrams2);
  
  console.log('\nCore 1:', JSON.stringify(core1));
  console.log('Core 2:', JSON.stringify(core2));
  console.log('Core Similarity (Jaccard):', coreSim);
  console.log('Overlap Similarity:', ovSim);
  
  const nums1 = getNumberTokens(text1);
  const nums2 = getNumberTokens(text2);
  const commonNums = nums1.filter(n => nums2.includes(n));
  
  console.log('\nNum Tokens 1:', nums1);
  console.log('Num Tokens 2:', nums2);
  console.log('Common Num Tokens:', commonNums);
  
  console.log('\n--- Simulation of Matching ---');
  let matched = false;
  if (conflict) {
    console.log('RESULT: REJECTED due to conflicting identifiers.');
  } else if (strong) {
    console.log('RESULT: MATCHED (Strong Identifiers)');
    matched = true;
  } else if (coreSim >= 0.8) {
    console.log('RESULT: MATCHED (High Core Jaccard >= 80%)');
    matched = true;
  } else if (nums1.length > 0 && nums2.length > 0 && coreSim >= 0.55 && commonNums.length > 0) {
    console.log('RESULT: MATCHED (Medium Core Jaccard >= 55% + Common Numbers)');
    matched = true;
  } else if (nums1.length > 0 && nums2.length > 0 && ovSim >= 0.85 && commonNums.length >= 1) {
    console.log('RESULT: MATCHED (High Overlap >= 85% + Common Numbers)');
    matched = true;
  } else if (ids1.houseNumber && ids1.houseNumber === ids2.houseNumber && ovSim >= 0.60) {
    console.log('RESULT: MATCHED (Same House Number + Overlap >= 60%)');
    matched = true;
  } else {
    console.log('RESULT: NOT MATCHED');
  }
  return matched;
}

// Case 1
const c1_text1 = "Quyền sử dụng đất và quyền sở hữu nhà ở số 186/32 Trần Quang Khải, phường Tân Định, Quận 1 (nay là phường Tân Định), Thành phố Hồ Chí Minh.";
const c1_text2 = "Quyền sử dụng đất thửa đất số 67, tờ bản đồ số 51 tọa lạc 186/32 Trần Quang Khải, P.Tân Định, Quận 1, TPHCM.";

const case1Matched = runTest("Case 1 (186/32 Trần Quang Khải)", c1_text1, c1_text2);

// Case 2
const c2_textA = "QSDĐ và tài sản khác gắn liền với đất tọa lạc tại địa chỉ: 253 đường Liên tỉnh 5, phường 5, Quận 8, Thành phố Hồ Chí Minh thuộc thửa đất số 41, tờ bản đồ số 100 (Diện tích đất thực tế:367,5m2, theo GCN: 371,7m2 ; nhà diện tích sàn xây dựng: thực tế: 222,2m2; theo GCN:161,3m2).";
const c2_textB = "Nhà đất số 253 đường Liên tỉnh 5 (Quốc lộ 50), phường Bình Đông (trước đây là Phường 5, Quận 8), Thành phố Hồ Chí Minh.";
const c2_textC = "Nhà đất số 253 đường Liên tỉnh 5 (Quốc lộ 50), Phường 5, Quận 8 (nay là phường Bình Đông), Thành phố Hồ Chí Minh.";

const case2ABMatched = runTest("Case 2 (A vs B)", c2_textA, c2_textB);
const case2BCMatched = runTest("Case 2 (B vs C)", c2_textB, c2_textC);
const case2ACMatched = runTest("Case 2 (A vs C)", c2_textA, c2_textC);

console.log("\n=================== OVERALL SUMMARY ===================");
console.log("Case 1 Matched:", case1Matched);
console.log("Case 2 A-B Matched:", case2ABMatched);
console.log("Case 2 B-C Matched:", case2BCMatched);
console.log("Case 2 A-C Matched:", case2ACMatched);

const edges = [];
if (case2ABMatched) edges.push("A-B");
if (case2BCMatched) edges.push("B-C");
if (case2ACMatched) edges.push("A-C");
console.log("Edges found for Case 2:", edges);
console.log("Is Case 2 fully grouped together?", edges.includes("A-B") && edges.includes("B-C") || edges.includes("B-C") && edges.includes("A-C") || edges.includes("A-B") && edges.includes("A-C"));
