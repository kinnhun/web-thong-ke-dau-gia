import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Bookmark,
  Download,
  ExternalLink,
  Eye,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  RotateCcw,
  Search,
  Share2,
  TrendingDown,
} from "lucide-react";
import { Select as AntdSelect } from "antd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DiscountBadge } from "@/components/auction/DiscountBadge";
import { StatusBadge } from "@/components/auction/StatusBadge";
import { AssetTypeIcon } from "@/components/auction/AssetTypeIcon";
import {
  useDiscountedAuctions,
  useFilterOptions,
  assetTypeLabel,
  type AssetType,
} from "@/domains/auction";
import { formatVND, formatVNDShort, formatDate } from "@/lib/format";
import { getAuctionDisplayTitle, getAuctionPropertyLines } from "@/utils/auction-display";

type SortKey = "discount_pct" | "discount_amt" | "newest" | "price_asc" | "rounds_desc";
type ViewMode = "table" | "card";

const sortLabel: Record<SortKey, string> = {
  discount_pct: "% giảm cao nhất",
  discount_amt: "Số tiền giảm lớn nhất",
  newest: "Mới cập nhật nhất",
  price_asc: "Giá hiện tại thấp nhất",
  rounds_desc: "Nhiều lần đấu giá nhất",
};

export function DiscountsContainer() {
  const [view, setView] = useState<ViewMode>("table");
  const [sortKey, setSortKey] = useState<SortKey>("discount_pct");
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<AssetType | "all">("all");
  const [province, setProvince] = useState<string[]>([]);
  const [organizer, setOrganizer] = useState<string>("all");
  const [minDiscount, setMinDiscount] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [rounds, setRounds] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: filterOpts } = useFilterOptions();

  const provinceOptions = useMemo(
    () =>
      (filterOpts?.provinces || []).map((item) => ({
        label: item,
        value: item,
      })),
    [filterOpts?.provinces]
  );

  const provinceQueryValue = province.length > 0 ? province.join(",") : undefined;

  const { data, isLoading, isFetching } = useDiscountedAuctions({
    page,
    limit: pageSize,
    search: keyword || undefined,
    type: type !== "all" ? type : undefined,
    province: provinceQueryValue,
    organizer: organizer !== "all" ? organizer : undefined,
    minDiscount: minDiscount || undefined,
    maxPrice: maxPrice ? String(parseFloat(maxPrice) * 1_000_000_000) : undefined,
    minRounds: rounds !== "all" ? rounds : undefined,
    sort: sortKey,
  });

  const items = data?.items || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? 0;

  const reset = () => {
    setKeyword(""); setType("all"); setProvince([]); setOrganizer("all");
    setMinDiscount(""); setMaxPrice(""); setRounds("all"); setPage(1);
  };

  const provincesList = filterOpts?.provinces || [];
  const organizersList = filterOpts?.organizers || [];
  const typeOptions = useMemo(
    () => [
      { label: "Tất cả", value: "all" },
      ...Object.entries(assetTypeLabel).map(([key, label]) => ({
        label,
        value: key,
      })),
    ],
    []
  );
  const organizerOptions = useMemo(
    () => [
      { label: "Tất cả", value: "all" },
      ...organizersList.map((item) => ({
        label: item,
        value: item,
      })),
    ],
    [organizersList]
  );

  return (
    <div className="container mx-auto max-w-[1500px] space-y-4 sm:space-y-6 px-3 sm:px-6 py-5 sm:py-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-discount-deep" />
            Tài sản giảm giá
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Xếp hạng theo tỷ lệ giảm từ dữ liệu lịch sử đấu giá · {total.toLocaleString("vi-VN")} tài sản
            {isFetching && <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="text-xs"><Bookmark className="h-4 w-4" /><span className="hidden sm:inline">Lưu bộ lọc</span></Button>
          <Button variant="outline" size="sm" className="text-xs"><Bell className="h-4 w-4" /><span className="hidden sm:inline">Tạo Thông Báo</span></Button>
          <Button variant="outline" size="sm" className="text-xs"><Download className="h-4 w-4" /><span className="hidden sm:inline">Xuất Excel</span></Button>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-2xl border bg-card p-3 sm:p-4 lg:p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
            <Label className="text-xs">Từ khóa</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tên, địa chỉ, biển số…"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                className="h-10 pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
            <Label className="text-xs">Tổ chức đấu giá</Label>
            <AntdSelect
              id="discounts-organizer-select"
              allowClear
              showSearch
              value={organizer}
              placeholder="Chọn tổ chức đấu giá"
              options={organizerOptions}
              optionFilterProp="label"
              onChange={(value) => {
                setOrganizer((value as string) ?? "all");
                setPage(1);
              }}
              className="h-11 w-full [&_.ant-select-selector]:!min-h-11 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-border [&_.ant-select-selector]:!bg-background [&_.ant-select-selector]:!px-3 [&_.ant-select-selection-placeholder]:!text-muted-foreground [&_.ant-select-selection-item]:!text-foreground"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
            <Label className="text-xs">Tỉnh / thành</Label>
            <AntdSelect
              id="discounts-province-select"
              mode="multiple"
              allowClear
              showSearch
              maxTagCount="responsive"
              value={province}
              placeholder="Chọn một hoặc nhiều tỉnh/thành"
              options={provinceOptions}
              optionFilterProp="label"
              onChange={(values) => {
                setProvince(values);
                setPage(1);
              }}
              className="h-9 w-full [&_.ant-select-selector]:!min-h-9 [&_.ant-select-selector]:!rounded-md [&_.ant-select-selector]:!border-border [&_.ant-select-selector]:!bg-background [&_.ant-select-selector]:!px-2 [&_.ant-select-selection-placeholder]:!text-muted-foreground [&_.ant-select-selection-item]:!rounded [&_.ant-select-selection-item]:!bg-secondary [&_.ant-select-selection-item]:!text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Loại tài sản</Label>
            <AntdSelect
              id="discounts-asset-type-select"
              allowClear
              showSearch
              value={type}
              placeholder="Chọn loại tài sản"
              options={typeOptions}
              optionFilterProp="label"
              onChange={(value) => {
                setType((value as AssetType | "all") ?? "all");
                setPage(1);
              }}
              className="h-10 w-full [&_.ant-select-selector]:!min-h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-border [&_.ant-select-selector]:!bg-background [&_.ant-select-selector]:!px-3 [&_.ant-select-selection-placeholder]:!text-muted-foreground [&_.ant-select-selection-item]:!text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Số lần ĐG</Label>
            <Select value={rounds} onValueChange={(v) => { setRounds(v); setPage(1); }}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="2">≥ 2 lần</SelectItem>
                <SelectItem value="3">≥ 3 lần</SelectItem>
                <SelectItem value="4">≥ 4 lần</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">% giảm tối thiểu</Label>
            <Input type="number" placeholder="VD: 20" value={minDiscount} onChange={(e) => { setMinDiscount(e.target.value); setPage(1); }} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Giá tối đa (tỷ)</Label>
            <Input type="number" placeholder="VD: 5" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} className="h-10" />
          </div>
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
            <Label className="text-xs">Sắp xếp</Label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(sortLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />Tìm kiếm nhanh hơn với bộ lọc nhiều tỉnh/thành và danh sách có search
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-3.5 w-3.5" />Đặt lại</Button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground num">{total}</span> kết quả
        </div>
        <div className="inline-flex items-center rounded-md border bg-card p-0.5">
          <button onClick={() => setView("table")} className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs cursor-pointer ${view === "table" ? "bg-secondary font-medium" : "text-muted-foreground"}`}>
            <List className="h-3.5 w-3.5" />Bảng
          </button>
          <button onClick={() => setView("card")} className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs cursor-pointer ${view === "card" ? "bg-secondary font-medium" : "text-muted-foreground"}`}>
            <LayoutGrid className="h-3.5 w-3.5" />Card
          </button>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Đang tải dữ liệu...
        </div>
      ) : view === "table" ? (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[1220px]">
            <thead className="text-xs text-muted-foreground border-b bg-secondary/30">
              <tr>
                <th className="px-4 py-2.5 w-8"><Checkbox /></th>
                <th className="px-4 py-2.5 text-left font-medium min-w-[360px]">Tài sản</th>
                <th className="px-4 py-2.5 text-left font-medium min-w-[240px]">Thông tin tài sản</th>
                <th className="px-4 py-2.5 text-left font-medium">Khu vực</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá đầu</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá hiện tại</th>
                <th className="px-4 py-2.5 text-right font-medium">Giảm</th>
                <th className="px-4 py-2.5 text-center font-medium">% giảm</th>
                <th className="px-4 py-2.5 text-center font-medium">Lần ĐG</th>
                <th className="px-4 py-2.5 text-left font-medium">Thời gian công khai</th>
                <th className="px-4 py-2.5 text-left font-medium">Ngày ĐG</th>
                <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
                <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const displayTitle = getAuctionDisplayTitle(a);
                const propertyLines = getAuctionPropertyLines(a);

                return (
                  <tr key={a._id} className="border-b last:border-0 hover:bg-secondary/40 align-top">
                    <td className="px-4 py-3"><Checkbox /></td>
                    <td className="px-4 py-3">
                      <Link href={`/auction/${a.sourceId}`} className="flex items-start gap-2 group min-w-[360px] max-w-[460px]">
                        <AssetTypeIcon type={a.type} className="mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="font-medium leading-6 whitespace-normal break-words group-hover:text-primary line-clamp-3">{displayTitle}</div>
                          <div className="mt-1 text-xs text-muted-foreground whitespace-normal break-words">
                            Mã tin: <span className="font-medium text-foreground/80">{a.sourceId}</span>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground min-w-[240px]">
                      <div className="space-y-1.5">
                        <div className="space-y-1 whitespace-normal break-words">
                          {propertyLines.map((line, index) => (
                            <div key={`${a._id}-property-${index}`} className="font-medium text-foreground whitespace-normal break-words">
                              {line}
                            </div>
                          ))}
                        </div>
                        {a.organizer && (
                          <div className="whitespace-normal break-words">
                            Đơn vị: <span className="text-foreground/80">{a.organizer}</span>
                          </div>
                        )}
                        <div className="whitespace-normal break-words">
                          Tình trạng: <span className="text-foreground/80">{a.status}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div className="font-medium text-foreground">{a.province || "Chưa cập nhật"}</div>
                      {a.district && <div>{a.district}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground line-through num text-xs">{formatVNDShort(a.firstPrice)}</td>
                    <td className="px-4 py-3 text-right font-semibold num">{formatVNDShort(a.latestPrice)}</td>
                    <td className="px-4 py-3 text-right num text-discount-deep text-xs font-medium">−{formatVNDShort(a.firstPrice - a.latestPrice)}</td>
                    <td className="px-4 py-3 text-center"><DiscountBadge percent={a.priceDropPercent} /></td>
                    <td className="px-4 py-3 text-center num text-muted-foreground">{a.relistCount}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.publishedAt ? formatDate(a.publishedAt) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.auctionDate ? formatDate(a.auctionDate) : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/auction/${a.sourceId}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        {a.sourceUrl && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Share2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={13} className="px-4 py-12 text-center text-muted-foreground">Không tìm thấy tài sản phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((a) => {
            const displayTitle = getAuctionDisplayTitle(a);

            return (
              <Link key={a._id} href={`/auction/${a.sourceId}`} className="group rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><AssetTypeIcon type={a.type} /></div>
                  <DiscountBadge percent={a.priceDropPercent} size="lg" />
                </div>
                <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary min-h-[2.5rem]">{displayTitle}</h3>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span>{a.province || "Không rõ"}</span>·<span>{a.relistCount} lần ĐG</span></div>
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground line-through num">{formatVND(a.firstPrice)}</div>
                  <div className="font-semibold num text-base">{formatVND(a.latestPrice)}</div>
                </div>
                <div className="mt-3"><StatusBadge status={a.status} /></div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem><PaginationPrevious onClick={() => setPage(Math.max(1, page - 1))} className="cursor-pointer" /></PaginationItem>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <PaginationItem key={p}>
                  <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">{p}</PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem><PaginationNext onClick={() => setPage(Math.min(totalPages, page + 1))} className="cursor-pointer" /></PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
