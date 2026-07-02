const { extractPropertyIdentifiers } = require('../src/utils/helpers');

const text = "Quyền sử dụng đất diện tích 72,7m²; Thuộc thửa đất số: 301; Tờ bản đồ số: 18; Mục đích sử dụng: Đất ở tại đô thị ; Tài sản gắn liền với đất là nhà ở riêng lẻ có diện tích: 61m2, diện tích xây dựng: 125,6m2; Cấp công trình: III; Số tầng: 2 tầng; Kết cấu: Tường gạch, sàn BT giả, mái tole tọa lạc tại 121/11 Kênh 19/5, Phường Sơn Kỳ, Quận Tân Phú theo Giấy chứng nhận Quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất số: BV 673185, số vào sổ cấp GCN: CHO1642 do UBND quận Tân Phú cấp ngày 08/01/2015 cho ông Bùi Đức Thiện, cập nhật chuyển nhượng ngày 22/11/2016 cho ông Trần Duy Hận.";

console.log("Raw text identifiers:", extractPropertyIdentifiers(text));
