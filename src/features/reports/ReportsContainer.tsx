import dynamic from "next/dynamic";
import { Download, FileText, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DiscountBadge } from "@/components/auction/DiscountBadge";
import {
  assetTypeLabel,
  auctions,
  getDiscountAmount,
  getDiscountPercent,
} from "@/data/mockAuctions";
import { formatVNDShort } from "@/lib/format";

const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--discount-deep))",
  "hsl(var(--discount-mid))",
  "hsl(var(--discount-light))",
  "hsl(var(--watch-badge))",
  "hsl(var(--new-badge))",
  "hsl(var(--muted-foreground))",
];

export function ReportsContainer() {
  const discounted = auctions.filter((a) => getDiscountPercent(a) > 0);

  const byProvince = Object.entries(
    discounted.reduce((acc: Record<string, number[]>, a) => {
      (acc[a.province] ||= []).push(getDiscountPercent(a));
      return acc;
    }, {})
  )
    .map(([province, arr]) => ({
      province,
      count: arr.length,
      avg: arr.reduce((s, x) => s + x, 0) / arr.length,
      max: Math.max(...arr),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const byType = Object.entries(
    discounted.reduce((acc: Record<string, { count: number; pct: number[]; amt: number }>, a) => {
      const k = a.type;
      acc[k] ||= { count: 0, pct: [], amt: 0 };
      acc[k].count++;
      acc[k].pct.push(getDiscountPercent(a));
      acc[k].amt += getDiscountAmount(a);
      return acc;
    }, {})
  ).map(([type, d]) => ({
    type: assetTypeLabel[type as keyof typeof assetTypeLabel],
    count: d.count,
    avgPct: d.pct.reduce((s, x) => s + x, 0) / d.pct.length,
    avgAmt: d.amt / d.count,
  }));

  const monthly = Array.from({ length: 8 }, (_, i) => ({
    month: `T${i + 1}`,
    count: 5 + Math.round(Math.sin(i / 1.5) * 6 + Math.random() * 8 + i),
    avg: 12 + Math.round(Math.cos(i / 2) * 5 + Math.random() * 4 + i / 2),
  }));

  const topByPct = [...discounted].sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a)).slice(0, 5);
  const topByAmt = [...discounted].sort((a, b) => getDiscountAmount(b) - getDiscountAmount(a)).slice(0, 5);

  return (
    <div className="container mx-auto max-w-[1400px] px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Báo cáo thị trường</h1>
          <p className="text-sm text-muted-foreground mt-1">Phân tích xu hướng đấu giá theo khu vực, loại tài sản và thời gian</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="30d">
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 ngày</SelectItem>
              <SelectItem value="30d">30 ngày</SelectItem>
              <SelectItem value="90d">90 ngày</SelectItem>
              <SelectItem value="1y">1 năm</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm"><FileText className="h-4 w-4" />Xuất PDF</Button>
          <Button variant="outline" size="sm"><Download className="h-4 w-4" />Xuất Excel</Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4"><MapPin className="h-4 w-4 text-primary" /><h2 className="font-semibold">Top tỉnh có nhiều tài sản giảm giá</h2></div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProvince} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="province" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name="Số tài sản" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4"><Package className="h-4 w-4 text-discount-deep" /><h2 className="font-semibold">Tỷ trọng theo loại tài sản</h2></div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byType} dataKey="count" nameKey="type" outerRadius={90} label={{ fontSize: 11 }}>
                  {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-4">Xu hướng theo tháng</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ left: -10, right: 10 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Số tài sản giảm" />
              <Line yAxisId="right" type="monotone" dataKey="avg" stroke="hsl(var(--discount-deep))" strokeWidth={2} dot={false} name="% giảm trung bình" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4"><h2 className="font-semibold">Top theo % giảm</h2></div>
          <table className="w-full text-sm">
            <tbody>
              {topByPct.map((a, i) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-5 py-3 w-8 text-muted-foreground num">{i + 1}</td>
                  <td className="px-5 py-3"><div className="font-medium line-clamp-1">{a.name}</div><div className="text-xs text-muted-foreground">{a.province}</div></td>
                  <td className="px-5 py-3 text-right"><DiscountBadge percent={getDiscountPercent(a)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4"><h2 className="font-semibold">Top theo số tiền giảm</h2></div>
          <table className="w-full text-sm">
            <tbody>
              {topByAmt.map((a, i) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-5 py-3 w-8 text-muted-foreground num">{i + 1}</td>
                  <td className="px-5 py-3"><div className="font-medium line-clamp-1">{a.name}</div><div className="text-xs text-muted-foreground">{a.province}</div></td>
                  <td className="px-5 py-3 text-right num font-semibold text-discount-deep">−{formatVNDShort(getDiscountAmount(a))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
