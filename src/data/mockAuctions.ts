export type AssetType =
  | "land"
  | "house"
  | "car"
  | "machinery"
  | "enforcement"
  | "public"
  | "other";

export type AuctionStatus =
  | "upcoming"
  | "receiving_docs"
  | "newly_reduced"
  | "watch";

export interface PriceHistoryEntry {
  round: number;
  publishedAt: string;
  startingPrice: number;
  deposit: number;
  organizer: string;
  owner: string;
  sourceUrl: string;
}

export interface Auction {
  id: string;
  groupId: string;
  name: string;
  shortDescription: string;
  type: AssetType;
  province: string;
  district: string;
  address: string;
  initialPrice: number;
  currentPrice: number;
  deposit: number;
  applicationFee: number;
  rounds: number;
  publishedAt: string;
  auctionDate: string;
  applicationDeadline: string;
  status: AuctionStatus;
  organizer: string;
  owner: string;
  sourceUrl: string;
  quality: string;
  history: PriceHistoryEntry[];
  isDuplicateSuspect?: boolean;
}

export const assetTypeLabel: Record<AssetType, string> = {
  land: "Quyền sử dụng đất",
  house: "Nhà ở",
  car: "Ô tô",
  machinery: "Máy móc thiết bị",
  enforcement: "Tài sản thi hành án",
  public: "Tài sản công",
  other: "Khác",
};

export const statusLabel: Record<AuctionStatus, string> = {
  upcoming: "Sắp đấu giá",
  receiving_docs: "Đang nhận hồ sơ",
  newly_reduced: "Mới giảm giá",
  watch: "Cần theo dõi",
};

const provinces = [
  "Hà Nội", "TP. Hồ Chí Minh", "Đồng Nai", "Bình Dương", "Long An",
  "Hải Phòng", "Đà Nẵng", "Cần Thơ", "Bắc Ninh", "Quảng Ninh",
  "Khánh Hòa", "Lâm Đồng", "Bà Rịa - Vũng Tàu", "Hưng Yên",
];

const organizers = [
  "Công ty Đấu giá Hợp danh Bắc Trung Nam",
  "Trung tâm Dịch vụ Đấu giá tài sản",
  "Công ty Đấu giá Hợp danh Toàn Cầu",
  "Công ty Đấu giá Hợp danh Hoàng Gia",
  "Trung tâm Đấu giá tài sản tỉnh",
  "Công ty Đấu giá Hợp danh Việt Nam",
];

const owners = [
  "Cục Thi hành án dân sự",
  "Ngân hàng TMCP Ngoại thương Việt Nam",
  "Ngân hàng TMCP Công thương Việt Nam",
  "UBND TP",
  "Công ty TNHH MTV Quản lý tài sản",
  "Chi cục Thi hành án dân sự quận",
];

const districts: Record<string, string[]> = {
  "Hà Nội": ["Hoàng Mai", "Long Biên", "Hà Đông", "Cầu Giấy", "Đông Anh"],
  "TP. Hồ Chí Minh": ["Quận 1", "Quận 7", "Quận 9", "Bình Tân", "Thủ Đức"],
  "Đồng Nai": ["Biên Hòa", "Long Thành", "Nhơn Trạch", "Trảng Bom"],
};

