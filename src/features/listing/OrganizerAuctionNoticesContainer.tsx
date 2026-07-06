import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  X,
  History,
  RotateCcw,
  Filter,
  Split,
  RefreshCw,
} from "lucide-react";
import { Select as AntdSelect, DatePicker } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/vi";

const { RangePicker } = DatePicker;
dayjs.locale("vi");

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { StatusBadge } from "@/components/auction/StatusBadge";
import { DiscountBadge } from "@/components/auction/DiscountBadge";
import { 
  useAuctions, 
  useFilterOptions,
  assetTypeLabel,
  statusLabel,
  type AssetType 
} from "@/domains/auction";
import { 
  triggerOrganizerDuplicateScan,
  triggerOrganizerMissingDetailCrawl 
} from "@/services/auction.service";
import { formatDate, formatVND } from "@/lib/format";

type SortKey = "discount_pct" | "discount_amt" | "newest" | "price_asc" | "rounds_desc";
type ViewMode = "table" | "card";

const sortLabel: Record<SortKey, string> = {
  discount_pct: "% giảm cao nhất",
  discount_amt: "Số tiền giảm lớn nhất",
  newest: "Mới cập nhật nhất",
  price_asc: "Giá hiện tại thấp nhất",
  rounds_desc: "Nhiều lần đấu giá nhất",
};

interface Props {
  fixedOrganizer: string;
  title: string;
  description: string;
}

