const s = "tai dia chi so 12-20 le van huu, phuong ben nghe";
const regex = /(?:so|tai|dia\s*chi|dia\s*chi\s*thua\s*dat)[:\s]*(?:so\s+)?(\d+[a-z]?(?:\/\d+[a-z]?)*)\s+([a-z\s]{2,30})(?:phuong|quan|huyen|xa|tp|thanh|hcm|$|,)/i;
const match = s.match(regex);
console.log(match);
