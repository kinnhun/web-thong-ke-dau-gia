const { extractPropertyIdentifiers, removeDiacritics } = require('../bot-crawls-data/src/utils/helpers.js');

const text1 = `Quyền sử dụng đất và tài sản gắn liền với đất toạ lạc tại địa chỉ số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh được UBND Quận 1 cấp Giấy chứng nhận quyền sử dụng đất số AG 245065 ngày 30/10/2006. Gồm: a) Quyền sử dụng đất ở: - Thửa đất số 22, tờ bản đồ số 17. - Địa chỉ thửa đất: số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh. - Diện tích: 553,1m2. - Hình thức sử dụng: + Sử dụng riêng: 5,6m2 + Sử dụng chung: 267,0m2. - Mục đích sử dụng đất: Đất ở tại đô thị. - Thời hạn sử dụng đất: Lâu dài. - Nguồn gốc sử dụng đất: Nhà nước công nhận quyền sử dụng đất như Nhà nước giao đất có thu tiền sử dụng đất. b) Tài sản gắn liền với đất: Một phần biệt thự 3 tầng, diện tích xây dựng 133,89m2; kết cấu: tường gạch, sàn BTCT. Căn hộ ở tầng 1 + 2, diện tích sử dụng riêng: 59,93m2, diện tích sử dụng chung: 27,25m2 (phân bổ: 6,67m2). c) Ghi chú: - Lộ giới đường Lê Văn Hưu: 20,0m (10,0m + 10,0m) - Căn hộ thuộc một phần thửa 22, phần diện tích 280,5m2 còn lại thuộc các hộ khác sử dụng. d) Tại thời điểm kê biên tài sản, có diện tích xây dựng phát sinh ngoài diện tích được cấp Giấy chứng nhận quyền sử dụng đất. Phần xây dựng thêm này không được bán đấu giá và chủ sở hữu phần tài sản xây dựng thêm này đồng ý tự nguyện tháo dỡ để trả lại hiện trạng tài sản khi bán đấu giá thành và giao tài sản cho người mua được tài sản đấu giá. Chi phí phát sinh liên quan đến việc tháo dỡ này do chủ sở hữu phần xây dựng thêm chịu. (Thông tin tài sản theo Biên bản về việc kê biên, xử lý tài sản vào lúc 08 giờ 30 phút ngày 16 tháng 01 năm 2024 của Chi cục Thi hành án dân sự Quận 1).`;

const text2 = `Nhà ở và quyền sử dụng đất ở tại thửa đất số 22, tờ bản đồ số 17; địa chỉ thửa đất: 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh.`;

console.log('S1:', text1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
console.log('S2:', text2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

const plotMatch1 = text1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/(?:\bthua\b|\bt\b)\s*[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
const plotMatch2 = text2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/(?:\bthua\b|\bt\b)\s*[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
console.log('plotMatch1:', plotMatch1 ? plotMatch1[1] : null);
console.log('plotMatch2:', plotMatch2 ? plotMatch2[1] : null);

const mapMatch1 = text1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/(?:\bto\b|\btbd\b|\bban\s*do\b)\s*(?:so)?\s*[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
const mapMatch2 = text2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/(?:\bto\b|\btbd\b|\bban\s*do\b)\s*(?:so)?\s*[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
console.log('mapMatch1:', mapMatch1 ? mapMatch1[1] : null);
console.log('mapMatch2:', mapMatch2 ? mapMatch2[1] : null);