export function OrganizerAuctionNoticesContainer({ fixedOrganizer, title, description }: Props) {
  const router = useRouter();

  // Filters State
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<AssetType | "all">("all");
  const [province, setProvince] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [rounds, setRounds] = useState<string>("all");
  const [auctionDateRange, setAuctionDateRange] = useState<[string, string] | null>(null);
  const [publishedAtRange, setPublishedAtRange] = useState<[string, string] | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortKey, setSortKey] = useState<SortKey>("discount_pct");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [appliedFilters, setAppliedFilters] = useState({
    keyword: "",
    type: "all" as AssetType | "all",
    province: [] as string[],
    status: "all",
    maxPrice: "",
    rounds: "all",
    auctionDateFrom: "",
    auctionDateTo: "",
    publishedAtFrom: "",
    publishedAtTo: "",
  });

  // Sync with URL
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;
    
    if (q.keyword) setKeyword(q.keyword as string);
    if (q.type) setType(q.type as AssetType | "all");
    if (q.province) setProvince((q.province as string).split(","));
    setStatus((q.status as string) || "all");
    if (q.maxPrice) setMaxPrice(q.maxPrice as string);
    if (q.rounds) setRounds(q.rounds as string);
    if (q.page) setPage(Number(q.page));
    if (q.sort) setSortKey(q.sort as SortKey);
    if (q.view) setViewMode(q.view as ViewMode);
    
    if (q.auctionDateFrom && q.auctionDateTo) {
      setAuctionDateRange([q.auctionDateFrom as string, q.auctionDateTo as string]);
    }
    if (q.publishedAtFrom && q.publishedAtTo) {
      setPublishedAtRange([q.publishedAtFrom as string, q.publishedAtTo as string]);
    }

    setAppliedFilters({
      keyword: (q.keyword as string) || "",
      type: (q.type as AssetType | "all") || "all",
      province: (q.province as string)?.split(",") || [],
      status: (q.status as string) || "all",
      maxPrice: (q.maxPrice as string) || "",
      rounds: (q.rounds as string) || "all",
      auctionDateFrom: (q.auctionDateFrom as string) || "",
      auctionDateTo: (q.auctionDateTo as string) || "",
      publishedAtFrom: (q.publishedAtFrom as string) || "",
      publishedAtTo: (q.publishedAtTo as string) || "",
    });
  }, [router.isReady, router.query]);

  const updateUrl = (filters: typeof appliedFilters, p: number, s: SortKey, v: ViewMode) => {
    const query: any = { ...router.query };
    if (filters.keyword) query.keyword = filters.keyword; else delete query.keyword;
    if (filters.type !== "all") query.type = filters.type; else delete query.type;
    if (filters.province.length > 0) query.province = filters.province.join(","); else delete query.province;
    if (filters.status !== "all") query.status = filters.status; else delete query.status;
    if (filters.maxPrice) query.maxPrice = filters.maxPrice; else delete query.maxPrice;
    if (filters.rounds !== "all") query.rounds = filters.rounds; else delete query.rounds;
    if (filters.auctionDateFrom) query.auctionDateFrom = filters.auctionDateFrom; else delete query.auctionDateFrom;
    if (filters.auctionDateTo) query.auctionDateTo = filters.auctionDateTo; else delete query.auctionDateTo;
    if (filters.publishedAtFrom) query.publishedAtFrom = filters.publishedAtFrom; else delete query.publishedAtFrom;
    if (filters.publishedAtTo) query.publishedAtTo = filters.publishedAtTo; else delete query.publishedAtTo;
    
    if (p > 1) query.page = String(p); else delete query.page;
    if (s !== "discount_pct") query.sort = s; else delete query.sort;
    if (v !== "table") query.view = v; else delete query.view;

    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  const { data: filterOpts } = useFilterOptions();
  const provinceOptions = useMemo(() => (filterOpts?.provinces || []).map(p => ({ label: p, value: p })), [filterOpts?.provinces]);

  const params = useMemo(() => {
    const p: any = {
      page,
      limit: pageSize,
      organizer: fixedOrganizer,
      sort: sortKey,
      unique: 'true', // ★ Gộp các bài đăng lại của cùng 1 tài sản
    };
    if (appliedFilters.keyword) p.search = appliedFilters.keyword;
    if (appliedFilters.type !== "all") p.type = appliedFilters.type;
    if (appliedFilters.province.length > 0) p.province = appliedFilters.province.join(",");
    if (appliedFilters.status !== "all") p.status = appliedFilters.status;
    if (appliedFilters.maxPrice && !isNaN(parseFloat(appliedFilters.maxPrice))) {
      p.maxPrice = parseFloat(appliedFilters.maxPrice) * 1_000_000_000;
    }
    if (appliedFilters.rounds !== "all" && !isNaN(parseInt(appliedFilters.rounds))) {
      p.rounds = appliedFilters.rounds;
    }
    if (appliedFilters.auctionDateFrom) p.auctionDateFrom = dayjs(appliedFilters.auctionDateFrom).startOf('day').toISOString();
    if (appliedFilters.auctionDateTo) p.auctionDateTo = dayjs(appliedFilters.auctionDateTo).endOf('day').toISOString();
    if (appliedFilters.publishedAtFrom) p.publishedAtFrom = dayjs(appliedFilters.publishedAtFrom).startOf('day').toISOString();
    if (appliedFilters.publishedAtTo) p.publishedAtTo = dayjs(appliedFilters.publishedAtTo).endOf('day').toISOString();
    
    return p;
  }, [fixedOrganizer, page, sortKey, appliedFilters]);

  const { data, isLoading, isFetching } = useAuctions(params);
  const items = data?.items || [];
  const total = data?.pagination?.total || 0;
  const totalNotices = (data?.pagination as any)?.totalNotices || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  const [isScanning, setIsScanning] = useState(false);
  const [isCrawlingDetail, setIsCrawlingDetail] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState<{current: number, total: number, name: string} | null>(null);

  const handleSearch = () => {
    const newFilters = {
      keyword, type, province, status, maxPrice, rounds,
      auctionDateFrom: auctionDateRange?.[0] || "",
      auctionDateTo: auctionDateRange?.[1] || "",
      publishedAtFrom: publishedAtRange?.[0] || "",
      publishedAtTo: publishedAtRange?.[1] || "",
    };
    setAppliedFilters(newFilters);
    setPage(1);
    updateUrl(newFilters, 1, sortKey, viewMode);
  };

  const handleScanDuplicates = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn quét trùng lặp cho tất cả tài sản của đơn vị "${fixedOrganizer}"?`)) {
      return;
    }
    
    setIsScanning(true);
    try {
      const res = await triggerOrganizerDuplicateScan(fixedOrganizer);
      if (res.success) {
        alert(res.message + " Tiến trình đang chạy ngầm, vui lòng tải lại trang sau vài phút để xem kết quả.");
      } else {
        alert("Lỗi: " + res.message);
      }
    } catch (err: any) {
      alert("Lỗi khi quét trùng lặp: " + (err.response?.data?.message || err.message));
    } finally {
      setIsScanning(false);
    }
  };

  const handleCrawlMissingDetail = async () => {
    // 1. Lọc ra các bài viết thực sự thiếu dữ liệu trên trang hiện tại
    const missingItems = items.filter((item: any) => {
      if (!item.properties || item.properties.length === 0) return true;
      return item.properties.some((p: any) => !p.place || !p.startPrice);
    }) as any[];

    if (missingItems.length === 0) {
      alert("Tất cả các tài sản trên trang này đều đã có đầy đủ chi tiết.");
      return;
    }

    if (!window.confirm(`Phát hiện ${missingItems.length} bài viết thiếu chi tiết (Nơi có tài sản, giá...). Hệ thống sẽ quét và cào lại TỪNG BÀI MỘT để đảm bảo không bị sót. Quá trình này sẽ mất một khoảng thời gian, bạn có muốn tiếp tục?`)) {
      return;
    }
    
    setIsCrawlingDetail(true);
    try {
      const { triggerRecrawlRelated, fetchAuctionDetail } = await import("@/services/auction.service");
      
      let count = 1;
      for (const item of missingItems) {
        setCrawlProgress({ current: count, total: missingItems.length, name: item.name || '' });
        
        // Lấy tất cả ID liên quan của bài viết này
        const sourceIdsToCrawl = new Set<number>();
        if (item.duplicateSourceIds && item.duplicateSourceIds.length > 0) {
          item.duplicateSourceIds.forEach((id: number) => sourceIdsToCrawl.add(id));
        } else {
          sourceIdsToCrawl.add(item.sourceId);
        }
        
        const idsArray = Array.from(sourceIdsToCrawl);
        
        // Gọi trigger cào cho nhóm này
        await triggerRecrawlRelated(idsArray, 'auction');
        
        // Polling để kiểm tra xem đã cào xong chưa
        let isFixed = false;
        let attempts = 0;
        const maxAttempts = 10; // Đợi tối đa 50 giây (10 * 5s) cho mỗi item
        
        while (!isFixed && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 5000));
          try {
            const freshData = await fetchAuctionDetail(item.sourceId.toString());
            const hasProperties = freshData.properties && freshData.properties.length > 0;
            const isMissingFields = hasProperties && freshData.properties.some((p: any) => !p.place || !p.startPrice);
            
            if (hasProperties && !isMissingFields) {
              isFixed = true; // Đã lấy được dữ liệu chi tiết
            }
          } catch (e) {
            // Bỏ qua lỗi mạng
          }
          attempts++;
        }
        
        count++;
      }

      setCrawlProgress(null);
      alert(`Đã hoàn tất kiểm tra và cào chi tiết cho ${missingItems.length} bài viết! Vui lòng tải lại trang (F5) để xem kết quả cập nhật.`);
    } catch (err: any) {
      alert("Lỗi khi cào chi tiết: " + (err.response?.data?.message || err.message));
    } finally {
      setIsCrawlingDetail(false);
      setCrawlProgress(null);
    }
  };

  const reset = () => {
    setKeyword("");
    setType("all");
    setProvince([]);
    setStatus("all");
    setMaxPrice("");
    setRounds("all");
    setAuctionDateRange(null);
    setPublishedAtRange(null);
    setPage(1);
    const clean = {
      keyword: "", type: "all" as const, province: [], status: "all", maxPrice: "", rounds: "all",
      auctionDateFrom: "", auctionDateTo: "", publishedAtFrom: "", publishedAtTo: ""
    };
    setAppliedFilters(clean);
    updateUrl(clean, 1, sortKey, viewMode);
  };

  return (
    <div className="container mx-auto max-w-[1500px] space-y-4 sm:space-y-6 px-3 sm:px-6 py-5 sm:py-8">
      <header>
        <h1 suppressHydrationWarning className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Gavel className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {description} · {total.toLocaleString("vi-VN")} tài sản ({totalNotices.toLocaleString("vi-VN")} bản ghi)
          {isFetching && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
        </p>
      </header>

      {/* Advanced Filters Card */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Từ khóa</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tên tài sản, địa chỉ, biển số..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Loại tài sản</Label>
            <AntdSelect
              className="h-10 w-full"
              value={type}
              onChange={(v) => setType(v)}
              options={[{ label: "Tất cả", value: "all" }, ...Object.entries(assetTypeLabel).map(([k,v]) => ({ label: v, value: k }))]}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Trạng thái</Label>
            <AntdSelect
              className="h-10 w-full"
              value={status}
              onChange={(v) => setStatus(v)}
              options={[{ label: "Tất cả", value: "all" }, ...Object.entries(statusLabel).map(([k,v]) => ({ label: v, value: k }))]}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Tỉnh / Thành phố</Label>
            <AntdSelect
              mode="multiple"
              className="h-10 w-full"
              maxTagCount="responsive"
              placeholder="Chọn tỉnh/thành"
              value={province}
              onChange={(v) => setProvince(v)}
              options={provinceOptions}
              showSearch
              optionFilterProp="label"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Số lần ĐG</Label>
            <Select value={rounds} onValueChange={setRounds}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="1">Lần 1</SelectItem>
                <SelectItem value="2">≥ Lần 2</SelectItem>
                <SelectItem value="3">≥ Lần 3</SelectItem>
                <SelectItem value="4">≥ Lần 4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Giá tối đa (tỷ)</Label>
            <Input
              type="number"
              placeholder="VD: 5"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Thời gian tổ chức cuộc đấu giá</Label>
            <RangePicker
              className="h-10 w-full"
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              value={auctionDateRange ? [dayjs(auctionDateRange[0]), dayjs(auctionDateRange[1])] : null}
              onChange={(dates) => setAuctionDateRange(dates ? [dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')] : null)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Thời gian công khai việc đấu giá</Label>
            <RangePicker
              className="h-10 w-full"
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              value={publishedAtRange ? [dayjs(publishedAtRange[0]), dayjs(publishedAtRange[1])] : null}
              onChange={(dates) => setPublishedAtRange(dates ? [dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')] : null)}
            />
          </div>
          
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Sắp xếp</Label>
            <Select value={sortKey} onValueChange={(v: any) => setSortKey(v)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(sortLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Dùng bộ lọc nâng cao để tìm kiếm chính xác tài sản
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" size="sm" onClick={reset} className="flex-1 sm:flex-none">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Đặt lại
            </Button>
            {/* <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCrawlMissingDetail} 
              disabled={isCrawlingDetail}
              className="flex-1 sm:flex-none text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              {isCrawlingDetail ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Split className="h-3.5 w-3.5 mr-1" />}
              {crawlProgress ? `Đang xử lý ${crawlProgress.current}/${crawlProgress.total}` : "Crawl chi tiết (Missing)"}
            </Button> */}
            {/* <Button 
              variant="outline" 
              size="sm" 
              onClick={handleScanDuplicates} 
              disabled={isScanning}
              className="flex-1 sm:flex-none text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              {isScanning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <History className="h-3.5 w-3.5 mr-1" />}
              Quét trùng lặp
            </Button> */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleScanDuplicates} 
              disabled={isScanning}
              className="flex-1 sm:flex-none text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              {isScanning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Quét số lần ĐG
            </Button>
            <Button size="sm" onClick={handleSearch} className="flex-1 sm:flex-none">
              <Search className="h-3.5 w-3.5 mr-1" /> Tìm kiếm
            </Button>
          </div>
        </div>
        {crawlProgress && (
          <div className="text-xs text-blue-600 mt-2 p-2 bg-blue-50 border border-blue-100 rounded-md animate-pulse">
            <span className="font-semibold">Đang cào dữ liệu cho tài sản:</span> {crawlProgress.name}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Hiển thị <span className="font-medium text-foreground num">{items.length}</span> / <span className="num">{total}</span> tài sản ({totalNotices.toLocaleString("vi-VN")} bản ghi)
        </div>
        <div className="flex items-center border rounded-md p-0.5 bg-muted/30">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setViewMode('table')}
          >
            <TableIcon className="h-3.5 w-3.5 mr-1" /> Bảng
          </Button>
          <Button
            variant={viewMode === 'card' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setViewMode('card')}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Card
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
              <tr>
                <th className="px-4 py-3 font-semibold text-foreground">Thông tin tài sản</th>
                <th className="px-3 py-3 font-semibold text-foreground">Khu vực</th>
                <th className="px-3 py-3 font-semibold text-foreground text-right">Giá đầu</th>
                <th className="px-3 py-3 font-semibold text-foreground text-right">Giá hiện tại</th>
                <th className="px-3 py-3 font-semibold text-foreground text-center">% giảm</th>
                <th className="px-3 py-3 font-semibold text-foreground text-center">Lần ĐG</th>
                <th className="px-3 py-3 font-semibold text-foreground">Thời gian tổ chức</th>
                <th className="px-3 py-3 font-semibold text-foreground">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-foreground text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item: any) => (
                <tr key={item.sourceId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 min-w-[350px]">
                    <Link href={`/auction/${item.sourceId}`} className="font-medium text-primary hover:underline line-clamp-2">
                      {item.name}
                    </Link>
                    <div className="text-[10px] text-muted-foreground mt-1">ID: {item.sourceId} • {formatDate(item.publishedAt)}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{item.province}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap num">{formatVND(item.initialPrice)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap num font-semibold text-foreground">{formatVND(item.currentPrice)}</td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <DiscountBadge percent={
                      item.priceDropPercent || (item.initialPrice > item.currentPrice && item.initialPrice > 0
                        ? Math.round((1 - item.currentPrice / item.initialPrice) * 10000) / 100
                        : 0)
                    } />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.publishRound > 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      Lần {item.publishRound}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-[10px]">{formatDate(item.auctionDate)}</td>
                  <td className="px-3 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/auction/${item.sourceId}`} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors">
                        <FileText className="h-3.5 w-3.5" />
                      </Link>
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item: any) => {
            const pct = item.priceDropPercent || (item.initialPrice > item.currentPrice && item.initialPrice > 0
              ? Math.round((1 - item.currentPrice / item.initialPrice) * 10000) / 100
              : 0);
            return (
              <div key={item.id} className="rounded-xl border bg-card p-4 hover:border-primary/20 transition-all shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link href={`/auction/${item.sourceId}`} className="font-medium text-sm line-clamp-2 hover:text-primary min-h-[40px]">
                    {item.name}
                  </Link>
                  {pct > 0 && (
                    <DiscountBadge percent={pct} size="sm" className="shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">{item.province}</div>
                  <div className="text-xs font-bold num">{formatVND(item.currentPrice)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
          <div className="text-xs text-muted-foreground">Trang {page} / {totalPages}</div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => { if (page > 1) { setPage(page-1); updateUrl(appliedFilters, page-1, sortKey, viewMode); } }} 
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <PaginationItem key={p}>
                    <PaginationLink 
                      onClick={() => { setPage(p); updateUrl(appliedFilters, p, sortKey, viewMode); }} 
                      isActive={p === page}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => { if (page < totalPages) { setPage(page+1); updateUrl(appliedFilters, page+1, sortKey, viewMode); } }} 
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
