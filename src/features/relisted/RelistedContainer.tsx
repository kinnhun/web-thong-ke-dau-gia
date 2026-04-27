import { useState } from "react";
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
  History,
} from "lucide-react";
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
  useRelistedAuctions,
  useRelistedFilterOptions,
  assetTypeLabel,
  type AssetType,
} from "@/domains/auction";
import { formatVND, formatVNDShort, formatDate } from "@/lib/format";

type SortKey = "rounds_desc" | "newest" | "price_asc" | "discount_pct";
type ViewMode = "table" | "card";

const sortLabel: Record<SortKey, string> = {
  rounds_desc: "Nhiều lần đăng lại nhất",
  newest: "Mới cập nhật nhất",
  price_asc: "Giá hiện tại thấp nhất",
  discount_pct: "% giảm cao nhất",
};

export function RelistedContainer() {
  const [view, setView] = useState<ViewMode>("table");
  const [sortKey, setSortKey] = useState<SortKey>("rounds_desc");
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<AssetType | "all">("all");
  const [province, setProvince] = useState<string>("all");
  const [organizer, setOrganizer] = useState<string>("all");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: filterOpts } = useRelistedFilterOptions();

  const { data, isLoading, isFetching } = useRelistedAuctions({
    page,
    limit: pageSize,
    search: keyword || undefined,
    type: type !== "all" ? type : undefined,
    province: province !== "all" ? province : undefined,
    organizer: organizer !== "all" ? organizer : undefined,
    maxPrice: maxPrice ? String(parseFloat(maxPrice) * 1_000_000_000) : undefined,
    sort: sortKey,
  });

  const items = data?.items || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? 0;

  const reset = () => {
    setKeyword(""); setType("all"); setProvince("all"); setOrganizer("all");
    setMaxPrice(""); setPage(1);
  };

  const provincesList = filterOpts?.provinces || [];
  const typesList = filterOpts?.types || [];

  return (
    <div className="container mx-auto max-w-[1500px] space-y-4 sm:space-y-6 px-3 sm:px-6 py-5 sm:py-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Tài sản đăng lại
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Danh sách tài sản được đăng lại nhiều lần · {total.toLocaleString("vi-VN")} tài sản
            {isFetching && <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="text-xs"><Bookmark className="h-4 w-4" /><span className="hidden sm:inline">Lưu bộ lọc</span></Button>
          <Button variant="outline" size="sm" className="text-xs"><Download className="h-4 w-4" /><span className="hidden sm:inline">Xuất Excel</span></Button>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Từ khóa</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tên, địa chỉ, biển số…"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Loại tài sản</Label>
            <Select value={type} onValueChange={(v) => { setType(v as AssetType | "all"); setPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {typesList.map((k) => (
                  <SelectItem key={k} value={k}>{assetTypeLabel[k as AssetType] || k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tỉnh / thành</Label>
            <Select value={province} onValueChange={(v) => { setProvince(v); setPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {provincesList.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5 lg:col-span-1 xl:col-span-1">
            <Label className="text-xs">Sắp xếp</Label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(sortLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t pt-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />Lọc nâng cao có thể được lưu để sử dụng lại
          </div>
          <div className="flex gap-2">
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
          <table className="w-full text-sm min-w-[1180px]">
            <thead className="text-xs text-muted-foreground border-b bg-secondary/30">
              <tr>
                <th className="px-4 py-2.5 w-8"><Checkbox /></th>
                <th className="px-4 py-2.5 text-left font-medium min-w-[360px]">Tài sản</th>
                <th className="px-4 py-2.5 text-left font-medium min-w-[240px]">Thông tin tài sản</th>
                <th className="px-4 py-2.5 text-left font-medium">Khu vực</th>
                <th className="px-4 py-2.5 text-center font-medium">Lần ĐG</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá đầu</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá hiện tại</th>
                <th className="px-4 py-2.5 text-right font-medium">Giảm</th>
                <th className="px-4 py-2.5 text-left font-medium">Ngày ĐG</th>
                <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
                <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const displayTitle = a.shortDescription?.trim() || a.name;

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
                        <div className="font-medium text-foreground whitespace-normal break-words">{assetTypeLabel[a.type] || a.type}</div>
                        {a.organizer && (
                          <div className="whitespace-normal break-words">
                            Đơn vị: <span className="text-foreground/80">{a.organizer}</span>
                          </div>
                        )}
                        <div className="whitespace-normal break-words">
                          Công khai: <span className="text-foreground/80">{a.publishedAt ? formatDate(a.publishedAt) : "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div className="font-medium text-foreground">{a.province || "Chưa cập nhật"}</div>
                    </td>
                    <td className="px-4 py-3 text-center num text-foreground font-semibold">
                      <span className="px-2 py-1 bg-muted rounded">Lần {a.relistCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground line-through num text-xs">
                      {a.priceDropPercent > 0 ? formatVNDShort(a.firstPrice) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold num">{formatVNDShort(a.latestPrice)}</td>
                    <td className="px-4 py-3 text-right num">
                      {a.priceDropPercent > 0 ? (
                          <div className="flex flex-col items-end">
                              <span className="text-discount-deep text-xs font-medium">−{formatVNDShort(a.firstPrice - a.latestPrice)}</span>
                              <DiscountBadge percent={a.priceDropPercent} />
                          </div>
                      ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.publishedAt ? formatDate(a.publishedAt) : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/auction/${a.sourceId}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Share2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">Không tìm thấy tài sản phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((a) => {
            const displayTitle = a.shortDescription?.trim() || a.name;

            return (
              <Link key={a._id} href={`/auction/${a.sourceId}`} className="group rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><AssetTypeIcon type={a.type} /></div>
                  <div className="px-2 py-1 bg-muted rounded text-xs font-semibold num">Lần {a.relistCount}</div>
                </div>
                <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary min-h-[2.5rem]">{displayTitle}</h3>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span>{a.province}</span></div>
                <div className="mt-3 pt-3 border-t">
                  {a.priceDropPercent > 0 && <div className="text-xs text-muted-foreground line-through num">{formatVND(a.firstPrice)}</div>}
                  <div className="font-semibold num text-base flex items-center justify-between">
                      {formatVND(a.latestPrice)}
                      {a.priceDropPercent > 0 && <DiscountBadge percent={a.priceDropPercent} />}
                  </div>
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
