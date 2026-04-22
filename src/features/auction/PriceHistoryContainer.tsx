import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auctions } from "@/data/mockAuctions";
import { formatDate, formatVND, formatVNDShort } from "@/lib/format";

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
  const auction = auctions.find((a) => a.id === id) ?? auctions[0];

  const chartData = auction.history.map((h) => ({
    date: formatDate(h.publishedAt),
    price: h.startingPrice,
    round: `Lần ${h.round}`,
  }));

  const last = auction.history[auction.history.length - 1];
  const prev = auction.history[auction.history.length - 2] ?? auction.history[0];

  return (
    <div className="container mx-auto max-w-[1200px] px-6 py-8 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/auction/${auction.id}`}><ArrowLeft className="h-4 w-4" />Quay lại chi tiết</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight mt-3">Lịch sử giá & so sánh</h1>
        <p className="text-sm text-muted-foreground mt-1">{auction.name}</p>
      </div>

      {/* Chart */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold mb-4">Diễn biến giá khởi điểm</h2>
        <div className="h-72">
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
        </div>
      </div>

      {/* Comparison */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold mb-4">So sánh lần gần nhất với lần trước</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[prev, last].map((h, idx) => (
            <div key={h.round} className={`rounded-lg border p-4 ${idx === 1 ? "bg-discount-deep-soft border-discount-deep/20" : "bg-secondary/30"}`}>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {idx === 0 ? "Lần trước" : "Lần hiện tại"} · Lần {h.round}
              </div>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Giá khởi điểm</span><span className="font-semibold num">{formatVND(h.startingPrice)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tiền đặt cọc</span><span className="num">{formatVND(h.deposit)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ngày công khai</span><span>{formatDate(h.publishedAt)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tổ chức ĐG</span><span className="text-right">{h.organizer.slice(0, 25)}…</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Toàn bộ lịch sử ({auction.history.length} lần)</h2>
          <Button variant="outline" size="sm"><Download className="h-4 w-4" />Xuất lịch sử</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-secondary/30">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Lần</th>
                <th className="px-4 py-2.5 text-left font-medium">Ngày công khai</th>
                <th className="px-4 py-2.5 text-right font-medium">Giá khởi điểm</th>
                <th className="px-4 py-2.5 text-right font-medium">Tiền đặt cọc</th>
                <th className="px-4 py-2.5 text-left font-medium">Tổ chức đấu giá</th>
                <th className="px-4 py-2.5 text-right font-medium">Δ vs lần trước</th>
                <th className="px-4 py-2.5 text-right font-medium">Δ vs lần đầu</th>
                <th className="px-4 py-2.5 text-center font-medium">Tin gốc</th>
              </tr>
            </thead>
            <tbody>
              {auction.history.map((h, i) => {
                const first = auction.history[0].startingPrice;
                const prevPrice = i > 0 ? auction.history[i - 1].startingPrice : h.startingPrice;
                const dPrev = i > 0 ? ((h.startingPrice - prevPrice) / prevPrice) * 100 : 0;
                const dFirst = ((h.startingPrice - first) / first) * 100;
                return (
                  <tr key={h.round} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium num">Lần {h.round}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(h.publishedAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold num">{formatVND(h.startingPrice)}</td>
                    <td className="px-4 py-3 text-right num text-muted-foreground">{formatVND(h.deposit)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{h.organizer}</td>
                    <td className={`px-4 py-3 text-right num text-xs font-medium ${dPrev < 0 ? "text-discount-deep" : "text-muted-foreground"}`}>
                      {i === 0 ? "—" : `${dPrev > 0 ? "+" : ""}${dPrev.toFixed(1)}%`}
                    </td>
                    <td className={`px-4 py-3 text-right num text-xs font-medium ${dFirst < 0 ? "text-discount-deep" : "text-muted-foreground"}`}>
                      {i === 0 ? "—" : `${dFirst.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={h.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
