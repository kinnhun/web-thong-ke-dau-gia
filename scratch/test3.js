const { extractPropertyIdentifiers } = require('../bot-crawls-data/src/utils/helpers.js');
const text1 = `Quyền sử dụng đất và tài sản gắn liền với đất toạ lạc tại địa chỉ số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh được UBND Quận 1 cấp Giấy chứng nhận quyền sử dụng đất số AG 245065 ngày 30/10/2006. Gồm: a) Quyền sử dụng đất ở: - Thửa đất số 22, tờ bản đồ số 17.`;
const text2 = `Nhà ở và quyền sử dụng đất ở tại thửa đất số 22, tờ bản đồ số 17; địa chỉ thửa đất: 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh.`;

console.log('ID1:', extractPropertyIdentifiers(text1));
console.log('ID2:', extractPropertyIdentifiers(text2));
