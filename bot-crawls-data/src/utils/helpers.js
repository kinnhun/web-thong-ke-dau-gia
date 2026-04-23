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

function extractProvince(text) {
  if (!text) return '';
  for (const p of PROVINCES) {
    if (text.includes(p)) return p;
  }
  // Normalize TP. HCM variants
  if (text.includes('Hồ Chí Minh')) return 'TP. Hồ Chí Minh';
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
  deriveStatus,
  delay,
  PROVINCES,
};
