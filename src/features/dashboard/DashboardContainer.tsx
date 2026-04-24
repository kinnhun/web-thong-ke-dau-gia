import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowRight,
  Calendar,
  ExternalLink,
  FileBarChart,
  Flame,
  History,
  Layers,
  Loader2,
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
  useDashboardStats,
  useDashboardTrend,
  useTopDiscounted,
  useNewlyReduced,
  useTopRelisted,
  assetTypeLabel,
  type AssetType,
} from "@/domains/auction";
import { formatVND, formatVNDShort, formatRelativeDays } from "@/lib/format";
import { useState } from "react";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center text-muted-foreground ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

export function DashboardContainer() {
  const [trendDays, setTrendDays] = useState(14);
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: trendData } = useDashboardTrend(trendDays);
  const { data: top10 } = useTopDiscounted(10);
  const { data: newest } = useNewlyReduced(4);
  const { data: topRelisted } = useTopRelisted(4);

  const typeData = (stats?.byType || [])
    .map((t) => {
      const label = assetTypeLabel[t.type as AssetType] || t.type;
      return { type: label.length > 12 ? label.slice(0, 12) + "…" : label, count: t.count };
    })
    .filter((d) => d.count > 0);

  const chartTrend = (trendData || []).map((t) => ({
    day: t.date.slice(5), // MM-DD
    count: t.count,
    avgDiscount: t.avgDiscount,
  }));

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 sm:space-y-8 px-4 sm:px-6 py-5 sm:py-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Tổng quan</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Cập nhật hôm nay · Dữ liệu từ nguồn công khai
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs sm:text-sm">
            <FileBarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Xuất báo cáo</span>
            <span className="sm:hidden">Xuất</span>
          </Button>
          <Button size="sm" asChild className="text-xs sm:text-sm">
            <Link href="/discounts">
              Xem giảm sâu <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* KPIs */}
      {statsLoading ? (
        <LoadingBlock className="h-24" />
      ) : (
        <section className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Thông báo đấu giá"
            value={(stats?.totalAuctions ?? 0).toLocaleString("vi-VN")}
            icon={Layers}
            hint={`${(stats?.newIn72h ?? 0).toLocaleString("vi-VN")} mới trong 72h`}
          />
          <KpiCard
            label="Lựa chọn tổ chức"
            value={(stats?.totalOrg ?? 0).toLocaleString("vi-VN")}
            icon={FileBarChart}
            hint="thông báo lựa chọn tổ chức ĐG"
          />
          <KpiCard
            label="Đang giảm giá"
            value={(stats?.totalDiscounted ?? 0).toLocaleString("vi-VN")}
            icon={TrendingDown}
            accent="deep"
            hint={`${stats?.totalAuctions ? ((stats.totalDiscounted / stats.totalAuctions) * 100).toFixed(1) : 0}% tổng tài sản`}
          />
          <KpiCard
            label="Mức giảm cao nhất"
            value={`−${(stats?.maxDiscountPercent ?? 0).toFixed(1)}%`}
            icon={Flame}
            accent="mid"
            hint={stats?.maxDiscountItem?.name ? stats.maxDiscountItem.name.slice(0, 40) : "ghi nhận hiện tại"}
          />
          <KpiCard
            label="Tổng giá trị giảm"
            value={formatVNDShort(stats?.totalReducedValue ?? 0)}
            icon={Wallet}
            accent="new"
            hint="trên toàn thị trường"
          />
          <KpiCard
            label="Mới 7 ngày"
            value={(stats?.recentCount ?? 0).toLocaleString("vi-VN")}
            icon={Activity}
            hint="thông báo đấu giá mới"
          />
        </section>
      )}

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-3 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-semibold text-sm sm:text-base">Xu hướng giảm giá</h2>
              <p className="text-xs text-muted-foreground">Số tài sản & mức giảm trung bình theo ngày</p>
            </div>
            <Tabs value={String(trendDays)} onValueChange={(v) => setTrendDays(Number(v))}>
              <TabsList className="h-7 sm:h-8">
                <TabsTrigger value="7" className="text-[10px] sm:text-xs h-5 sm:h-6 px-2">7 ngày</TabsTrigger>
                <TabsTrigger value="14" className="text-[10px] sm:text-xs h-5 sm:h-6 px-2">14 ngày</TabsTrigger>
                <TabsTrigger value="30" className="text-[10px] sm:text-xs h-5 sm:h-6 px-2">30 ngày</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-48 sm:h-64">
            {chartTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartTrend} margin={{ left: -10, right: 5, top: 5, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Số tài sản" />
                  <Line type="monotone" dataKey="avgDiscount" stroke="hsl(var(--discount-deep))" strokeWidth={2} dot={false} name="% giảm TB" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <LoadingBlock className="h-full" />
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-semibold">Theo loại tài sản</h2>
            <p className="text-xs text-muted-foreground">Phân bố tài sản đang theo dõi</p>
          </div>
          <div className="h-64">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ left: 60, right: 10 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={90} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <LoadingBlock className="h-full" />
            )}
          </div>
        </div>
      </section>

      {/* Top 10 */}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-discount-deep" />
            <h2 className="font-semibold">Top giảm sâu</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/discounts">
              Xem tất cả <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
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
              {(top10 || []).map((a, i) => (
                <tr key={a._id} className="border-b last:border-0 hover:bg-secondary/40">
                  <td className="px-5 py-3 text-muted-foreground num">{i + 1}</td>
                  <td className="px-5 py-3">
                    <Link href={`/auction/${a.sourceId}`} className="flex items-start gap-2 group">
                      <AssetTypeIcon type={a.type} className="mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium group-hover:text-primary line-clamp-1">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{assetTypeLabel[a.type] || a.type}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{a.province}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground line-through num">{formatVNDShort(a.firstPrice)}</td>
                  <td className="px-5 py-3 text-right font-semibold num">{formatVNDShort(a.latestPrice)}</td>
                  <td className="px-5 py-3 text-center">
                    <DiscountBadge percent={a.priceDropPercent} />
                  </td>
                  <td className="px-5 py-3 text-center num text-muted-foreground">{a.relistCount}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {a.publishedAt ? formatRelativeDays(a.publishedAt) : "—"}
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
              {!top10 && (
                <tr><td colSpan={9}><LoadingBlock className="py-8" /></td></tr>
              )}
              {top10 && top10.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">Chưa có dữ liệu giảm giá</td></tr>
              )}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(newest || []).map((a) => (
            <Link
              key={a._id}
              href={`/auction/${a.sourceId}`}
              className="group rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <AssetTypeIcon type={a.type} />
                </div>
                <DiscountBadge percent={a.priceDropPercent} />
              </div>
              <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary">{a.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {a.province}
              </p>
              <div className="mt-3 pt-3 border-t flex items-end justify-between">
                <div>
                  <div className="text-xs text-muted-foreground line-through num">{formatVNDShort(a.firstPrice)}</div>
                  <div className="font-semibold num">{formatVND(a.latestPrice)}</div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </Link>
          ))}
          {!newest && <LoadingBlock className="col-span-full py-12" />}
        </div>
      </section>

      {/* Top Relisted cards */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Tài sản đăng lại nhiều nhất</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(topRelisted || []).map((a) => (
            <Link
              key={a._id}
              href={`/auction/${a.sourceId}`}
              className="group rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <AssetTypeIcon type={a.type} />
                </div>
                <div className="px-2 py-1 bg-muted rounded text-xs font-semibold num">
                  Lần {a.relistCount}
                </div>
              </div>
              <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary">{a.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {a.province}
              </p>
              <div className="mt-3 pt-3 border-t flex items-end justify-between">
                <div>
                  {a.priceDropPercent > 0 && <div className="text-xs text-muted-foreground line-through num">{formatVNDShort(a.firstPrice)}</div>}
                  <div className="font-semibold num">{formatVND(a.latestPrice)}</div>
                </div>
                {a.priceDropPercent > 0 && <DiscountBadge percent={a.priceDropPercent} />}
              </div>
            </Link>
          ))}
          {!topRelisted && <LoadingBlock className="col-span-full py-12" />}
          {topRelisted && topRelisted.length === 0 && <div className="col-span-full text-center text-muted-foreground py-8">Chưa có dữ liệu</div>}
        </div>
      </section>
    </div>
  );
}
