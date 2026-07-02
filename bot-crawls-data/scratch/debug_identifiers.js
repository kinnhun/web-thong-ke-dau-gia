const { extractPropertyIdentifiers } = require('../src/utils/helpers');

const names = [
  "06 xe mô tô gắn máy các loại hai bánh đã qua sử dụng",
  "06 xe ô tô các loại – bán từng xe (Chi tiết tại file đính kèm).",
  "(MS186/21)06 Xe nâng diesel nhãn hiệu Toyota model 02-7FD15 (Bán nguyên lô không tách rời).",
  "Tàu kéo tân cảng số 02 (Số đăng ký: SG-6899); Tàu cao tốc chở khách Tân Cảng 09 (Số đăng ký: SG-6101) ; 07 xe đầu kéo, 09 xe mô tô, 02 xe rơ mooc, 01 xe ca, 01 xe cứu hỏa, 13 xe đạp, 01 bồn dầu 25m3, 35 bình chữa cháy MFZ8, 25 tủ đựng bình chữa cháy, 01 bơm cứu hỏa (tất cả đã qua sử dụng, bán phế liệu) ",
  "06 Xe Nâng hiệu TOYOTA",
  "Lô 06 xe ô tô đã qua sử dụng, cụ thể: Xe Mitsubishi Pajero, BS: 80H-0913; Xe Toyota AE101, BS: 51A-2607; Xe Toyota Crown, BS: 80B-2028; Xe Toyota Crown, BS: 80B-2027; Xe Toyota Hiace, BS: 80B-2684; Xe Toyota Hiace, BS: 80B-2693.",
  "Xe ô tô con nhãn hiệu Toyota đã qua sử dụng, Biển số: 51A-2773.",
  "Lô 05 xe ô tô cũ các loại đã qua sử dụng do Cục Hành chính – Quản trị II, Văn phòng Chính phủ quản lý",
  "Đấu giá chung lô 06 xe ô tô",
  "06 xe đầu kéo và 04 mooc nội bộ đã qua sử dụng cần thanh lý (Bán riêng lẻ từng tài sản - Chi tiết tài sản và giá khởi điểm xem tại File đính kèm)  ",
  "Bán cùng lúc 02 xe ô tô 46 chỗ nhãn hiệu Samco, số loại KFE1 và 06 xe ô tô 12 chỗ nhãn hiệu Hyundai, số loại SOALTI."
];

for (const name of names) {
  console.log(`\nOriginal: ${name}`);
  const ids = extractPropertyIdentifiers(name);
  console.log(`Identifiers:`, JSON.stringify(ids, null, 2));
}