const getDistrict = (province: string) => {
  const arr = districts[province] || ["Trung tâm", "Phía Bắc", "Phía Nam"];
  return arr[Math.floor(Math.random() * arr.length)];
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysAhead(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

interface SeedConfig {
  name: string;
  type: AssetType;
  province: string;
  initialPrice: number;
  reductions: number[];
  quality: string;
  shortDescription: string;
}

const seeds: SeedConfig[] = [
  { name: "QSD đất 120m² tại P. Long Bình, TP. Biên Hòa", type: "land", province: "Đồng Nai", initialPrice: 4_200_000_000, reductions: [0, 10, 18, 28], quality: "Đất ở đô thị, sổ đỏ chính chủ", shortDescription: "Lô đất mặt tiền đường nhựa 12m, gần KCN Amata" },
  { name: "Toyota Camry 2.5Q sản xuất 2019", type: "car", province: "TP. Hồ Chí Minh", initialPrice: 980_000_000, reductions: [0, 8, 15, 22], quality: "Xe đã qua sử dụng, biển số TP.HCM", shortDescription: "Đã chạy 65,000 km, máy nguyên bản" },
  { name: "Nhà ở 3 tầng diện tích 85m² tại Hà Đông", type: "house", province: "Hà Nội", initialPrice: 6_800_000_000, reductions: [0, 12, 25, 35], quality: "Nhà mặt phố, sổ hồng riêng", shortDescription: "Nhà 3 tầng, 4 phòng ngủ, gần trường học" },
  { name: "QSD đất 250m² xã Long An, huyện Cần Giuộc", type: "land", province: "Long An", initialPrice: 2_100_000_000, reductions: [0, 15, 32], quality: "Đất nông nghiệp chuyển thổ cư", shortDescription: "Đất nền dự án, thổ cư 100%" },
  { name: "Mercedes-Benz C300 AMG 2020", type: "car", province: "Hà Nội", initialPrice: 1_650_000_000, reductions: [0, 10, 20], quality: "Xe sang, biển HN", shortDescription: "Xe đã chạy 42,000 km, full options" },
  { name: "Hệ thống dây chuyền sản xuất giấy", type: "machinery", province: "Bình Dương", initialPrice: 12_500_000_000, reductions: [0, 18, 30, 42], quality: "Máy móc nhập khẩu Đức, đã qua sử dụng", shortDescription: "Dây chuyền hoàn chỉnh công suất 50 tấn/ngày" },
  { name: "Căn hộ chung cư 78m² tại Q.7", type: "house", province: "TP. Hồ Chí Minh", initialPrice: 3_900_000_000, reductions: [0, 8, 14], quality: "Căn hộ 2PN, đã có sổ", shortDescription: "Tầng 12, view sông, đầy đủ nội thất" },
  { name: "QSD đất 1.250m² thị xã Phú Mỹ", type: "land", province: "Bà Rịa - Vũng Tàu", initialPrice: 8_500_000_000, reductions: [0, 12, 22, 31], quality: "Đất sản xuất kinh doanh", shortDescription: "Vị trí đắc địa, gần cảng" },
  { name: "Honda CR-V 1.5G 2021", type: "car", province: "Đà Nẵng", initialPrice: 920_000_000, reductions: [0, 6, 12], quality: "Xe gia đình, đăng kiểm còn dài", shortDescription: "Đã chạy 38,000 km, máy êm" },
  { name: "Tài sản thi hành án: Quyền sử dụng đất 180m²", type: "enforcement", province: "Hải Phòng", initialPrice: 3_200_000_000, reductions: [0, 14, 28, 38], quality: "Tài sản kê biên thi hành án", shortDescription: "Đất ở đô thị, đã có quyết định cưỡng chế" },
  { name: "QSD đất 95m² P. Hiệp Bình Chánh", type: "land", province: "TP. Hồ Chí Minh", initialPrice: 5_400_000_000, reductions: [0, 9, 17], quality: "Đất ở đô thị", shortDescription: "Hẻm xe hơi, gần Phạm Văn Đồng" },
  { name: "Mazda CX-5 Premium 2018", type: "car", province: "Cần Thơ", initialPrice: 680_000_000, reductions: [0, 12, 25, 33], quality: "Xe đã qua sử dụng", shortDescription: "Đã chạy 78,000 km" },
  { name: "Nhà phố 4 tầng 72m² Long Biên", type: "house", province: "Hà Nội", initialPrice: 8_200_000_000, reductions: [0, 10], quality: "Nhà mặt phố", shortDescription: "Nhà mới xây 2022, sổ hồng riêng" },
  { name: "Máy CNC Mazak Integrex i-200S", type: "machinery", province: "Bắc Ninh", initialPrice: 4_800_000_000, reductions: [0, 15, 30, 45], quality: "Máy CNC nhập Nhật", shortDescription: "Tình trạng hoạt động tốt" },
  { name: "QSD đất 500m² xã Tân Định", type: "land", province: "Bình Dương", initialPrice: 3_600_000_000, reductions: [0, 11, 20, 28], quality: "Đất ở nông thôn", shortDescription: "Mặt đường lớn, gần KCN VSIP" },
  { name: "Ford Ranger Wildtrak 2020", type: "car", province: "Đồng Nai", initialPrice: 850_000_000, reductions: [0, 8, 16], quality: "Xe bán tải", shortDescription: "Đã chạy 55,000 km, một đời chủ" },
  { name: "QSD đất 300m² huyện Đông Anh", type: "land", province: "Hà Nội", initialPrice: 5_100_000_000, reductions: [0, 7, 14, 22], quality: "Đất ở nông thôn", shortDescription: "Gần đường vành đai 4 quy hoạch" },
  { name: "Tài sản công: Nhà điều hành 240m²", type: "public", province: "Quảng Ninh", initialPrice: 7_500_000_000, reductions: [0, 16, 28], quality: "Nhà công vụ thanh lý", shortDescription: "Vị trí trung tâm thành phố" },
  { name: "Vinfast Lux SA2.0 2020", type: "car", province: "Hải Phòng", initialPrice: 720_000_000, reductions: [0, 14, 26, 36], quality: "Xe SUV cỡ trung", shortDescription: "Đã chạy 48,000 km" },
  { name: "Căn hộ The Sun Avenue 75m²", type: "house", province: "TP. Hồ Chí Minh", initialPrice: 4_200_000_000, reductions: [0, 9, 18, 27], quality: "Căn hộ 2PN", shortDescription: "Tầng cao, view nội khu" },
  { name: "QSD đất 180m² P. Bến Thủy", type: "land", province: "Đồng Nai", initialPrice: 2_800_000_000, reductions: [0, 13, 24, 36], quality: "Đất ở đô thị", shortDescription: "Hẻm 6m, khu dân cư hiện hữu" },
  { name: "Hyundai Santafe 2.4L 2019", type: "car", province: "Hà Nội", initialPrice: 780_000_000, reductions: [0, 11, 21], quality: "Xe SUV 7 chỗ", shortDescription: "Đã chạy 72,000 km" },
  { name: "Nhà 2 tầng 60m² P. Vĩnh Hòa", type: "house", province: "Khánh Hòa", initialPrice: 2_950_000_000, reductions: [0, 10, 19], quality: "Nhà cấp 4 cải tạo 2 tầng", shortDescription: "Gần biển, khu dân cư mới" },
  { name: "QSD đất 220m² P. 8, Đà Lạt", type: "land", province: "Lâm Đồng", initialPrice: 6_200_000_000, reductions: [0, 8, 15, 23, 32], quality: "Đất ở đô thị Đà Lạt", shortDescription: "View đồi thông, đường lớn 8m" },
  { name: "Máy in offset Heidelberg SM 74", type: "machinery", province: "TP. Hồ Chí Minh", initialPrice: 1_800_000_000, reductions: [0, 18, 32, 44], quality: "Máy in công nghiệp", shortDescription: "Sản xuất Đức, đã qua sử dụng" },
  { name: "Toyota Innova 2.0E 2018", type: "car", province: "Long An", initialPrice: 480_000_000, reductions: [0, 7, 13, 20], quality: "Xe gia đình 7 chỗ", shortDescription: "Đã chạy 105,000 km" },
  { name: "QSD đất 80m² Phố Vọng", type: "land", province: "Hà Nội", initialPrice: 7_900_000_000, reductions: [0, 6, 11], quality: "Đất ở đô thị", shortDescription: "Mặt phố kinh doanh tốt" },
  { name: "Nhà xưởng 1.500m² KCN Mỹ Phước", type: "enforcement", province: "Bình Dương", initialPrice: 18_500_000_000, reductions: [0, 15, 28, 40], quality: "Tài sản kê biên", shortDescription: "Nhà xưởng đầy đủ giấy phép" },
  { name: "QSD đất 150m² Văn Lâm", type: "land", province: "Hưng Yên", initialPrice: 1_950_000_000, reductions: [0, 12, 22], quality: "Đất ở nông thôn", shortDescription: "Gần KCN, sổ đỏ chính chủ" },
  { name: "Kia Carnival Premium 2022", type: "car", province: "TP. Hồ Chí Minh", initialPrice: 1_350_000_000, reductions: [0, 9, 17], quality: "MPV cao cấp", shortDescription: "Đã chạy 25,000 km" },
  { name: "Căn hộ Vinhomes Smart City 65m²", type: "house", province: "Hà Nội", initialPrice: 3_100_000_000, reductions: [0, 8, 14, 21], quality: "Căn hộ 2PN+1", shortDescription: "Đầy đủ nội thất, sẵn ở" },
  { name: "QSD đất 420m² huyện Trảng Bom", type: "land", province: "Đồng Nai", initialPrice: 2_400_000_000, reductions: [0, 14, 26, 38, 48], quality: "Đất nông nghiệp", shortDescription: "Mặt đường nhựa, gần khu công nghiệp" },
  { name: "Audi Q5 Sportback 2021", type: "car", province: "Hà Nội", initialPrice: 2_100_000_000, reductions: [0, 11, 19], quality: "SUV hạng sang", shortDescription: "Đã chạy 32,000 km, full options" },
  { name: "Nhà phố 3 tầng 90m² Cẩm Lệ", type: "house", province: "Đà Nẵng", initialPrice: 4_500_000_000, reductions: [0, 10, 20, 29], quality: "Nhà mặt phố", shortDescription: "Khu dân cư hiện hữu, gần trường" },
  { name: "QSD đất 60m² P. Bạch Đằng", type: "land", province: "Hải Phòng", initialPrice: 3_400_000_000, reductions: [0, 9], quality: "Đất ở đô thị", shortDescription: "Trung tâm thành phố" },
  { name: "Tài sản thi hành án: Lô đất 800m²", type: "enforcement", province: "Bình Dương", initialPrice: 11_200_000_000, reductions: [0, 17, 31, 43], quality: "Tài sản kê biên", shortDescription: "Đất sản xuất kinh doanh" },
  { name: "Honda City RS 2022", type: "car", province: "Cần Thơ", initialPrice: 590_000_000, reductions: [0, 5, 10, 16], quality: "Sedan hạng B", shortDescription: "Đã chạy 18,000 km" },
  { name: "QSD đất 95m² P. Hồng Bàng", type: "land", province: "Hải Phòng", initialPrice: 2_700_000_000, reductions: [0, 11, 22, 33], quality: "Đất ở đô thị", shortDescription: "Gần chợ, trường học" },
  { name: "Tài sản công: Ô tô Mazda BT-50", type: "public", province: "Bắc Ninh", initialPrice: 320_000_000, reductions: [0, 12, 23], quality: "Xe công vụ thanh lý", shortDescription: "Đã sử dụng 6 năm" },
  { name: "Nhà 2 tầng 110m² P. Trần Hưng Đạo", type: "house", province: "Quảng Ninh", initialPrice: 5_800_000_000, reductions: [0, 13, 25, 37], quality: "Nhà mặt phố trung tâm", shortDescription: "Vị trí kinh doanh tốt" },
];

function buildAuction(seed: SeedConfig, idx: number): Auction {
  const district = getDistrict(seed.province);
  const organizer = organizers[idx % organizers.length];
  const owner = owners[idx % owners.length];
  const rounds = seed.reductions.length;
  const totalReduction = seed.reductions[rounds - 1];
  const currentPrice = Math.round(seed.initialPrice * (1 - totalReduction / 100));
  const baseDaysAgo = 30 + idx * 4;

  const history: PriceHistoryEntry[] = seed.reductions.map((red, i) => {
    const price = Math.round(seed.initialPrice * (1 - red / 100));
    return {
      round: i + 1,
      publishedAt: daysAgo(baseDaysAgo - i * 12),
      startingPrice: price,
      deposit: Math.round(price * 0.1),
      organizer,
      owner,
      sourceUrl: `https://dgts.moj.gov.vn/dau-gia/${seed.type}-${idx}-${i}`,
    };
  });

  let status: AuctionStatus = "upcoming";
  if (totalReduction >= 25) status = "newly_reduced";
  else if (rounds >= 3) status = "watch";
  else if (idx % 4 === 0) status = "receiving_docs";

  return {
    id: `auction-${idx + 1}`,
    groupId: `group-${idx + 1}`,
    name: seed.name,
    shortDescription: seed.shortDescription,
    type: seed.type,
    province: seed.province,
    district,
    address: `${district}, ${seed.province}`,
    initialPrice: seed.initialPrice,
    currentPrice,
    deposit: Math.round(currentPrice * 0.1),
    applicationFee: 500_000,
    rounds,
    publishedAt: history[history.length - 1].publishedAt,
    auctionDate: daysAhead(7 + (idx % 21)),
    applicationDeadline: daysAhead(3 + (idx % 14)),
    status,
    organizer,
    owner,
    sourceUrl: history[history.length - 1].sourceUrl,
    quality: seed.quality,
    history,
    isDuplicateSuspect: idx % 13 === 0,
  };
}

export const auctions: Auction[] = seeds.map(buildAuction);

export const getDiscountPercent = (a: Auction): number =>
  ((a.initialPrice - a.currentPrice) / a.initialPrice) * 100;

export const getDiscountAmount = (a: Auction): number =>
  a.initialPrice - a.currentPrice;

export const provincesList = Array.from(new Set(auctions.map((a) => a.province))).sort();
export const organizersList = Array.from(new Set(auctions.map((a) => a.organizer))).sort();
export const ownersList = Array.from(new Set(auctions.map((a) => a.owner))).sort();
