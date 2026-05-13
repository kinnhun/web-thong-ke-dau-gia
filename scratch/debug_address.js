const { removeDiacritics } = require('./bot-crawls-data/src/utils/helpers');
const s = removeDiacritics(`Quyền sử dụng đất và tài sản gắn liền với đất toạ lạc tại địa chỉ số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh`).toLowerCase();
const regex = /(?:so|tai|dia\s*chi|dia\s*chi\s*thua\s*dat|dia\s*chi\s*tai)[:\s]*(?:so\s+)?(\d+[a-z]?(?:\/\d+[a-z]?)*)\s+([a-z\s]{2,30})(?:phuong|quan|huyen|xa|tp|thanh|hcm|$|,)/i;
const match = s.match(regex);
console.log('S:', s);
console.log('Match:', match);
