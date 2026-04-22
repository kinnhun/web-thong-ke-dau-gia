import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowRight,
  Calendar,
  ExternalLink,
  FileBarChart,
  Flame,
  Layers,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/auction/KpiCard";
import { DiscountBadge } from "@/components/auction/DiscountBadge";
import { StatusBadge } from "@/components/auction/StatusBadge";
import { AssetTypeIcon } from "@/components/auction/AssetTypeIcon";
import {
  auctions,
  assetTypeLabel,
  getDiscountAmount,
  getDiscountPercent,
} from "@/data/mockAuctions";
import { formatVND, formatVNDShort, formatRelativeDays } from "@/lib/format";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });

const trendData = Array.from({ length: 14 }, (_, i) => ({
  day: `${i + 1}/4`,
  count: 4 + Math.round(Math.sin(i / 2) * 3 + Math.random() * 4),
  avgDiscount: 12 + Math.round(Math.cos(i / 3) * 4 + Math.random() * 5),
}));

const typeData = Object.entries(assetTypeLabel).map(([type, label]) => {
  const list = auctions.filter((a) => a.type === type);
  return {
    type: label.length > 12 ? label.slice(0, 12) + "…" : label,
    count: list.length,
  };
}).filter((d) => d.count > 0);

export function DashboardContainer() {
  const discounted = auctions.filter((a) => getDiscountPercent(a) > 0);
  const top10 = [...discounted]
    .sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a))
    .slice(0, 10);
  const newest = [...discounted]
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, 4);

  const maxDiscount = Math.max(...discounted.map(getDiscountPercent));
  const totalReducedValue = discounted.reduce((s, a) => s + getDiscountAmount(a), 0);
  const newToday = auctions.filter(
    (a) => Date.now() - +new Date(a.publishedAt) < 1000 * 60 * 60 * 24 * 3
  ).length;

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tổng quan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cập nhật {formatRelativeDays(new Date().toISOString()).toLowerCase()} · Dữ liệu từ nguồn công khai
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileBarChart className="h-4 w-4" />
            Xuất báo cáo
          </Button>
          <Button size="sm" asChild>
            <Link href="/discounts">
              Xem giảm sâu <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Tài sản đang theo dõi"
          value={auctions.length.toString()}
          icon={Layers}
          hint={`${newToday} mới trong 72h`}
          trend={{ value: 12.5 }}
        />
        <KpiCard
          label="Đang giảm giá"
          value={discounted.length.toString()}
          icon={TrendingDown}
          accent="deep"
          hint="so với hôm qua"
          trend={{ value: 8.2 }}
        />
        <KpiCard
          label="Mức giảm cao nhất"
          value={`−${maxDiscount.toFixed(1)}%`}
          icon={Flame}
          accent="mid"
          hint="ghi nhận hôm nay"
        />
        <KpiCard
          label="Tổng giá trị giảm"
          value={formatVNDShort(totalReducedValue)}
          icon={Wallet}
          accent="new"
          hint="trên toàn thị trường"
        />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Xu hướng giảm giá</h2>
              <p className="text-xs text-muted-foreground">Số tài sản & mức giảm trung bình theo ngày</p>
            </div>
            <Tabs defaultValue="14d">
              <TabsList className="h-8">
                <TabsTrigger value="7d" className="text-xs h-6">7 ngày</TabsTrigger>
                <TabsTrigger value="14d" className="text-xs h-6">14 ngày</TabsTrigger>
                <TabsTrigger value="30d" className="text-xs h-6">30 ngày</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: -10, right: 5, top: 5, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Số tài sản" />
                <Line type="monotone" dataKey="avgDiscount" stroke="hsl(var(--discount-deep))" strokeWidth={2} dot={false} name="% giảm TB" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-semibold">Theo loại tài sản</h2>
            <p className="text-xs text-muted-foreground">Phân bố tài sản đang theo dõi</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} layout="vertical" margin={{ left: 60, right: 10 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={90} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Top 10 */}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-discount-deep" />
            <h2 className="font-semibold">Top giảm sâu hôm nay</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/discounts">
              Xem tất cả <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium w-10">#</th>
                <th className="px-5 py-2.5 text-left font-medium">Tài sản</th>
                <th className="px-5 py-2.5 text-left font-medium">Khu vực</th>
                <th className="px-5 py-2.5 text-right font-medium">Giá ban đầu</th>
                <th className="px-5 py-2.5 text-right font-medium">Giá hiện tại</th>
                <th className="px-5 py-2.5 text-center font-medium">% giảm</th>
                <th className="px-5 py-2.5 text-center font-medium">Lần ĐG</th>
                <th className="px-5 py-2.5 text-left font-medium">Cập nhật</th>
                <th className="px-5 py-2.5 text-left font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((a, i) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-secondary/40">
                  <td className="px-5 py-3 text-muted-foreground num">{i + 1}</td>
                  <td className="px-5 py-3">
                    <Link href={`/auction/${a.id}`} className="flex items-start gap-2 group">
                      <AssetTypeIcon type={a.type} className="mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium group-hover:text-primary line-clamp-1">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{assetTypeLabel[a.type]}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{a.province}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground line-through num">{formatVNDShort(a.initialPrice)}</td>
                  <td className="px-5 py-3 text-right font-semibold num">{formatVNDShort(a.currentPrice)}</td>
                  <td className="px-5 py-3 text-center">
                    <DiscountBadge percent={getDiscountPercent(a)} />
                  </td>
                  <td className="px-5 py-3 text-center num text-muted-foreground">{a.rounds}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{formatRelativeDays(a.publishedAt)}</td>
                  <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Newly reduced cards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-new-badge" />
            <h2 className="font-semibold">Tài sản mới giảm giá</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {newest.map((a) => (
            <Link
              key={a.id}
              href={`/auction/${a.id}`}
              className="group rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <AssetTypeIcon type={a.type} />
                </div>
                <DiscountBadge percent={getDiscountPercent(a)} />
              </div>
              <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary">{a.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {a.province}
              </p>
              <div className="mt-3 pt-3 border-t flex items-end justify-between">
                <div>
                  <div className="text-xs text-muted-foreground line-through num">{formatVNDShort(a.initialPrice)}</div>
                  <div className="font-semibold num">{formatVND(a.currentPrice)}</div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
