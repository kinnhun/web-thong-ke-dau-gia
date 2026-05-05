import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuctionDetail } from "@/domains/auction";
import { formatDate, formatVND, formatVNDShort } from "@/lib/format";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });

interface PriceHistoryContainerProps {
  id: string;
}

export function PriceHistoryContainer({ id }: PriceHistoryContainerProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: auction, isLoading } = useAuctionDetail(id);

  if (isLoading || !auction) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Đang tải lịch sử giá...
      </div>
    );
  }

  const dup = auction.duplicateGroup;
  const entries = dup?.entries ?? [];

  // Build chart data from duplicate entries or fallback to single point
  let chartEntries = entries;
  if (entries.length > 100) {
    const step = Math.ceil(entries.length / 100);
    chartEntries = entries.filter((_, i) => i % step === 0 || i === entries.length - 1);
  }

  const chartData = chartEntries.length > 0
    ? chartEntries.map((h) => ({
        date: h.publishedAt ? formatDate(h.publishedAt) : "—",
        price: h.price,
        round: `Lần ${h.publishRound || 1}`,
      }))
    : [{
        date: auction.publishedAt ? formatDate(auction.publishedAt) : "—",
        price: auction.initialPrice,
        round: "Lần 1",
      }];

  // Comparison: last vs prev
  const last = entries.length > 0 ? entries[entries.length - 1] : null;
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;

  const totalPages = Math.ceil(entries.length / pageSize);
  const paginatedEntries = entries.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="container mx-auto max-w-[1200px] px-3 sm:px-6 py-5 sm:py-8 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/auction/${id}`}><ArrowLeft className="h-4 w-4" />Quay lại chi tiết</Link>
        </Button>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mt-3">Lịch sử giá & so sánh</h1>
        <p className="text-sm text-muted-foreground mt-1">{auction.name}</p>
      </div>

      {/* Chart */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="font-semibold mb-4">Diễn biến giá khởi điểm</h2>
        <div className="h-56 sm:h-72">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 5, right: 20, top: 5, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={formatVNDShort} width={70} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => formatVND(Number(v))}
                />
                <Line type="monotone" dataKey="price" stroke="hsl(var(--discount-deep))" strokeWidth={2.5} dot={{ r: 5, fill: "hsl(var(--discount-deep))" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Chỉ có 1 lần đăng — chưa đủ dữ liệu để vẽ biểu đồ
            </div>
          )}
        </div>
      </div>

      {/* Comparison */}
      {prev && last && (
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="font-semibold mb-4">So sánh lần gần nhất với lần trước</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Lần trước", entry: prev },
              { label: "Lần hiện tại", entry: last },
            ].map(({ label, entry }, idx) => (
              <div key={idx} className={`rounded-lg border p-4 ${idx === 1 ? "bg-discount-deep-soft border-discount-deep/20" : "bg-secondary/30"}`}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {label} · Lần {entry.publishRound || "?"}
                </div>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Giá khởi điểm</span><span className="font-semibold num">{formatVND(entry.price)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ngày công khai</span><span>{entry.publishedAt ? formatDate(entry.publishedAt) : "—"}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full history table */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Toàn bộ lịch sử ({entries.length || 1} lần)</h2>
          <Button variant="outline" size="sm"><Download className="h-4 w-4" />Xuất lịch sử</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-secondary/30">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Lần</th>
                <th className="px-4 py-2.5 text-left font-medium">Ngày công khai</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá khởi điểm</th>
                <th className="px-4 py-2.5 text-right font-medium">Δ vs lần trước</th>
                <th className="px-4 py-2.5 text-right font-medium">Δ vs lần đầu</th>
                <th className="px-4 py-2.5 text-center font-medium">Tin gốc</th>
              </tr>
            </thead>
            <tbody>
              {entries.length > 0 ? paginatedEntries.map((h, sliceIndex) => {
                const i = (page - 1) * pageSize + sliceIndex;
                const first = entries[0].price;
                const prevPrice = i > 0 ? entries[i - 1].price : h.price;
                const dPrev = i > 0 && prevPrice ? ((h.price - prevPrice) / prevPrice) * 100 : 0;
                const dFirst = first ? ((h.price - first) / first) * 100 : 0;
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium num">Lần {h.publishRound || i + 1}</td>
                    <td className="px-4 py-3 text-muted-foreground">{h.publishedAt ? formatDate(h.publishedAt) : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold num">{formatVND(h.price)}</td>
                    <td className={`px-4 py-3 text-right num text-xs font-medium ${dPrev < 0 ? "text-discount-deep" : "text-muted-foreground"}`}>
                      {i === 0 ? "—" : `${dPrev > 0 ? "+" : ""}${dPrev.toFixed(1)}%`}
                    </td>
                    <td className={`px-4 py-3 text-right num text-xs font-medium ${dFirst < 0 ? "text-discount-deep" : "text-muted-foreground"}`}>
                      {i === 0 ? "—" : `${dFirst.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {h.sourceUrl ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={h.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                        </Button>
                      ) : "—"}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td className="px-4 py-3 font-medium num">Lần 1</td>
                  <td className="px-4 py-3 text-muted-foreground">{auction.publishedAt ? formatDate(auction.publishedAt) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold num">{formatVND(auction.initialPrice)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-center">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-t px-5 py-4 flex items-center justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
                        isActive={p === page} 
                        onClick={() => setPage(p)} 
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                    className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
}
