import { useState } from "react";
import Link from "next/link";
import { Search, RotateCcw, Filter, List, LayoutGrid, Eye, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useWatchlist } from "@/domains/watchlist/watchlist.hooks";
import { formatVND, formatDate } from "@/lib/format";
import { AssetTypeIcon } from "@/components/auction/AssetTypeIcon";
import { assetTypeLabel } from "@/domains/auction";

export function WatchlistContainer() {
  const { watchlist, toggleWatch, isLoaded } = useWatchlist();
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"table" | "card">("table");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent mr-2" /> Đang tải dữ liệu...
      </div>
    );
  }

  const filteredList = watchlist.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">⭐</span> Danh sách theo dõi
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Danh sách tài sản bạn đang quan tâm · {watchlist.length} tài sản
          </p>
        </div>
      </div>

      {/* Filter Bar (Simplified for Watchlist) */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <div className="text-xs font-medium">Từ khóa</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tên tài sản đang theo dõi..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Bộ lọc danh sách theo dõi
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Đặt lại
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground num">{filteredList.length}</span> kết quả
        </div>
        <div className="inline-flex items-center rounded-md border bg-card p-0.5">
          <button onClick={() => setView("table")} className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs cursor-pointer transition-colors ${view === "table" ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-secondary/50"}`}>
            <List className="h-3.5 w-3.5" /> Bảng
          </button>
          <button onClick={() => setView("card")} className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs cursor-pointer transition-colors ${view === "card" ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-secondary/50"}`}>
            <LayoutGrid className="h-3.5 w-3.5" /> Card
          </button>
        </div>
      </div>

      {/* Results */}
      {filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card border-dashed">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <span className="text-2xl opacity-50">⭐</span>
          </div>
          <h3 className="text-base font-medium mb-1">Chưa có tài sản</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {searchTerm 
              ? "Không tìm thấy tài sản phù hợp với từ khóa."
              : "Bạn chưa theo dõi tài sản nào. Hãy tìm kiếm ở trang chủ và nhấn Theo dõi."}
          </p>
          {!searchTerm && (
            <Button asChild className="mt-4" variant="outline" size="sm">
              <Link href="/">Khám phá ngay</Link>
            </Button>
          )}
        </div>
      ) : view === "table" ? (
        <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="text-xs text-muted-foreground border-b bg-secondary/30">
              <tr>
                <th className="px-4 py-2.5 w-8"><Checkbox /></th>
                <th className="px-4 py-2.5 text-left font-medium">Tài sản</th>
                <th className="px-4 py-2.5 text-center font-medium">Lần ĐG</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá đầu</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá hiện tại</th>
                <th className="px-4 py-2.5 text-right font-medium">Giảm</th>
                <th className="px-4 py-2.5 text-left font-medium">Ngày ĐG</th>
                <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((item) => {
                const isDrop = item.latestPrice < item.firstPrice;
                const dropAmt = item.firstPrice - item.latestPrice;

                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-3"><Checkbox /></td>
                    <td className="px-4 py-3">
                      <Link href={`/auction/${item.id}`} className="flex items-start gap-2 group max-w-md">
                        <AssetTypeIcon type={item.type} className="mt-0.5 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="font-medium group-hover:text-primary line-clamp-1">{item.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{assetTypeLabel[item.type] || item.type}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.relistCount > 1 ? (
                        <div className="inline-flex flex-col items-center bg-muted/50 rounded-md px-2 py-1">
                          <span className="text-[10px] font-medium text-muted-foreground leading-none">Lần</span>
                          <span className="font-bold text-foreground mt-0.5 leading-none">{item.relistCount}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground num line-through opacity-70">
                      {item.relistCount > 1 ? formatVND(item.firstPrice) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium num text-primary">
                      {formatVND(item.latestPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isDrop && dropAmt > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="text-discount-deep font-medium num text-xs">-{formatVND(dropAmt)}</span>
                          <span className="text-[10px] bg-discount/10 text-discount-deep px-1.5 rounded-sm mt-0.5 font-medium num">-{item.priceDropPercent.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground num text-xs whitespace-nowrap">
                      {formatDate(item.publishedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" asChild>
                          <Link href={`/auction/${item.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => toggleWatch(item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Card view fallback for mobile or user preference */}
          {filteredList.map((item) => (
             <div key={item.id} className="group flex flex-col bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:border-primary/30">
               <div className="flex justify-between items-start mb-2 gap-2">
                 <AssetTypeIcon type={item.type} className="text-muted-foreground shrink-0" />
                 {item.relistCount > 1 && (
                   <span className="inline-flex bg-muted/50 rounded text-xs font-medium px-1.5 py-0.5 whitespace-nowrap">
                     Lần {item.relistCount}
                   </span>
                 )}
               </div>
               <Link href={`/auction/${item.id}`} className="block flex-1 mb-3">
                 <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                   {item.name}
                 </h3>
               </Link>
               <div className="mt-auto space-y-2 border-t pt-3">
                 <div className="flex justify-between items-end">
                   <div className="text-xs text-muted-foreground">Giá hiện tại</div>
                   <div className="font-bold text-primary num">{formatVND(item.latestPrice)}</div>
                 </div>
                 <div className="flex justify-between items-center mt-2">
                   <span className="text-[10px] text-muted-foreground num">{formatDate(item.publishedAt)}</span>
                   <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2" onClick={() => toggleWatch(item)}>
                     <Trash2 className="h-3.5 w-3.5 mr-1" /> Bỏ theo dõi
                   </Button>
                 </div>
               </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
