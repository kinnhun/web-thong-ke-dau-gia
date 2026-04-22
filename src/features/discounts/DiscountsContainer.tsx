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
  RotateCcw,
  Search,
  Share2,
  TrendingDown,
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
  type AssetType,
  assetTypeLabel,
  auctions,
  getDiscountAmount,
  getDiscountPercent,
  organizersList,
  provincesList,
} from "@/data/mockAuctions";
import { formatVND, formatVNDShort, formatRelativeDays, formatDate } from "@/lib/format";

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
  const [province, setProvince] = useState<string>("all");
  const [organizer, setOrganizer] = useState<string>("all");
  const [minDiscount, setMinDiscount] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [rounds, setRounds] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    let list = auctions.filter((a) => getDiscountPercent(a) > 0);
    if (keyword) {
      const k = keyword.toLowerCase();
      list = list.filter(
        (a) => a.name.toLowerCase().includes(k) || a.address.toLowerCase().includes(k)
      );
    }
    if (type !== "all") list = list.filter((a) => a.type === type);
    if (province !== "all") list = list.filter((a) => a.province === province);
    if (organizer !== "all") list = list.filter((a) => a.organizer === organizer);
    if (minDiscount) list = list.filter((a) => getDiscountPercent(a) >= +minDiscount);
    if (maxPrice) list = list.filter((a) => a.currentPrice <= +maxPrice * 1_000_000_000);
    if (rounds !== "all") {
      const min = +rounds;
      list = list.filter((a) => (rounds === "4" ? a.rounds >= 4 : a.rounds === min));
    }

    list.sort((a, b) => {
      switch (sortKey) {
        case "discount_pct":
          return getDiscountPercent(b) - getDiscountPercent(a);
        case "discount_amt":
          return getDiscountAmount(b) - getDiscountAmount(a);
        case "newest":
          return +new Date(b.publishedAt) - +new Date(a.publishedAt);
        case "price_asc":
          return a.currentPrice - b.currentPrice;
        case "rounds_desc":
          return b.rounds - a.rounds;
      }
    });
    return list;
  }, [keyword, type, province, organizer, minDiscount, maxPrice, rounds, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const reset = () => {
    setKeyword(""); setType("all"); setProvince("all"); setOrganizer("all");
    setMinDiscount(""); setMaxPrice(""); setRounds("all"); setPage(1);
  };

  return (
    <div className="container mx-auto max-w-[1500px] space-y-4 sm:space-y-6 px-3 sm:px-6 py-5 sm:py-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-discount-deep" />
            Tài sản giảm giá
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Xếp hạng theo tỷ lệ giảm từ dữ liệu lịch sử đấu giá · {filtered.length.toLocaleString("vi-VN")} tài sản
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="text-xs"><Bookmark className="h-4 w-4" /><span className="hidden sm:inline">Lưu bộ lọc</span></Button>
          <Button variant="outline" size="sm" className="text-xs"><Bell className="h-4 w-4" /><span className="hidden sm:inline">Tạo Thông Báo</span></Button>
          <Button variant="outline" size="sm" className="text-xs"><Download className="h-4 w-4" /><span className="hidden sm:inline">Xuất Excel</span></Button>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
                {Object.entries(assetTypeLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Tổ chức đấu giá</Label>
            <Select value={organizer} onValueChange={(v) => { setOrganizer(v); setPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {organizersList.map((p) => <SelectItem key={p} value={p}>{p.length > 35 ? p.slice(0, 35) + "…" : p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">% giảm tối thiểu</Label>
            <Input type="number" placeholder="VD: 20" value={minDiscount} onChange={(e) => { setMinDiscount(e.target.value); setPage(1); }} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Giá tối đa (tỷ)</Label>
            <Input type="number" placeholder="VD: 5" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Số lần ĐG</Label>
            <Select value={rounds} onValueChange={(v) => { setRounds(v); setPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="2">2 lần</SelectItem>
                <SelectItem value="3">3 lần</SelectItem>
                <SelectItem value="4">≥ 4 lần</SelectItem>
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
            <Button size="sm"><Search className="h-3.5 w-3.5" />Tìm kiếm</Button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground num">{filtered.length}</span> kết quả
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
      {view === "table" ? (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="text-xs text-muted-foreground border-b bg-secondary/30">
              <tr>
                <th className="px-4 py-2.5 w-8"><Checkbox /></th>
                <th className="px-4 py-2.5 text-left font-medium">Tài sản</th>
                <th className="px-4 py-2.5 text-left font-medium">Khu vực</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá đầu</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá hiện tại</th>
                <th className="px-4 py-2.5 text-right font-medium">Giảm</th>
                <th className="px-4 py-2.5 text-center font-medium">% giảm</th>
                <th className="px-4 py-2.5 text-center font-medium">Lần ĐG</th>
                <th className="px-4 py-2.5 text-left font-medium">Ngày ĐG</th>
                <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
                <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3"><Checkbox /></td>
                  <td className="px-4 py-3">
                    <Link href={`/auction/${a.id}`} className="flex items-start gap-2 group max-w-md">
                      <AssetTypeIcon type={a.type} className="mt-0.5 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="font-medium group-hover:text-primary line-clamp-1">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{assetTypeLabel[a.type]} · {a.organizer.slice(0, 30)}…</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <div className="font-medium text-foreground">{a.province}</div>
                    <div>{a.district}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground line-through num text-xs">{formatVNDShort(a.initialPrice)}</td>
                  <td className="px-4 py-3 text-right font-semibold num">{formatVNDShort(a.currentPrice)}</td>
                  <td className="px-4 py-3 text-right num text-discount-deep text-xs font-medium">−{formatVNDShort(getDiscountAmount(a))}</td>
                  <td className="px-4 py-3 text-center"><DiscountBadge percent={getDiscountPercent(a)} /></td>
                  <td className="px-4 py-3 text-center num text-muted-foreground">{a.rounds}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(a.auctionDate)}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <Link href={`/auction/${a.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Share2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">Không tìm thấy tài sản phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paged.map((a) => (
            <Link key={a.id} href={`/auction/${a.id}`} className="group rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><AssetTypeIcon type={a.type} /></div>
                <DiscountBadge percent={getDiscountPercent(a)} size="lg" />
              </div>
              <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary min-h-[2.5rem]">{a.name}</h3>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span>{a.province}</span>·<span>{a.rounds} lần ĐG</span></div>
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs text-muted-foreground line-through num">{formatVND(a.initialPrice)}</div>
                <div className="font-semibold num text-base">{formatVND(a.currentPrice)}</div>
              </div>
              <div className="mt-3"><StatusBadge status={a.status} /></div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem><PaginationPrevious onClick={() => setPage(Math.max(1, page - 1))} className="cursor-pointer" /></PaginationItem>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}><PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">{p}</PaginationLink></PaginationItem>
            ))}
            <PaginationItem><PaginationNext onClick={() => setPage(Math.min(totalPages, page + 1))} className="cursor-pointer" /></PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
