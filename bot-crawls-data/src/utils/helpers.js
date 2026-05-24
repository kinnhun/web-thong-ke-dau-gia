/**
 * Xoá dấu tiếng Việt
 */
function removeDiacritics(str) {
  if (!str) return '';
  // Chuẩn hoá NFC trước khi xử lý để tránh lỗi Unicode hỗn hợp
  return str.normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/**
 * Trích xuất "lõi danh tính" tài sản — loại bỏ toàn bộ văn bản pháp lý, tỉnh/thành,
 * phường/quận, ngày tháng, ngoặc đơn. Chỉ giữ lại phần phân biệt: số nhà + tên đường,
 * thửa đất, biển số xe, v.v.
 */
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

  // 1. Xoá ngoặc đơn (thường chứa thông tin bổ sung hoặc tên cũ)
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
  s = s.replace(/can nha\s*(so)?/g, ' ');
  s = s.replace(/\bcan\b/g, ' ');
  s = s.replace(/\bnha\b/g, ' ');
  s = s.replace(/thua dat\s*(so)?/g, ' ');
  s = s.replace(/to ban do\s*(so)?/g, ' ');

  // 2.1 Xoá boilerplate THA, Kê biên (mới thêm)
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

  // 3. Xoá tên tỉnh/thành phố
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

  // 8. Xoá đơn vị hành chính kèm TÊN (ví dụ: phường Võ Thị Sáu, quận Bình Thạnh)
  s = s.replace(/\b(phuong|p)\b\.?\s*[a-z0-9\s]{1,30}(?=,|$|\s+(quan|q|huyen|xa|tp|thanh pho|phuong|p)\b)/g, ' ');
  s = s.replace(/\b(quan|q)\b\.?\s*[a-z0-9\s]{1,30}(?=,|$|\s+(tinh|tp|thanh pho|quan|q|huyen)\b)/g, ' ');
  s = s.replace(/\b(xa|huyen|thi\s*xa|thi\s*tran)\b\.?\s*[a-z0-9\s]{1,30}(?=,|$|\s+(tinh|thanh pho|quan|q|huyen|xa)\b)/g, ' ');

  // 4. Xoá đơn vị hành chính kèm số (VD: phường 12, quận 1, p1, q1)
  s = s.replace(/\b(phuong|quan|p|q|to|khu pho|kp|ap|thon)[\s\.\,\-]*\d+\b/g, ' ');

  // 5. Xoá nhãn đơn vị hành chính
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

  // 10. Xoá stop words (thêm các từ thừa thãi trong đấu giá)
  s = s.replace(/\b(can|nha|so|tai|va|cua|o|voi|cac|mot|la|cho|den|tren|duoi|trong|ngoai|nay|truoc|day|sau|lien|ke|dia chi|dia|thua|to|ban|do|giay|chung|nhan|qsdd|tai|san|gan|lien|dat|gom|gom|bao|thanh|hinh|thuc|muc|dich|thoi|han|nguon|goc|nhu|theo|chi|phi|chiu|thong|tin|bien|ban|ke|bien|xu|ly|luc|gio|phut|chi|cuc|thi|hanh|an|dan|su|lo|gioi|nguoi|chuc|dau|gia|ubnd|thoi|diem|duoc|xay|dung|chu|nguyen|thao|gia|khoi|diem|buoc|tien|dat|truoc|ho|so)\b/g, ' ');

  // 11. Dọn dẹp
  s = s.replace(/[,\.\(\):\-;"']/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}


/**
 * Trích xuất các ĐỊNH DANH TÀI SẢN có cấu trúc (thửa đất số X, tờ bản đồ số X, lô X, v.v.)
 * Trả về object { plotNumber, mapSheet, lot, houseNumber, apartment, block, ... }
 * Dùng để phát hiện 2 tài sản KHÁC NHAU dù tên rất giống.
 */
function extractPropertyIdentifiers(name) {
  if (!name) return {};
  let s = removeDiacritics(name.toLowerCase());
  // Xoá toạ lạc trước khi phân tích
  s = s.replace(/toa lac tai/g, ' ');
  s = s.replace(/toa lac/g, ' ');
  
  const ids = {};

  // 1. ĐẤT ĐAI: Thửa đất & Tờ bản đồ (Thêm các case viết tắt Thửa: X, Tờ: Y)
  const plotMatch = s.match(/(?:\bthua\b|\bt\b)\s*(?:dat\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
  if (plotMatch) ids.plotNumber = plotMatch[1].replace(/\s+/g, '');

  const mapMatch = s.match(/(?:\bto\b|\btbd\b|\bban\s*do\b)\s*(?:ban\s*do\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
  if (mapMatch) ids.mapSheet = mapMatch[1].replace(/\s+/g, '');

  // 2. CHUNG CƯ / DỰ ÁN: Lô, Ô, Khu, Căn hộ, Tòa (Phòng 1205, Căn 12.05, Mã căn...)
  const aptMatch = s.match(/(?:can\s*ho|phong|ma\s*can|can|unit)\s*(?:so)?\s*[:\.]?\s*([a-z0-9]+(?:[.-][a-z0-9]+)?)/i);
  if (aptMatch) ids.apartment = aptMatch[1].toUpperCase();

  const blockMatch = s.match(/(?:toa\s*nha|toa|block|thap|tower|building)\s*[:\.]?\s*([a-z0-9]+)/i);
  if (blockMatch && blockMatch[1] && !/^(phuong|xa|quan|huyen|tinh|lac|do)$/i.test(blockMatch[1])) {
    ids.block = blockMatch[1].toUpperCase();
  }

  // 3. GIẤY TỜ PHÁP LÝ: GCN, Sổ đỏ, Sổ hồng, Số seri phát hành
  const certMatch = s.match(/(?:gcn|qsdd|so\s*do|so\s*hong|giay\s*chung\s*nhan|phat\s*hanh|seri|so\s*hieu)[^\d]{0,50}\b([a-z]{1,2}\s*[0-9]{4,9})\b/i);
  if (certMatch) ids.certificateNumber = certMatch[1].replace(/\s+/g, '').toUpperCase();

  const certEntryMatch = s.match(/(?:vao\s*so\s*cap|so\s*vao\s*so|vao\s*so)[^\d]{0,30}\b([a-z]{1,2}\s*[0-9]{3,9})\b/i);
  if (certEntryMatch) ids.certificateEntryNumber = certEntryMatch[1].replace(/\s+/g, '').toUpperCase();

  // 4. XE CỘ: Biển số, Số khung, Số máy (Bắt cả case viết tắt SK, SM)
  const bksMatch = s.match(/(?:bien\s*so|bks|bs|bien\s*kiem\s*soat|so\s*xe)[:\s]*([0-9]{2}[a-zđ][a-z0-9]?(?:[\s.-]*[0-9]){4,6})/i);
  if (bksMatch) ids.licensePlate = bksMatch[1].replace(/[\s.-]/g, '').toUpperCase();

  const skMatch = s.match(/(?:so\s*khung|sk)[:\s]*([a-z0-9]{6,25})/i);
  if (skMatch) ids.chassisNumber = skMatch[1].toUpperCase();

  const smMatch = s.match(/(?:so\s*may|sm)[:\s]*([a-z0-9]{6,25})/i);
  if (smMatch) ids.engineNumber = smMatch[1].toUpperCase();

  // 5. KHOẢN NỢ / DOANH NGHIỆP: Tên công ty nợ, MST, Số hợp đồng
  const debtMatch = s.match(/(?:khoan\s*no\s*cua|no\s*cua|tai\s*san\s*cua)\s*(?:cty|cong\s*ty|doanh\s*nghiep)\s+([a-z0-9\s]{5,60})(?:-|\s+mst|,|$)/i);
  if (debtMatch) ids.debtorName = debtMatch[1].trim().toUpperCase();

  const mstMatch = s.match(/(?:ma\s*so\s*thue|mst)[:\s]*(\d{10}(?:[-]\d{3})?)/i);
  if (mstMatch) ids.taxCode = mstMatch[1];

  const contractMatch = s.match(/(?:hop\s*dong|hdtd|hdtc|so\s*hd)[:\s]*([a-z0-9\/\-]{5,30})/i);
  if (contractMatch) ids.contractNumber = contractMatch[1].replace(/[\s]/g, '').toUpperCase();

  // 6. MÁY MÓC / ĐIỆN TỬ: Serial, Model, SKU
  const serialMatch = s.match(/(?:serial|seri|s\/n|sku|model|so\s*hieu)[:\s]*([a-z0-9\-]{5,25})/i);
  if (serialMatch) {
    ids.serialNumber = serialMatch[1].replace(/[\s.-]/g, '').toUpperCase();
  } else {
    // Alphanumeric codes (VD: PK123456, AB-1234) - fallback khi không có từ khoá
    const codeMatch = s.match(/\b([a-z]{1,4}[\-][0-9]{3,10}|[a-z]{1,4}[0-9]{3,10})\b/i);
    if (codeMatch) {
      const code = codeMatch[1].replace(/[\s.-]/g, '').toUpperCase();
      // Không lấy làm serial nếu nó trùng với biển số, số khung, số máy đã lấy
      if (code !== ids.licensePlate && code !== ids.chassisNumber && code !== ids.engineNumber) {
        ids.serialNumber = code;
      }
    }
  }

  // Diện tích (m2) - Lấy số lẻ thập phân để tăng độ chính xác
  const areaMatch = s.match(/(\d+(?:[,\.]\d+)?)\s*(?:m2|met\s*vuong)/i);
  if (areaMatch) ids.area = areaMatch[1].replace(',', '.');

  // Ki ốt / Kios / Quầy / Gian hàng
  const kioskMatch = s.match(/(?:ki\s*ot|kios|quay|gian\s*hang)\s*(?:so)?\s*[:\.]?\s*([a-z0-9]+(?:[/-][a-z0-9]+)?)/i);
  if (kioskMatch) ids.kiosk = kioskMatch[1];

  // Tàu thuyền (Số đăng ký / Ký hiệu) (VD: SG-1234, HP-12345, QN-1234-TS)
  const shipMatch = s.match(/(?:tau\s*ca|tau\s*bien|so\s*dang\s*ky|ky\s*hieu|tau|thuyen)\s*[:\.]?\s*([a-z]{2,4}[\s.-]*[0-9]{4,5}(?:[\s.-]*[a-z]{1,2})?)/i);
  if (shipMatch) ids.shipNumber = shipMatch[1].replace(/[\s.-]/g, '').toUpperCase();

  // Chủ tài sản / Người nợ (Ông/Bà/Công ty)
  const ownerMatch = s.match(/(?:cua|so\s*huu\s*cua|no\s*cua)\s*(?:ong|ba|cty|cong\s*ty)\s+([a-z\s]{5,40})(?:\s*tai|\s*dia\s*chi|,|$)/i);
  if (ownerMatch) ids.ownerName = ownerMatch[1].trim().toUpperCase();

  // Ngân hàng / Tổ chức tín dụng
  const bankMatch = s.match(/(?:tai|cua)\s*(agribank|bidiv|vietcombank|vietinbank|sacombank|techcombank|mb|shb|vpbank|vib|vpbank|ncb|oceanbank|gpbank|bac\s*a|ban\s*viet|pvc|vpb|tpbank|hdbank|lienvietpostbank)(?:\s*-\s*chi\s*nhanh\s+([a-z\s]{2,30}))?/i);
  if (bankMatch) {
    ids.bankName = bankMatch[1].toUpperCase();
    if (bankMatch[2]) ids.bankBranch = bankMatch[2].trim().toUpperCase();
  }

  // Số lượng cổ phần / Cổ phiếu
  const stockMatch = s.match(/(\d+(?:[\.,]\d+)?)\s*(?:co\s*phan|co\s*phieu)/i);
  if (stockMatch) ids.stockAmount = stockMatch[1].replace(/[,\.]/g, '');

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

/**
 * So sánh 2 bộ property identifiers.
 * Trả về true nếu CÓ MÂU THUẪN: cùng loại identifier nhưng giá trị KHÁC nhau.
 * VD: cả 2 đều có "thửa đất số" nhưng 1 là "01", 1 là "02" → CONFLICT → KHÁC tài sản.
 */
function hasConflictingIdentifiers(idsA, idsB) {
  const keys = [
    'plotNumber', 'mapSheet', 'lot', 'houseNumber', 'apartment', 'block', 'floor',
    'licensePlate', 'chassisNumber', 'engineNumber', 
    'certificateNumber', 'certificateEntryNumber', 'kiosk', 'shipNumber', 'streetAddress',
    'taxCode', 'contractNumber', 'ownerName', 'stockAmount', 'serialNumber', 'debtorName'
  ];
  for (const key of keys) {
    if (idsA[key] && idsB[key] && idsA[key] !== idsB[key]) {
      // Ngoại trừ mapSheet (đôi khi bị viết lệch to1 vs to01) và houseNumber (có thể là một phần)
      if (key === 'mapSheet' || key === 'houseNumber') continue; 
      return true;
    }
  }

  // So sánh arrays communes và districts (nếu có) để tránh conflict khi đổi tên hành chính
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

  // Conflict diện tích (độ lệch cho phép < 2m2)
  if (idsA.area && idsB.area) {
    const diff = Math.abs(parseFloat(idsA.area) - parseFloat(idsB.area));
    if (diff > 2.0) return true;
  }

  return false;
}

function hasMatchingStrongIdentifiers(idsA, idsB) {
  // 1. Định danh đơn lẻ duy nhất
  const strongKeys = [
    'licensePlate', 'chassisNumber', 'engineNumber', 
    'certificateNumber', 'certificateEntryNumber', 'shipNumber', 
    'streetAddress', 'taxCode', 'contractNumber', 'ownerName', 'stockAmount', 'serialNumber', 'debtorName'
  ];
  for (const key of strongKeys) {
    if (idsA[key] && idsB[key] && idsA[key] === idsB[key]) {
      return true;
    }
  }

  // 2. BẤT ĐỘNG SẢN: Cùng "thửa đất số X" + cùng "tờ bản đồ số Y"
  if (idsA.plotNumber && idsB.plotNumber && idsA.mapSheet && idsB.mapSheet &&
      idsA.plotNumber === idsB.plotNumber && idsA.mapSheet === idsB.mapSheet) {
    return true;
  }

  return false;
}

/**
 * Trích xuất số tài sản (đã loại bỏ ngày, năm, đơn vị hành chính)
 */
function getNumberTokens(name) {
  if (!name) return [];
  let s = removeDiacritics(name.toLowerCase());
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\b(ngay|thang|nam)\s*\d+([\/\-]\d+)*\b/g, '');
  s = s.replace(/\b(19\d{2}|20\d{2})\b/g, '');
  s = s.replace(/\b(phuong|quan|p|q|to|khu pho|kp|ap|thon)[\s\.\,\-]*\d+\b/g, '');
  const tokens = s.match(/[\w/\\-]*\d+[\w/\\-]*/g) || [];
  return [...new Set(tokens)];
}

/**
 * Tạo bigrams từ chuỗi
 */
function getBigrams(str) {
  if (!str) return new Set();
  const clean = str.toLowerCase()
    .replace(/\([^)]+\)/g, ' ')
    .replace(/[,\.\(\):\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = clean.split(' ');
  const bigrams = new Set();
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]} ${words[i+1]}`);
  }
  if (words.length === 1) bigrams.add(words[0]);
  return bigrams;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersectionSize = 0;
  const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

function overlapSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionSize = 0;
  const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) intersectionSize++;
  }
  return intersectionSize / smaller.size;
}

/**
 * Chuyển chuỗi tiếng Việt thành slug URL
 */
function slugify(str) {
  if (!str) return '';
  const map = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
  };

  return str
    .toLowerCase()
    .split('')
    .map(ch => map[ch] || ch)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 200);
}

/**
 * Map propertyTypeName → AssetType
 */
function mapAssetType(propertyTypeName = '', propertyName = '') {
  const combined = `${propertyTypeName} ${propertyName}`.toLowerCase();

  if (combined.includes('quyền sử dụng đất') || combined.includes('đất đai')) return 'land';
  if (combined.includes('nhà ở') || combined.includes('căn hộ') || combined.includes('chung cư')) return 'house';
  if (combined.includes('phương tiện') || combined.includes('ô tô') || combined.includes('xe')) return 'car';
  if (combined.includes('máy móc') || combined.includes('thiết bị') || combined.includes('dây chuyền')) return 'machinery';
  if (combined.includes('thi hành án')) return 'enforcement';
  if (combined.includes('tài sản công') || combined.includes('nhà nước') || combined.includes('công vụ')) return 'public';

  return 'other';
}

/**
 * Parse giá từ string tiếng Việt
 * Ví dụ: "1.234.567.890 đồng" → 1234567890
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Parse date từ format "dd/MM/yyyy HH:mm" hoặc timestamp
 */
function parseDate(dateVal) {
  if (!dateVal) return null;

  // Nếu là timestamp (số)
  if (typeof dateVal === 'number') {
    return new Date(dateVal);
  }

  // Nếu là ISO string
  if (typeof dateVal === 'string' && dateVal.includes('T')) {
    return new Date(dateVal);
  }

  // Nếu là "HH:mm dd/MM/yyyy"
  if (typeof dateVal === 'string') {
    const match = dateVal.match(/(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, h, m, d, mo, y] = match;
      return new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(m));
    }
    // "dd/MM/yyyy"
    const match2 = dateVal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match2) {
      const [, d, mo, y] = match2;
      return new Date(parseInt(y), parseInt(mo) - 1, parseInt(d));
    }
  }

  return null;
}

/**
 * Trích xuất tỉnh/thành phố từ chuỗi địa chỉ
 */
const PROVINCES = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu',
  'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang',
  'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình',
  'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu',
  'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
  'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên',
  'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
  'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
  'Hà Nội', 'TP. Hồ Chí Minh', 'TP Hồ Chí Minh', 'Thành phố Hồ Chí Minh',
  'Hải Phòng', 'Đà Nẵng', 'Cần Thơ',
];

function normalizeProvince(p) {
  if (!p) return '';
  if (p.includes('Hồ Chí Minh') || p.includes('HCM')) return 'TP. Hồ Chí Minh';
  if (p === 'Hà Nội' || p === 'Ha Noi') return 'Hà Nội';
  if (p === 'Đà Nẵng' || p === 'Da Nang') return 'Đà Nẵng';
  if (p === 'Hải Phòng' || p === 'Hai Phong') return 'Hải Phòng';
  if (p === 'Cần Thơ' || p === 'Can Tho') return 'Cần Thơ';
  return p;
}

function extractProvince(text) {
  if (!text) return '';
  for (const p of PROVINCES) {
    if (text.includes(p)) return normalizeProvince(p);
  }
  // Normalize TP. HCM variants
  if (text.includes('Hồ Chí Minh') || text.includes('HCM')) return 'TP. Hồ Chí Minh';
  return '';
}

/**
 * Derive status from dates
 */
function deriveStatus(registrationEnd, auctionDate) {
  const now = new Date();
  if (auctionDate && new Date(auctionDate) < now) return 'completed';
  if (registrationEnd && new Date(registrationEnd) > now) return 'receiving_docs';
  if (auctionDate && new Date(auctionDate) > now) return 'upcoming';
  return 'unknown';
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  slugify,
  mapAssetType,
  parsePrice,
  parseDate,
  extractProvince,
  normalizeProvince,
  deriveStatus,
  delay,
  PROVINCES,
  getBigrams,
  jaccardSimilarity,
  overlapSimilarity,
  removeDiacritics,
  extractCoreIdentity,
  getNumberTokens,
  extractPropertyIdentifiers,
  hasConflictingIdentifiers,
  hasMatchingStrongIdentifiers,
};
