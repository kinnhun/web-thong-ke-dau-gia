import { useState, useMemo } from "react";
import Link from "next/link";
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
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as AntdSelect } from "antd";
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
import { useAuctions, useFilterOptions } from "@/domains/auction";
import { formatDate, formatVND } from "@/lib/format";

type SortKey = "newest" | "oldest" | "price_desc" | "price_asc";

const sortLabel: Record<SortKey, string> = {
  newest: "Ngày công khai (mới nhất)",
  oldest: "Ngày công khai (cũ nhất)",
  price_desc: "Giá khởi điểm (cao → thấp)",
  price_asc: "Giá khởi điểm (thấp → cao)",
};

const sortMap: Record<SortKey, { sort: string; order: string }> = {
  newest: { sort: "publishedAt", order: "desc" },
  oldest: { sort: "publishedAt", order: "asc" },
  price_desc: { sort: "currentPrice", order: "desc" },
  price_asc: { sort: "currentPrice", order: "asc" },
};

export function ListingContainer() {
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [province, setProvince] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
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

  const params = useMemo(() => {
    const s = sortMap[sortKey];
    const p: Record<string, string | number> = {
      page,
      limit: pageSize,
      sort: s.sort,
      order: s.order,
    };
    if (keyword) p.search = keyword;
    if (province.length > 0) p.province = province.join(",");
    return p;
  }, [page, pageSize, sortKey, keyword, province]);

  const { data, isLoading, isFetching } = useAuctions(params);

  const items = data?.items || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || 0;

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
  };

  const handleClear = () => {
    setSearchInput("");
    setKeyword("");
    setProvince([]);
    setSortKey("newest");
    setPage(1);
  };

  const paginationRange = useMemo(() => {
    const range: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }, [page, totalPages]);

  return (
    <div className="container mx-auto max-w-[1300px] px-3 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Gavel className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Thông báo công khai việc đấu giá
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Danh sách thông báo đấu giá tài sản từ Cổng Đấu Giá Tài Sản Quốc Gia
        </p>
      </header>

      {/* Search */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nhập tên tài sản..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9 h-10"
            />
          </div>
          <Button onClick={handleSearch} className="h-10 px-5">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Tìm kiếm</span>
          </Button>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Bộ lọc</span>
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tỉnh/Thành phố</label>
              <AntdSelect
                id="listing-province-select"
                mode="multiple"
                allowClear
                showSearch
                maxTagCount="responsive"
                value={province}
                placeholder="Chọn tỉnh/thành phố"
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
              <label className="text-xs font-medium text-muted-foreground">Sắp xếp theo</label>
              <Select value={sortKey} onValueChange={(v) => { setSortKey(v as SortKey); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(sortLabel) as SortKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{sortLabel[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs">
                <X className="h-3.5 w-3.5" />Xóa bộ lọc
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Tổng số <strong className="num text-foreground">{total.toLocaleString("vi-VN")}</strong> bản ghi
        </span>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      {/* Listing */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Đang tải dữ liệu...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-16 text-center text-muted-foreground">
          Không tìm thấy kết quả nào.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item: Record<string, unknown>) => {
            const sourceId = item.sourceId as number;
            const name = (item.name as string) || (item.shortDescription as string) || "Không có tên";
            const publishedAt = item.publishedAt as string;
            const auctionDate = item.auctionDate as string;
            const registrationStart = item.registrationStart as string;
            const registrationEnd = item.registrationEnd as string;
            const province = (item.province as string) || "";
            const initialPrice = (item.initialPrice as number) || 0;
            const sourceUrl = item.sourceUrl as string;
            const status = (item.status as string) || "unknown";
            const organizer = (item.organizer as string) || "";

            return (
              <div
                key={sourceId}
                className="rounded-xl border bg-card hover:border-foreground/15 transition-colors"
              >
                <div className="p-4 sm:p-5">
                  {/* Title */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/auction/${sourceId}`}
                        className="text-sm sm:text-[15px] font-medium leading-relaxed text-primary hover:underline line-clamp-3"
                      >
                        Thông báo việc đấu giá đối với danh mục tài sản: {name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <StatusBadge status={status as import("@/domains/auction").AuctionStatus} />
                        {province && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />{province}
                          </span>
                        )}
                        {organizer && (
                          <span className="text-xs text-muted-foreground truncate max-w-[300px]" title={organizer}>
                            {organizer}
                          </span>
                        )}
                        {initialPrice > 0 && (
                          <span className="text-xs font-medium num text-foreground">
                            {formatVND(initialPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                        title="Mở tin gốc"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  {/* Date row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <div>
                      <div className="font-medium text-foreground/60 mb-0.5">Thời gian tham gia</div>
                      <div className="num">
                        {registrationStart ? formatDate(registrationStart) : "—"}
                        {registrationEnd ? ` → ${formatDate(registrationEnd)}` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-foreground/60 mb-0.5">Thời gian tổ chức</div>
                      <div className="num">{auctionDate ? formatDate(auctionDate) : "—"}</div>
                    </div>
                    <div>
                      <div className="font-medium text-foreground/60 mb-0.5">Ngày công khai</div>
                      <div className="num">{publishedAt ? formatDate(publishedAt) : "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <span className="text-xs text-muted-foreground">
            Trang <strong className="num">{page}</strong> / <strong className="num">{totalPages}</strong>
          </span>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {paginationRange[0] > 1 && (
                <>
                  <PaginationItem>
                    <PaginationLink onClick={() => setPage(1)} className="cursor-pointer">1</PaginationLink>
                  </PaginationItem>
                  {paginationRange[0] > 2 && <PaginationItem><span className="px-2 text-muted-foreground">…</span></PaginationItem>}
                </>
              )}
              {paginationRange.map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    onClick={() => setPage(p)}
                    isActive={p === page}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {paginationRange[paginationRange.length - 1] < totalPages && (
                <>
                  {paginationRange[paginationRange.length - 1] < totalPages - 1 && <PaginationItem><span className="px-2 text-muted-foreground">…</span></PaginationItem>}
                  <PaginationItem>
                    <PaginationLink onClick={() => setPage(totalPages)} className="cursor-pointer">{totalPages}</PaginationLink>
                  </PaginationItem>
                </>
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
