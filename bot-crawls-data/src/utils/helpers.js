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
  s = s.replace(/\b(can|nha|so|tai|va|cua|o|voi|cac|mot|la|cho|den|tren|duoi|trong|ngoai|nay|truoc|day|sau|lien|ke|dia chi|dia|thua|to|ban|do|giay|chung|nhan|qsdd|tai|san|gan|lien|dat|gom|gom|bao|thanh|hinh|thuc|muc|dich|thoi|han|nguon|goc|nhu|theo|chi|phi|chiu|thong|tin|bien|ban|ke|bien|xu|ly|luc|gio|phut|chi|cuc|thi|hanh|an|dan|su|lo|gioi|nguoi|chuc|dau|gia|ubnd|thoi|diem|duoc|xay|dung|chu|nguyen|thao|gia|khoi|diem|buoc|tien|dat|truoc|ho|so|khac|ma|phap|luat|quy|dinh|phai|qua|dam|ve|giao|dich|dai|nong|nghiep|cong|ich)\b/g, ' ');

  // 11. Dọn dẹp
  s = s.replace(/[,\.\(\):\-;"']/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}


function extractPropertyIdentifiers(name) {
  if (!name) return {};
  let s = removeDiacritics(name.toLowerCase());
  
  const ids = {};

  // 1. ĐẤT ĐAI: Thửa đất & Tờ bản đồ (Thêm các case viết tắt Thửa: X, Tờ: Y)
  const plotMatch = s.match(/(?:\bthua\b)\s*(?:dat\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
  if (plotMatch) {
    ids.plotNumber = plotMatch[1].replace(/\s+/g, '');
    s = s.replace(plotMatch[0], ' ');
  }

  // Revised mapMatch logic
  // Pattern A: definite map sheet keywords (tbd, ban do, to ban do) -> no lookahead
  let mapMatch = s.match(/(?:\btbd\b|\bban\s*do\b|\bto\s+ban\s*do\b)\s*(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)\b/i);
  // Pattern B: ambiguous "tờ" -> check lookahead to avoid matching "tổ dân phố / tổ 3"
  if (!mapMatch) {
    mapMatch = s.match(/(?<!\bo\s+)\bto\b(?![\s-]*(?:chuc|hop|dan|nhom|doi|trinh))\s*(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)(?![\s,\.\/\-]*(?:phuong|xa|thi\s*tran|p(?=\s|\d|\.)|q(?=\s|\d|\.)|quan|huyen|tp|thanh\s*pho|tinh|dan\s*pho|dan\s*cu|dan))\b/i);
  }

  if (mapMatch) {
    ids.mapSheet = mapMatch[1].replace(/\s+/g, '');
    s = s.replace(mapMatch[0], ' ');
  }

  // 2. CHUNG CƯ / DỰ ÁN: Lô, Ô, Khu, Căn hộ, Tòa (Phòng 1205, Căn 12.05, Mã căn...)
  const aptMatch = s.match(/\b(?:can\s*ho|phong|ma\s*can|can\s*so|unit)\b\s*(?:so)?\s*[:\.]?\s*([a-z0-9]+(?:[.-][a-z0-9]+)?)/i);
  if (aptMatch) {
    const val = aptMatch[1].toUpperCase();
    const hasDigit = /\d/.test(val);
    if (val.length < 3 || hasDigit) {
      ids.apartment = val;
      s = s.replace(aptMatch[0], ' ');
    }
  }

  const blockMatch = s.match(/\b(?:toa\s*nha|toa|block|thap|tower|building)\b\s*[:\.]?\s*([a-z0-9]+)/i);
  if (blockMatch && blockMatch[1] && !/^(phuong|xa|quan|huyen|tinh|lac|do)$/i.test(blockMatch[1])) {
    const val = blockMatch[1].toUpperCase();
    const hasDigit = /\d/.test(val);
    if (val.length < 3 || hasDigit) {
      ids.block = val;
      s = s.replace(blockMatch[0], ' ');
    }
  }

  // 3. GIẤY TỜ PHÁP LÝ: GCN, Sổ đỏ, Sổ hồng, Số seri phát hành (cho phép không chữ cái đầu)
  const certMatch = s.match(/(?:gcn|qsdd|so\s*do|so\s*hong|giay\s*chung\s*nhan|phat\s*hanh|seri|so\s*hieu)[^\d]{0,50}\b([a-z]{0,2}\s*[0-9]{4,10})\b/i);
  if (certMatch) {
    ids.certificateNumber = certMatch[1].replace(/\s+/g, '').toUpperCase();
    s = s.replace(certMatch[0], ' ');
  }

  const certEntryMatch = s.match(/(?:vao\s*so\s*cap|so\s*vao\s*so|vao\s*so)[^\d]{0,30}\b([a-z]{0,2}\s*[0-9]{3,9})\b/i);
  if (certEntryMatch) {
    ids.certificateEntryNumber = certEntryMatch[1].replace(/\s+/g, '').toUpperCase();
    s = s.replace(certEntryMatch[0], ' ');
  }

  // 4. XE CỘ: Biển số, Số khung, Số máy (Bắt cả case viết tắt SK, SM, và có dash)
  const bksMatch = s.match(/(?:bien\s*so|bks|bs|bien\s*kiem\s*soat|so\s*xe)[:\s\-\.]*([0-9]{2}[\s\-\.]*[a-zđ][a-z0-9]?[\s\-\.]*(?:[0-9][\s\-\.]*){4,6})/i) || s.match(/\b([0-9]{2}[\s\-\.]*[a-zđ][a-z0-9]?[\s\-\.]*(?:[0-9][\s\-\.]*){4,6})\b/i);
  if (bksMatch) {
    ids.licensePlate = bksMatch[1].replace(/[\s.\-\/]/g, '').toUpperCase();
    s = s.replace(bksMatch[0], ' ');
  }

  const skMatch = s.match(/(?:so\s*khung|sk|chassis|vin)[:\s\-\.]*([a-z0-9\-\.]{6,30})/i);
  if (skMatch) {
    ids.chassisNumber = skMatch[1].replace(/[\s.-]/g, '').toUpperCase();
    s = s.replace(skMatch[0], ' ');
  }

  const smMatch = s.match(/(?:so\s*may|sm|engine|motor)[:\s\-\.]*([a-z0-9\-\.]{6,30})/i);
  if (smMatch) {
    ids.engineNumber = smMatch[1].replace(/[\s.-]/g, '').toUpperCase();
    s = s.replace(smMatch[0], ' ');
  }

  // 5. KHOẢN NỢ / DOANH NGHIỆP: Tên công ty nợ, MST, Số hợp đồng
  const debtMatch = s.match(/(?:khoan\s*no\s*cua|no\s*cua|tai\s*san\s*cua)\s*(?:cty|cong\s*ty|doanh\s*nghiep)\s+([a-z0-9\s]{5,60})(?:-|\s+mst|,|$)/i);
  if (debtMatch) {
    ids.debtorName = debtMatch[1].trim().toUpperCase();
    s = s.replace(debtMatch[0], ' ');
  }

  const mstMatch = s.match(/(?:ma\s*so\s*thue|mst)[:\s]*(\d{10}(?:[-]\d{3})?)/i);
  if (mstMatch) {
    ids.taxCode = mstMatch[1];
    s = s.replace(mstMatch[0], ' ');
  }

  const contractMatch = s.match(/(?:hop\s*dong|hdtd|hdtc|so\s*hd)[:\s]*([a-z0-9\/\-]{5,30})/i);
  if (contractMatch) {
    ids.contractNumber = contractMatch[1].replace(/[\s]/g, '').toUpperCase();
    s = s.replace(contractMatch[0], ' ');
  }

  // 6. MÁY MÓC / ĐIỆN TỬ: Serial, Model, SKU
  const serialMatch = s.match(/(?:serial|seri|s\/n|so\s*hieu)[:\s]*([a-z0-9\-]{5,25})/i);
  if (serialMatch) {
    const val = serialMatch[1].replace(/[\s.-]/g, '').toUpperCase();
    const prefix = val.match(/^[A-Z]+/);
    const prefixStr = prefix ? prefix[0] : '';
    const blacklistedPrefixes = ['MS', 'TB', 'QD', 'CV', 'QDTHAA', 'P', 'Q', 'TO', 'KP', 'AP'];
    if (!blacklistedPrefixes.includes(prefixStr)) {
      ids.serialNumber = val;
      s = s.replace(serialMatch[0], ' ');
    }
  } else {
    // Alphanumeric codes (VD: PK123456, AB-1234) - fallback khi không có từ khoá
    const codeMatch = s.match(/\b([a-z]{1,4}[\-][0-9]{3,10}|[a-z]{1,4}[0-9]{3,10})\b/i);
    if (codeMatch) {
      const code = codeMatch[1].replace(/[\s.-]/g, '').toUpperCase();
      // Không lấy làm serial nếu nó trùng với biển số, số khung, số máy đã lấy
      if (code !== ids.licensePlate && code !== ids.chassisNumber && code !== ids.engineNumber) {
        const prefix = code.match(/^[A-Z]+/);
        const prefixStr = prefix ? prefix[0] : '';
        const blacklistedPrefixes = ['MS', 'TB', 'QD', 'CV', 'QDTHAA', 'P', 'Q', 'TO', 'KP', 'AP'];
        if (!blacklistedPrefixes.includes(prefixStr)) {
          ids.serialNumber = code;
          s = s.replace(codeMatch[0], ' ');
        }
      }
    }
  }

  // Diện tích (m2) - Lấy số lẻ thập phân để tăng độ chính xác
  const areaMatch = s.match(/(\d+(?:[,\.]\d+)?)\s*(?:m2|met\s*vuong)/i);
  if (areaMatch) ids.area = areaMatch[1].replace(',', '.');

  // Ki ốt / Kios / Quầy / Gian hàng
  const kioskMatch = s.match(/\b(?:ki\s*ot|kios|quay|gian\s*hang)\b\s*(?:so)?\s*[:\.]?\s*([a-z0-9]+(?:[/-][a-z0-9]+)?)/i);
  if (kioskMatch) {
    const val = kioskMatch[1].toUpperCase();
    const hasDigit = /\d/.test(val);
    if (val.length < 3 || hasDigit) {
      ids.kiosk = val;
      s = s.replace(kioskMatch[0], ' ');
    }
  }

  // Tàu thuyền (Số đăng ký / Ký hiệu) (VD: SG-1234, HP-12345, QN-1234-TS)
  const shipMatch = s.match(/(?:tau\s*ca|tau\s*bien|so\s*dang\s*ky|ky\s*hieu|tau|thuyen)\s*[:\.]?\s*([a-z]{2,4}[\s.-]*[0-9]{4,5}(?:[\s.-]*[a-z]{1,2})?)/i);
  if (shipMatch) {
    ids.shipNumber = shipMatch[1].replace(/[\s.-]/g, '').toUpperCase();
    s = s.replace(shipMatch[0], ' ');
  }

  // Chủ tài sản / Người nợ (Ông/Bà/Công ty) (Thêm các case viết tắt và từ khoá chu so huu)
  const ownerMatch = s.match(/(?:cua|so\s*huu\s*cua|no\s*cua|chu\s*so\s*huu|nguoi\s*co\s*tai\s*san|dung\s*ten)[:\s]*(?:ong|ba|cty|cong\s*ty)?\s+([a-z\s]{5,45})(?:\s*tai|\s*dia\s*chi|,|$)/i);
  if (ownerMatch) {
    const rawOwner = ownerMatch[1].trim().toUpperCase();
    const lowerOwner = rawOwner.toLowerCase();
    const blacklistedTerms = [
      'chu no', 'ben nhan', 'bao dam', 'the chap', 'tai san', 'dau gia', 
      'quy dinh', 'phap luat', 'quyen', 'nghia vu', 'chuyen giao', 'uy quyen',
      'thi hanh an', 'chi cuc', 'cuc thi hanh', 'quyen so huu', 'quyen su dung'
    ];
    const isBoilerplate = blacklistedTerms.some(term => lowerOwner.includes(term));
    if (!isBoilerplate) {
      ids.ownerName = rawOwner;
    }
  }

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
  const communeRegex = /\b(?:phuong\b|xa\b|thi\s*tran\b|p(?=\s|\.|\d))\.?\s*((?:(?!\b(?:phuong|quan|xa|huyen|p|q|tinh|tp|thanh|thanh\s*pho)\b)[a-z0-9\s]){1,30})(?=,|$|[\s]+(?:quan\b|huyen\b|tp\b|thanh\b|hcm\b|phuong\b|quan\b|xa\b|huyen\b|p\b|q\b))/gi;
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
  const districtRegex = /\b(?:quan\b|huyen\b|thi\s*xa\b|tp\b|thanh\s*pho\b|q(?=\s|\.|\d))\.?\s*((?:(?!\b(?:phuong|quan|xa|huyen|p|q|tinh|tp|thanh|thanh\s*pho)\b)[a-z0-9\s]){1,30})(?=,|$|[\s]+(?:tinh\b|tp\b|thanh\b|hcm\b|phuong\b|quan\b|xa\b|huyen\b|p\b|q\b))/gi;
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

  // Trích xuất Số nhà (House number) - hỗ trợ số nhà nhiều xuyệt
  let houseMatch = s.match(/(?:so\s*nha|dia\s*chi|tai\s*so|nha\s*o\s*so|nha\s*dat\s*so|nha\s*so|toa\s*lac\s*tai|toa\s*lac)\s*[:\.]?\s*([0-9]+[a-z0-9\/\-]*)\b/i);
  if (!houseMatch) {
    houseMatch = s.match(/(?<!\b(?:thua|to|tbd|ban\s*do|to\s+ban\s*do|ban|do|lo|o|gcn|seri|qd|quyet\s+dinh|cv|cong\s+van|ban\s+an|ba|so|sk|sm|chuyen\s+khoan|hop\s*dong|hdtd|hdtc|so\s*hd|dong|lan|dot|nhom|chi\s*tiet|ky|gia|tien|dieu|khoan|nghi\s*quyet|thong\s*bao|giay|chung\s*nhan)\s+(?:dat\s+)?(?:so\s+)?)\bso\s*[:\.]?\s*([0-9]+[a-z0-9\/\-]*)\b/i);
  }
  if (houseMatch && !/^(19|20)\d{2}$/.test(houseMatch[1])) {
    const val = houseMatch[1].replace(/\s+/g, '').toUpperCase();
    // Tránh trùng với các số định danh khác đã nhận diện
    if (val !== ids.plotNumber && val !== ids.mapSheet && val !== ids.apartment && val !== ids.block) {
      ids.houseNumber = val;
    }
  }

  return ids;
}

/**
 * Chuẩn hoá tên người hoặc tên công ty để đối chiếu chéo thông minh
 */
function normalizeNameIdentifier(nameStr) {
  if (!nameStr) return '';
  return removeDiacritics(nameStr.toLowerCase())
    .replace(/\b(cong ty|tnhh|cp|co phan|mttv|mtv|ong|ba|doanh nghiep|hop tac xa|htx|thuong mai|dich vu|tm|dv|san xuat|sx|dau tu|dt|xay dung|xd)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * So sánh 2 bộ property identifiers.
 * Trả về true nếu CÓ MÂU THUẪN thực sự: cùng loại identifier nhưng giá trị KHÁC nhau.
 */
function hasConflictingIdentifiers(idsA, idsB) {
  // Relax vehicle keys conflicts if at least 2 strong identifiers match exactly
  let vehicleMatchCount = 0;
  const vKeys = ['licensePlate', 'chassisNumber', 'engineNumber'];
  for (const key of vKeys) {
    if (idsA[key] && idsB[key]) {
      const valA = idsA[key].replace(/[^A-Z0-9]/g, '');
      const valB = idsB[key].replace(/[^A-Z0-9]/g, '');
      if (valA === valB && valA.length >= 4) {
        vehicleMatchCount++;
      }
    }
  }
  if (vehicleMatchCount >= 2) {
    idsA = { ...idsA };
    idsB = { ...idsB };
    for (const key of vKeys) {
      const valA = idsA[key] ? idsA[key].replace(/[^A-Z0-9]/g, '') : '';
      const valB = idsB[key] ? idsB[key].replace(/[^A-Z0-9]/g, '') : '';
      if (valA !== valB) {
        delete idsA[key];
        delete idsB[key];
      }
    }
  }

  // Relax area checks for properties if plotNumber and mapSheet match exactly and location matches
  if (idsA.plotNumber && idsB.plotNumber && idsA.mapSheet && idsB.mapSheet &&
      idsA.plotNumber === idsB.plotNumber && idsA.mapSheet === idsB.mapSheet) {
    const sameCommune = idsA.commune && idsB.commune && idsA.commune === idsB.commune;
    const sameDistrict = idsA.district && idsB.district && idsA.district === idsB.district;
    if (sameCommune || sameDistrict) {
      idsA = { ...idsA };
      delete idsA.area;
      idsB = { ...idsB };
      delete idsB.area;
    }
  }

  // Relax area checks for properties if houseNumber matches exactly and location matches
  if (idsA.houseNumber && idsB.houseNumber && idsA.houseNumber === idsB.houseNumber) {
    const sameCommune = idsA.commune && idsB.commune && idsA.commune === idsB.commune;
    const sameDistrict = idsA.district && idsB.district && idsA.district === idsB.district;
    if (sameCommune || sameDistrict) {
      idsA = { ...idsA };
      delete idsA.area;
      idsB = { ...idsB };
      delete idsB.area;
    }
  }

  // 1. Thửa đất (plotNumber) & Tờ bản đồ (mapSheet) - cho phép lệch nhẹ chứa nhau
  if (idsA.plotNumber && idsB.plotNumber && idsA.plotNumber !== idsB.plotNumber) {
    const pA = idsA.plotNumber.toLowerCase();
    const pB = idsB.plotNumber.toLowerCase();
    if (!pA.includes(pB) && !pB.includes(pA)) {
      return true;
    }
  }
  if (idsA.mapSheet && idsB.mapSheet && idsA.mapSheet !== idsB.mapSheet) {
    const mA = idsA.mapSheet.toLowerCase();
    const mB = idsB.mapSheet.toLowerCase();
    if (!mA.includes(mB) && !mB.includes(mA)) {
      return true;
    }
  }

  // 2. Xe cộ & máy móc: Biển số, Số khung, Số máy, Số tàu - chuẩn hoá so sánh
  const vehicleKeys = ['licensePlate', 'chassisNumber', 'engineNumber', 'shipNumber', 'serialNumber'];
  for (const key of vehicleKeys) {
    if (idsA[key] && idsB[key]) {
      const valA = idsA[key].replace(/[^A-Z0-9]/g, '');
      const valB = idsB[key].replace(/[^A-Z0-9]/g, '');
      if (valA !== valB) {
        if (!valA.endsWith(valB) && !valB.endsWith(valA)) {
          return true;
        }
      }
    }
  }

  // 3. Chung cư / Ki-ốt: Căn hộ, Tòa, Tầng, Ki-ốt - strict check
  const strictKeys = ['apartment', 'block', 'floor', 'kiosk', 'lot'];
  for (const key of strictKeys) {
    if (idsA[key] && idsB[key] && idsA[key] !== idsB[key]) {
      return true;
    }
  }

  // 3.5. Số nhà (houseNumber) - cho phép chứa nhau (VD: 120 vs 120/5) nhưng mâu thuẫn nếu khác hẳn
  if (idsA.houseNumber && idsB.houseNumber && idsA.houseNumber !== idsB.houseNumber) {
    const hA = idsA.houseNumber.toLowerCase();
    const hB = idsB.houseNumber.toLowerCase();
    if (!hA.includes(hB) && !hB.includes(hA)) {
      return true;
    }
  }

  // 4. Sổ đỏ, Hợp đồng, MST, Số vào sổ (Mã định danh alphanumeric)
  const codeKeys = ['certificateNumber', 'certificateEntryNumber', 'contractNumber', 'taxCode'];
  for (const key of codeKeys) {
    if (idsA[key] && idsB[key]) {
      const numA = idsA[key].replace(/[^0-9]/g, '');
      const numB = idsB[key].replace(/[^0-9]/g, '');
      if (numA.length >= 4 && numB.length >= 4 && numA !== numB) {
        if (!numA.includes(numB) && !numB.includes(numA)) {
          return true;
        }
      } else if (idsA[key] !== idsB[key]) {
        return true;
      }
    }
  }

  // 5. Tên chủ sở hữu / Tên người nợ - so sánh mềm
  const nameKeys = ['ownerName', 'debtorName'];
  for (const key of nameKeys) {
    if (idsA[key] && idsB[key]) {
      const normA = normalizeNameIdentifier(idsA[key]);
      const normB = normalizeNameIdentifier(idsB[key]);
      if (normA && normB && normA !== normB) {
        if (normA.includes(normB) || normB.includes(normA)) {
          continue;
        }
        const setA = new Set(normA.split(' '));
        const setB = new Set(normB.split(' '));
        const sim = jaccardSimilarity(setA, setB);
        if (sim < 0.5) {
          return true;
        }
      }
    }
  }

  // 6. Địa bàn Quận/Huyện, Xã/Phường
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

  // 7. Diện tích (area) - cho phép chênh lệch tối đa 2.0 m2
  if (idsA.area && idsB.area) {
    const diff = Math.abs(parseFloat(idsA.area) - parseFloat(idsB.area));
    if (diff > 2.0) return true;
  }

  return false;
}

function hasMatchingStrongIdentifiers(idsA, idsB) {
  // 1. Mã số thuế (MST) - MST khớp là chắc chắn 100% cùng 1 công ty
  if (idsA.taxCode && idsB.taxCode && idsA.taxCode === idsB.taxCode) {
    return true;
  }

  // 2. Xe cộ & máy móc: Biển số, Số khung, Số máy, Số tàu
  const vehicleKeys = ['licensePlate', 'chassisNumber', 'engineNumber', 'shipNumber'];
  for (const key of vehicleKeys) {
    if (idsA[key] && idsB[key]) {
      const valA = idsA[key].replace(/[^A-Z0-9]/g, '');
      const valB = idsB[key].replace(/[^A-Z0-9]/g, '');
      if (valA === valB && valA.length >= 4) {
        return true;
      }
    }
  }

  // 3. Sổ đỏ (certificateNumber) - Khớp số seri giấy chứng nhận
  if (idsA.certificateNumber && idsB.certificateNumber) {
    const valA = idsA.certificateNumber.replace(/[^A-Z0-9]/g, '');
    const valB = idsB.certificateNumber.replace(/[^A-Z0-9]/g, '');
    if (valA === valB && valA.length >= 5) {
      return true;
    }
  }

  // 4. BẤT ĐỘNG SẢN: Cùng "thửa đất" + cùng "tờ bản đồ"
  if (idsA.plotNumber && idsB.plotNumber && idsA.mapSheet && idsB.mapSheet &&
      idsA.plotNumber === idsB.plotNumber && idsA.mapSheet === idsB.mapSheet) {
    return true;
  }

  // 5. BẤT ĐỘNG SẢN (Đất nền): Cùng "thửa đất" + cùng Phường/Xã + không lệch Tờ bản đồ
  if (idsA.plotNumber && idsB.plotNumber && idsA.plotNumber === idsB.plotNumber) {
    const sameCommune = idsA.commune && idsB.commune && idsA.commune === idsB.commune;
    const sameDistrict = idsA.district && idsB.district && idsA.district === idsB.district;
    if (sameCommune || sameDistrict) {
      if (!idsA.mapSheet || !idsB.mapSheet || idsA.mapSheet === idsB.mapSheet) {
        return true;
      }
    }
  }

  // 6. ĐỊA CHỈ: Cùng số nhà + cùng Quận/Huyện + cùng tỉnh (hoặc số nhà phức tạp và không mâu thuẫn quận/phường)
  if (idsA.houseNumber && idsB.houseNumber && idsA.houseNumber === idsB.houseNumber) {
    const sameDistrict = idsA.district && idsB.district && idsA.district === idsB.district;
    if (sameDistrict) {
      return true;
    }
    const isComplex = idsA.houseNumber.includes('/') || idsA.houseNumber.includes('-') || idsA.houseNumber.length >= 3;
    if (isComplex) {
      const conflictDistrict = idsA.district && idsB.district && idsA.district !== idsB.district;
      const conflictCommune = idsA.commune && idsB.commune && idsA.commune !== idsB.commune;
      if (!conflictDistrict && !conflictCommune) {
        return true;
      }
    }
  }

  // 7. CHỦ SỞ HỮU + ĐỊA ĐIỂM: Cùng tên chủ nợ/chủ tài sản + cùng thửa hoặc cùng số nhà
  if (idsA.ownerName && idsB.ownerName) {
    const normA = normalizeNameIdentifier(idsA.ownerName);
    const normB = normalizeNameIdentifier(idsB.ownerName);
    if (normA && normB && normA === normB && normA.split(' ').length >= 2) {
      if (idsA.plotNumber && idsB.plotNumber && idsA.plotNumber === idsB.plotNumber) {
        return true;
      }
      if (idsA.houseNumber && idsB.houseNumber && idsA.houseNumber === idsB.houseNumber) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Kiểm tra xem một tiêu đề có phải là tiêu đề chung chung/boilerplate hay không
 */
function isGenericTitle(title) {
  if (!title) return true;
  const clean = removeDiacritics(title.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // If too short, it's generic
  if (clean.length < 15) return true;

  // Check if it's purely boilerplate
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
    'quan ly su dung tai san cong',
    'quan ly su dung tai san nha nuoc',
    'quan ly su dung tai san',
    'tai san thanh ly',
    'tai san ban thanh ly',
    'phuong tien vi pham hanh chinh',
    'phuong tien vi pham',
    'tang vat vi pham',
    'tang vat phuong tien',
    'tich thu sung cong quy',
    'tich thu sung quy',
    'xac lap quyen so huu toan dan'
  ];

  const genericWords = [
    'tai san', 'lo', 'so', 'lan', 'dot', 'nhom', 'dan', 'danh sach', 'chi tiet', 'kem theo',
    'ban thanh ly', 'thanh ly', 'thu hoi', 'khong co nhu cau su dung', 'vat tu', 'thiet bi',
    'quy quyen', 'giay chung nhan', 'theo', 've', 'cua', 'cho', 'tai', 'la', 'co', 'va',
    'quan ly', 'su dung', 'nha nuoc', 'cong san', 'tai san cong', 'co quan', 'don vi',
    'hanh chinh', 'dan su', 'thi hanh an', 'khoan no', 'bao dam', 'the chap', 'cam co',
    'tin dung', 'ngan hang', 'no xau', 'dau gia', 'ban dau gia', 'xe o to', 'xe mo to',
    'xe gan may', 'o to', 'mo to', 'xe may', 'xe mo', 'xe tai', 'xe con', 'xe khach',
    'phoi ban', 'tang vat', 'phuong tien', 'tich thu', 'sung quy', 'sung cong',
    'ban phe lieu', 'phe lieu', 'phế lieu', 'ban phế liệu'
  ];

  // Remove all boilerplate phrases
  let remaining = clean;
  for (const phrase of boilerplatePhrases) {
    remaining = remaining.replace(new RegExp(phrase, 'g'), ' ');
  }

  // Remove all generic words
  for (const word of genericWords) {
    remaining = remaining.replace(new RegExp('\\b' + word + '\\b', 'g'), ' ');
  }

  // Remove all numbers and single chars
  remaining = remaining.replace(/[0-9]/g, ' ');
  remaining = remaining.replace(/\b[a-z]\b/g, ' ');
  
  remaining = remaining.replace(/\s+/g, '').trim();

  // If what is left is very short, it is generic!
  if (remaining.length < 10) {
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
 * Kiểm tra xem một số có ý nghĩa để phân biệt tài sản hay không (loại bỏ single digits, common years, round tens)
 */
function isSignificantNumber(num) {
  if (!num) return false;
  if (num.length < 3) return false; // Must be at least 3 digits (e.g. 100, 236, 491, etc.)
  const val = parseInt(num, 10);
  if (!isNaN(val) && val >= 1990 && val <= 2030) return false;
  return true;
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
  const combined = removeDiacritics(`${propertyTypeName} ${propertyName}`.toLowerCase());

  // 1. Vehicles
  if (/\b(?:phuong tien|o to|xe mo to|xe may|xe gan may|xe tai|xe khach|xe ben|xe dau keo|ro mooc|xe cap|xe du lich|xe nang|xe cuoc|xe xuc|xe ui|tau|thuyen|cano|bien so|bks|so khung|so may)\b/i.test(combined)) {
    return 'car';
  }
  // 2. House / Apartments / Buildings
  if (/\b(?:nha o|can ho|chung cu|biet thu|ki ot|kios|quay ban|gian hang|nha tap the|toa nha|van phong|hotel|khach san|nha dat|nha xuong|kho bai|cong trinh xay dung)\b/i.test(combined)) {
    return 'house';
  }
  // 3. Land / Plots
  if (/\b(?:quyen su dung dat|dat dai|thua dat|dat o|dat trong cay|dat nong nghiep|qsd|qsdd|qsdđ|qsd dat|giay chung nhan quyen su dung)\b/i.test(combined)) {
    return 'land';
  }
  // 4. Machinery & Equipment
  if (/\b(?:may moc|thiet bi|day chuyen|he thong may|may phat dien|may tron|he thong|cong cu dung cu|vat tu)\b/i.test(combined)) {
    return 'machinery';
  }
  // 5. Public assets
  if (/\b(?:tai san cong|nha nuoc|cong vu|thanh ly tai san|ubnd)\b/i.test(combined)) {
    return 'public';
  }
  // 6. Judgement Enforcement
  if (/\b(?:thi hanh an|tha|chads|cctha|thi hanh an dan su)\b/i.test(combined)) {
    return 'enforcement';
  }

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
/**
 * Parse date từ format "dd/MM/yyyy HH:mm", "HH:mm dd/MM/yyyy", "yyyy-MM-dd" hoặc timestamp/ISO
 */
function parseDate(dateVal) {
  if (!dateVal) return null;

  // 0. Đã là kiểu Date
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }

  // 1. Timestamp (số)
  if (typeof dateVal === 'number') {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof dateVal === 'string') {
    const str = dateVal.trim();
    if (!str) return null;

    // 2. ISO String hoặc dạng chuẩn JS
    if (str.includes('T')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d;
    }

    // 3. "dd/MM/yyyy HH:mm:ss" hoặc "dd/MM/yyyy HH:mm" hoặc "dd/MM/yyyy"
    const match1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match1) {
      const [, d, mo, y, h, m, s] = match1;
      return new Date(
        parseInt(y, 10),
        parseInt(mo, 10) - 1,
        parseInt(d, 10),
        parseInt(h || '0', 10),
        parseInt(m || '0', 10),
        parseInt(s || '0', 10)
      );
    }

    // 4. "HH:mm dd/MM/yyyy" hoặc "HH:mm:ss dd/MM/yyyy"
    const match2 = str.match(/^(?:(\d{1,2}):(\d{2})(?::(\d{2}))?\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match2) {
      const [, h, m, s, d, mo, y] = match2;
      return new Date(
        parseInt(y, 10),
        parseInt(mo, 10) - 1,
        parseInt(d, 10),
        parseInt(h || '0', 10),
        parseInt(m || '0', 10),
        parseInt(s || '0', 10)
      );
    }

    // 5. "yyyy-MM-dd HH:mm:ss" hoặc "yyyy-MM-dd"
    const match3 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match3) {
      const [, y, mo, d, h, m, s] = match3;
      return new Date(
        parseInt(y, 10),
        parseInt(mo, 10) - 1,
        parseInt(d, 10),
        parseInt(h || '0', 10),
        parseInt(m || '0', 10),
        parseInt(s || '0', 10)
      );
    }

    // 6. Thử parse trực tiếp bằng Date Constructor
    const directDate = new Date(str);
    if (!isNaN(directDate.getTime())) return directDate;
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

function extractProvince(text, organizer = '') {
  if (!text && !organizer) return '';
  const str = ((text || '') + ' ' + (organizer || '')).normalize('NFC');
  
  // 1. Kiểm tra các TP lớn trực thuộc TW trước (TP.HCM, Hà Nội, Đà Nẵng, Hải Phòng, Cần Thơ)
  if (/(?:TP\.?\s*Hồ Chí Minh|TP\.?\s*HCM|Thành phố Hồ Chí Minh|\bTPHCM\b|\bHCM\b)/i.test(str)) {
    return 'TP. Hồ Chí Minh';
  }
  if (/(?:Thành phố Hà Nội|TP\.?\s*Hà Nội|\bHà Nội\b)/i.test(str)) {
    return 'Hà Nội';
  }
  if (/(?:Thành phố Đà Nẵng|TP\.?\s*Đà Nẵng|\bĐà Nẵng\b)/i.test(str)) {
    return 'Đà Nẵng';
  }
  if (/(?:Thành phố Hải Phòng|TP\.?\s*Hải Phòng|\bHải Phòng\b)/i.test(str)) {
    return 'Hải Phòng';
  }
  if (/(?:Thành phố Cần Thơ|TP\.?\s*Cần Thơ|\bCần Thơ\b)/i.test(str)) {
    return 'Cần Thơ';
  }

  // 2. Kiểm tra các tỉnh thành có từ khoá 'tỉnh [Tên]'
  const matchTinh = str.match(/\btỉnh\s+([A-ZÀÁẢÃẠĂẰẮẲẴẶẤẦẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][a-zàáảãạăằắẳẵặấầẩẫậnđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+(?:\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶẤẦẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][a-zàáảãạăằắẳẵặấầẩẫậnđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+){0,2})/i);
  if (matchTinh) {
    const raw = matchTinh[1].trim();
    if (raw.toLowerCase() !== 'phủ') return raw;
  }

  // 3. Xử lý loại trừ tên đường phổ biến (Điện Biên Phủ)
  if (/\bĐiện Biên Phủ\b/i.test(str) && !/\btỉnh Điện Biên\b/i.test(str)) {
    // Không nhận nhầm Điện Biên Phủ thành tỉnh Điện Biên
  } else if (/\bĐiện Biên\b/i.test(str)) {
    return 'Điện Biên';
  }

  const PROVINCES_LIST = [
    'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu',
    'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước',
    'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắc Lắc', 'Đắk Lắk', 'Đắk Nông',
    'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang',
    'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình',
    'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu',
    'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
    'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên',
    'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
    'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
    'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
    'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái'
  ];

  for (const p of PROVINCES_LIST) {
    if (new RegExp('\\b' + p + '\\b', 'i').test(str)) {
      return p === 'Đắc Lắc' ? 'Đắk Lắk' : p;
    }
  }

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

/**
 * Kiểm tra xem một tiêu đề có phải là thông báo bán nguyên lô/nhiều tài sản hay không.
 */
function isBatchNotice(name) {
  if (!name) return false;
  const clean = removeDiacritics(name).toLowerCase();
  
  const batchKeywords = [
    'nguyen lo',
    'tron lo',
    'lo gom',
    'nhieu tai san',
    'danh sach tai san',
    'thanh ly lo',
    'nguyen lo xe',
    'lo o to'
  ];
  
  for (const kw of batchKeywords) {
    if (clean.includes(kw)) return true;
  }
  
  if (/\b\d+\s*xe\b/.test(clean) || /\b\d+\s*tai\s*san\b/.test(clean) || /\b\d+\s*cong\s*cu\b/.test(clean)) {
    return true;
  }

  // 1. Kiểm tra tài sản 1 ... tài sản 2 hoặc lô 1 ... lô 2 hoặc ts 1 ... ts 2
  if (/\b(?:tai\s*san|ts|lo)\s*1\b.*\b(?:tai\s*san|ts|lo)\s*2\b/.test(clean)) {
    return true;
  }

  // 2. Kiểm tra có nhiều thửa đất khác nhau trong tiêu đề
  const plotMatches = clean.match(/\bthua\s*(?:dat\s*)?(?:so\s*)?\d+/g);
  if (plotMatches && plotMatches.length >= 2) {
    const uniquePlots = new Set(plotMatches.map(p => p.replace(/\s+/g, '')));
    if (uniquePlots.size >= 2) return true;
  }

  // 3. Kiểm tra có nhiều giấy chứng nhận khác nhau trong tiêu đề
  const certMatches = clean.match(/(?:gcn|qsdd|so\s*do|so\s*hong|giay\s*chung\s*nhan|phat\s*hanh|seri|so\s*hieu)[^\d]{0,50}\b([a-z]{0,2}\s*[0-9]{4,10})\b/g);
  if (certMatches && certMatches.length >= 2) {
    const uniqueCerts = new Set(certMatches.map(c => c.replace(/[^a-z0-9]/g, '')));
    if (uniqueCerts.size >= 2) return true;
  }
  
  return false;
}

function extractLocationIdentity(ids) {
  if (!ids) return '';
  const parts = [];
  if (ids.commune) parts.push(ids.commune);
  if (ids.district) parts.push(ids.district);
  if (ids.province) parts.push(ids.province);
  return removeDiacritics(parts.join(' ').toLowerCase()).replace(/\s+/g, ' ').trim();
}

function generateBlockingKeys(asset) {
  const keys = [];
  const pClean = removeDiacritics(asset.province || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ids = asset.identifiers || {};

  // 1. Xe cộ
  if (ids.licensePlate) {
    keys.push(`vehicle:plate:${ids.licensePlate}`);
  }
  if (ids.chassisNumber) {
    keys.push(`vehicle:chassis:${ids.chassisNumber}`);
  }
  if (ids.engineNumber) {
    keys.push(`vehicle:engine:${ids.engineNumber}`);
  }

  // 2. Pháp lý / Sổ đỏ
  if (ids.certificateNumber) {
    keys.push(`cert:${ids.certificateNumber}`);
  }
  if (ids.contractNumber) {
    keys.push(`contract:${ids.contractNumber}`);
  }
  if (ids.taxCode) {
    keys.push(`tax:${ids.taxCode}`);
  }

  // 3. Đất đai (Thửa / Tờ)
  if (ids.plotNumber && pClean) {
    if (ids.mapSheet) {
      keys.push(`land:pm:${pClean}:${ids.plotNumber}:${ids.mapSheet}`);
    }
    if (asset.district) {
      const dClean = removeDiacritics(asset.district).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (dClean) {
        keys.push(`land:pd:${pClean}:${dClean}:${ids.plotNumber}`);
      }
    }
  }

  // 4. Số nhà / Căn hộ
  if (ids.houseNumber && pClean) {
    const hClean = ids.houseNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
    keys.push(`addr:ph:${pClean}:${hClean}`);
  }
  if (ids.apartment && pClean) {
    const aClean = ids.apartment.toLowerCase().replace(/[^a-z0-9]/g, '');
    keys.push(`apt:pa:${pClean}:${aClean}`);
  }

  // 5. Tên chủ sở hữu
  if (asset.ownerName && pClean) {
    const oClean = normalizeNameIdentifier(asset.ownerName).replace(/\s+/g, '');
    const ignoredOwners = new Set(['nganhang', 'congty', 'chinhanh', 'ubnd', 'uybannhandan', 'doanhnghiep', 'trungtam', 'cuchihanhap']);
    if (oClean.length >= 5 && !ignoredOwners.has(oClean)) {
      keys.push(`owner:po:${pClean}:${oClean}`);
    }
  }

  // 6. Địa phương + Khoảng diện tích
  if (pClean && asset.district && asset.area) {
    const dClean = removeDiacritics(asset.district).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (dClean) {
      const areaBucket = Math.round(parseFloat(asset.area) / 10) * 10;
      if (!isNaN(areaBucket)) {
        keys.push(`loc_area:${pClean}:${dClean}:${areaBucket}`);
      }
    }
  }

  return [...new Set(keys)];
}

function isAssetTypeCompatible(typeA, typeB) {
  if (!typeA || !typeB || typeA === 'other' || typeB === 'other') return true;
  if (typeA === 'enforcement' || typeB === 'enforcement') return true;
  if (typeA === 'public' || typeB === 'public') return true;

  const isRealEstateA = (typeA === 'land' || typeA === 'house');
  const isRealEstateB = (typeB === 'land' || typeB === 'house');
  if (isRealEstateA && isRealEstateB) return true;

  return typeA === typeB;
}

function detectHardConflict(a, b) {
  const idsA = a.identifiers || {};
  const idsB = b.identifiers || {};

  // 1. Khác loại tài sản
  if (!isAssetTypeCompatible(a.assetType, b.assetType)) {
    return 'different_asset_type';
  }

  // 2. Khác tỉnh rõ ràng (cho phép khớp nếu trùng các chỉ số định danh thửa đất rất mạnh)
  if (a.province && b.province) {
    const provA = normalizeProvince(a.province);
    const provB = normalizeProvince(b.province);
    if (provA !== provB) {
      const samePlotAndMap = idsA.plotNumber && idsB.plotNumber && idsA.plotNumber === idsB.plotNumber && idsA.mapSheet && idsB.mapSheet && idsA.mapSheet === idsB.mapSheet;
      const sameDistrictAndWard = a.district && b.district && a.district === b.district && a.ward && b.ward && a.ward === b.ward;
      const sameCert = idsA.certificateNumber && idsB.certificateNumber && idsA.certificateNumber.replace(/[^A-Z0-9]/g, '') === idsB.certificateNumber.replace(/[^A-Z0-9]/g, '');

      if ((samePlotAndMap && sameDistrictAndWard) || sameCert) {
        // Bỏ qua xung đột tỉnh vì đây là lỗi trích xuất tỉnh sai
      } else {
        return 'different_province';
      }
    }
  }

  // 3. Khác số khung / số máy nếu cả hai đều có
  if (idsA.chassisNumber && idsB.chassisNumber && idsA.chassisNumber !== idsB.chassisNumber) {
    const valA = idsA.chassisNumber.replace(/[^A-Z0-9]/g, '');
    const valB = idsB.chassisNumber.replace(/[^A-Z0-9]/g, '');
    if (valA !== valB && !valA.endsWith(valB) && !valB.endsWith(valA)) {
      // Cho phép ghi đè trong hàm scoring nếu trùng biển số + số máy
    }
  }

  // 4. Khác số thửa trên cùng một tờ bản đồ và cùng vị trí địa lý
  if (idsA.plotNumber && idsB.plotNumber && idsA.mapSheet && idsB.mapSheet) {
    if (idsA.mapSheet === idsB.mapSheet && idsA.plotNumber !== idsB.plotNumber) {
      const sameWard = a.ward && b.ward && a.ward === b.ward;
      const sameDistrict = a.district && b.district && a.district === b.district;
      if (sameWard || sameDistrict) {
        return 'different_plot_same_map_sheet';
      }
    }
  }

  // 5. Khác số nhà trong cùng khu vực
  if (idsA.houseNumber && idsB.houseNumber && idsA.houseNumber !== idsB.houseNumber) {
    const sameWard = a.ward && b.ward && a.ward === b.ward;
    const sameDistrict = a.district && b.district && a.district === b.district;
    if (sameWard || sameDistrict) {
      const hA = idsA.houseNumber.toLowerCase();
      const hB = idsB.houseNumber.toLowerCase();
      if (!hA.includes(hB) && !hB.includes(hA)) {
        return 'different_house_number';
      }
    }
  }

  // 6. Khác số sổ đỏ rõ ràng
  if (idsA.certificateNumber && idsB.certificateNumber) {
    const cA = idsA.certificateNumber.replace(/[^A-Z0-9]/g, '');
    const cB = idsB.certificateNumber.replace(/[^A-Z0-9]/g, '');
    if (cA.length >= 6 && cB.length >= 6 && cA !== cB) {
      return 'different_certificate_number';
    }
  }

  return null;
}

function compareArea(a, b) {
  if (!a || !b) return { points: 0 };
  const valA = parseFloat(a);
  const valB = parseFloat(b);
  if (isNaN(valA) || isNaN(valB) || valA <= 0 || valB <= 0) return { points: 0 };

  const diff = Math.abs(valA - valB);
  const pct = diff / Math.max(valA, valB);

  if (diff <= 2 || pct <= 0.01) {
    return { points: 20, reason: 'area_very_close' };
  }
  if (diff <= 10 || pct <= 0.03) {
    return { points: 10, reason: 'area_close' };
  }
  if (pct <= 0.1) {
    return { points: -5, reason: 'area_somewhat_different' };
  }
  return { points: -20, reason: 'area_very_different' };
}

function compareRelistPrice(a, b) {
  if (!a || !b) return { points: 0 };
  const valA = parseFloat(a);
  const valB = parseFloat(b);
  if (isNaN(valA) || isNaN(valB) || valA <= 0 || valB <= 0) return { points: 0 };

  const high = Math.max(valA, valB);
  const low = Math.min(valA, valB);
  const dropPct = (high - low) / high;

  if (dropPct === 0) {
    return { points: 8, reason: 'same_price' };
  }
  if (dropPct > 0 && dropPct <= 0.3) {
    return { points: 12, reason: 'reasonable_price_drop' };
  }
  if (dropPct > 0.3 && dropPct <= 0.5) {
    return { points: 5, reason: 'large_but_possible_price_drop' };
  }
  return { points: -10, reason: 'price_too_different' };
}

function scoreAssetPair(a, b) {
  const reasons = [];
  const conflicts = [];

  // 1. Kiểm tra Hard Conflict
  const hardConflict = detectHardConflict(a, b);
  
  // Ngoại lệ đặc biệt cho xe cộ: Nếu trùng biển số + số máy hoặc số khung, cho phép bypass lệch số khung nhẹ
  let isVehicleBypass = false;
  const idsA = a.identifiers || {};
  const idsB = b.identifiers || {};
  if (a.assetType === 'car' && b.assetType === 'car') {
    let vehicleMatchCount = 0;
    const vKeys = ['licensePlate', 'chassisNumber', 'engineNumber'];
    for (const key of vKeys) {
      if (idsA[key] && idsB[key]) {
        const valA = idsA[key].replace(/[^A-Z0-9]/g, '');
        const valB = idsB[key].replace(/[^A-Z0-9]/g, '');
        if (valA === valB && valA.length >= 4) {
          vehicleMatchCount++;
        }
      }
    }
    if (vehicleMatchCount >= 2) {
      isVehicleBypass = true;
    }
  }

  if (hardConflict && !isVehicleBypass) {
    return {
      score: 0,
      decision: 'reject',
      conflicts: [hardConflict],
      reasons: []
    };
  }

  // 2. Kiểm tra trùng định danh xe cộ mạnh
  if (isVehicleBypass) {
    return {
      score: 95,
      decision: 'auto_group',
      reasons: ['same_vehicle_identity'],
      conflicts: []
    };
  }

  // So sánh biển số xe đơn lẻ
  if (idsA.licensePlate && idsB.licensePlate && idsA.licensePlate.replace(/[^A-Z0-9]/g, '') === idsB.licensePlate.replace(/[^A-Z0-9]/g, '')) {
    return {
      score: 90,
      decision: 'auto_group',
      reasons: ['same_license_plate'],
      conflicts: []
    };
  }

  // So sánh sổ đỏ / giấy chứng nhận mạnh
  if (idsA.certificateNumber && idsB.certificateNumber) {
    const valA = idsA.certificateNumber.replace(/[^A-Z0-9]/g, '');
    const valB = idsB.certificateNumber.replace(/[^A-Z0-9]/g, '');
    if (valA === valB && valA.length >= 5) {
      return {
        score: 90,
        decision: 'auto_group',
        reasons: ['same_certificate_number'],
        conflicts: []
      };
    }
  }

  let score = 0;

  // 3. So sánh thửa đất + tờ bản đồ
  if (idsA.plotNumber && idsB.plotNumber) {
    if (idsA.mapSheet && idsB.mapSheet && idsA.plotNumber === idsB.plotNumber && idsA.mapSheet === idsB.mapSheet) {
      score += 75;
      reasons.push('same_plot_and_map_sheet');
    } else if (idsA.plotNumber === idsB.plotNumber) {
      const sameWard = a.ward && b.ward && a.ward === b.ward;
      const sameDistrict = a.district && b.district && a.district === b.district;
      if (sameWard || sameDistrict) {
        score += 65;
        reasons.push('same_plot_shared_locality');
      }
    }
  }

  // 4. So sánh số nhà hoặc căn hộ
  if (idsA.houseNumber && idsB.houseNumber && idsA.houseNumber === idsB.houseNumber) {
    const sameDistrict = a.district && b.district && a.district === b.district;
    if (sameDistrict) {
      score += 40;
      reasons.push('same_house_number_district');
    }
  }
  if (idsA.apartment && idsB.apartment && idsA.apartment === idsB.apartment) {
    score += 40;
    reasons.push('same_apartment_number');
  }

  // 5. Địa lý (Xã/phường, Quận/huyện)
  if (a.province && b.province && a.province === b.province) {
    const dCleanA = removeDiacritics(a.district || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const dCleanB = removeDiacritics(b.district || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (dCleanA && dCleanB && dCleanA === dCleanB) {
      score += 15;
      reasons.push('same_district');
      
      const wCleanA = removeDiacritics(a.ward || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const wCleanB = removeDiacritics(b.ward || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (wCleanA && wCleanB && wCleanA === wCleanB) {
        score += 10;
        reasons.push('same_ward');
      } else if (wCleanA && wCleanB) {
        // Soft conflict: khác phường xã cùng quận
        score -= 5;
        conflicts.push('different_ward_in_district');
      }
    } else if (dCleanA && dCleanB) {
      // Khác huyện cùng tỉnh
      score -= 15;
      conflicts.push('different_district_in_province');
    }
  }

  // 6. Chủ sở hữu / Ngân hàng bảo lãnh
  if (a.ownerName && b.ownerName) {
    const normA = normalizeNameIdentifier(a.ownerName);
    const normB = normalizeNameIdentifier(b.ownerName);
    if (normA && normB && normA === normB && normA.split(' ').length >= 2) {
      score += 15;
      reasons.push('same_owner_name');
    }
  }
  if (idsA.bankName && idsB.bankName && idsA.bankName === idsB.bankName) {
    score += 10;
    reasons.push('same_bank_name');
  }

  // 7. So sánh diện tích (Area)
  const areaRes = compareArea(a.area, b.area);
  score += areaRes.points;
  if (areaRes.points > 0) reasons.push(areaRes.reason);
  if (areaRes.points < 0) conflicts.push(areaRes.reason);

  // 8. So sánh giá bán lại (Price)
  const priceRes = compareRelistPrice(a.startingPrice, b.startingPrice);
  score += priceRes.points;
  if (priceRes.points > 0) reasons.push(priceRes.reason);
  if (priceRes.points < 0) conflicts.push(priceRes.reason);

  // 9. So sánh độ tương đồng văn bản lõi (Jaccard / Overlap)
  if (a.coreIdentity && b.coreIdentity) {
    const setA = getBigrams(a.coreIdentity);
    const setB = getBigrams(b.coreIdentity);
    const jaccard = jaccardSimilarity(setA, setB);
    const overlap = overlapSimilarity(setA, setB);

    if (jaccard >= 0.8) {
      score += 25;
      reasons.push('high_fuzzy_similarity');
    } else if (jaccard >= 0.55) {
      score += 12;
      reasons.push('medium_fuzzy_similarity');
    } else if (overlap >= 0.85) {
      score += 15;
      reasons.push('high_overlap_similarity');
    }
  }

  // Phân loại quyết định
  const decision = score >= 85 ? 'auto_group' : (score >= 65 ? 'review' : 'no_match');

  return {
    score: Math.max(0, score),
    decision,
    reasons,
    conflicts
  };
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
  normalizeNameIdentifier,
  isSignificantNumber,
  isGenericTitle,
  isBatchNotice,
  extractLocationIdentity,
  generateBlockingKeys,
  detectHardConflict,
  compareArea,
  compareRelistPrice,
  scoreAssetPair,
};

