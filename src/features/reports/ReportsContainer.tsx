import dynamic from "next/dynamic";
import Link from "next/link";
import { Download, FileText, Loader2, MapPin, Package, TrendingDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DiscountBadge } from "@/components/auction/DiscountBadge";
import {
  useReportByProvince,
  useReportByType,
  useReportMonthlyTrend,
  useReportTopDiscount,
  assetTypeLabel,
  type AssetType,
} from "@/domains/auction";
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
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#64748b", // slate-500
];

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center text-muted-foreground ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
    </div>
  );
}

export function ReportsContainer() {
  const { data: byProvince } = useReportByProvince(10);
  const { data: byTypeRaw } = useReportByType();
  const { data: monthly } = useReportMonthlyTrend(8);
  const { data: topByPct } = useReportTopDiscount("percent", 5);
  const { data: topByAmt } = useReportTopDiscount("amount", 5);

  const byType = (byTypeRaw || []).map((t, i) => ({
    ...t,
    type: assetTypeLabel[t.type as AssetType] || t.type,
    fill: COLORS[i % COLORS.length],
  }));

  const monthlyData = (monthly || []).map((m) => ({
    month: m.month,
    count: m.count,
    avg: m.avg,
  }));

  return (
    <div className="container mx-auto max-w-[1400px] px-3 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      
      {/* Header section with gradient background */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-background to-background border p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-5 shadow-sm">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-3">
            <TrendingDown className="h-3.5 w-3.5" />
            Cập nhật thời gian thực
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Báo cáo thị trường đấu giá</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
            Phân tích toàn cảnh xu hướng giảm giá, biến động thị trường theo khu vực địa lý, phân khúc tài sản và dữ liệu lịch sử theo tháng.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap relative z-10">
          <Select defaultValue="30d">
            <SelectTrigger className="w-[120px] sm:w-[150px] h-10 bg-background/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 ngày qua</SelectItem>
              <SelectItem value="30d">30 ngày qua</SelectItem>
              <SelectItem value="90d">90 ngày qua</SelectItem>
              <SelectItem value="1y">1 năm qua</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-10 bg-background/50 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-all duration-300">
            <FileText className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Xuất PDF</span>
          </Button>
          <Button variant="outline" className="h-10 bg-background/50 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-all duration-300">
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Xuất Excel</span>
          </Button>
        </div>
      </header>

      {/* Charts Grid */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-gradient-to-br from-card to-card/50 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 group">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform"><MapPin className="h-4 w-4" /></div>
            <div>
              <h2 className="font-semibold text-base">Phân bố tài sản đấu giá theo khu vực</h2>
              <p className="text-xs text-muted-foreground">Thống kê số lượng theo tỉnh/thành phố</p>
            </div>
          </div>
          <div className="h-64 sm:h-80">
            {!byProvince ? (
              <LoadingBlock className="h-full" />
            ) : byProvince.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byProvince} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} opacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="province" tick={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: 500 }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.4 }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }} itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                  <Bar dataKey="count" name="Số tài sản" fill="url(#colorCount)" radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <MapPin className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">Chưa có đủ dữ liệu thống kê</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-gradient-to-br from-card to-card/50 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 group">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform"><Package className="h-4 w-4" /></div>
            <div>
              <h2 className="font-semibold text-base">Cơ cấu loại tài sản</h2>
              <p className="text-xs text-muted-foreground">Phân bổ theo nhóm tài sản đấu giá chính</p>
            </div>
          </div>
          <div className="h-64 sm:h-80">
            {!byTypeRaw ? (
              <LoadingBlock className="h-full" />
            ) : byType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byType} dataKey="count" nameKey="type" innerRadius={70} outerRadius={100} paddingAngle={4} stroke="none" label={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: 500 }}>
                    {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} className="hover:opacity-80 transition-opacity" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }} itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, paddingTop: "20px" }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Package className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">Chưa có đủ dữ liệu thống kê</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Trend Line Chart */}
      <div className="rounded-2xl border bg-gradient-to-br from-card to-card/50 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 group">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform"><TrendingDown className="h-4 w-4" /></div>
            <div>
              <h2 className="font-semibold text-base">Diễn biến tài sản đấu giá theo tháng</h2>
              <p className="text-xs text-muted-foreground">Theo dõi diễn biến thị trường qua thời gian</p>
            </div>
          </div>
        </div>
        <div className="h-72 sm:h-80">
          {!monthly ? (
            <LoadingBlock className="h-full" />
          ) : monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} opacity={0.6} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickMargin={12} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickMargin={8} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickMargin={8} />
                <Tooltip cursor={{ stroke: 'hsl(var(--muted))', strokeWidth: 2, strokeDasharray: '4 4' }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
                <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: 12, paddingBottom: "10px" }} iconType="circle" />
                <Line yAxisId="left" type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} name="Số lượng tài sản" />
                <Line yAxisId="right" type="monotone" dataKey="avg" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} name="% giảm trung bình" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <TrendingDown className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">Chưa có đủ dữ liệu thống kê theo tháng</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Tables */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="border-b bg-muted/30 px-5 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-sm sm:text-base">🔥 Top tài sản giảm giá sâu nhất (%)</h2>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm min-w-[450px]">
              <tbody>
                {(topByPct || []).map((a, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors group">
                    <td className="px-5 py-4 w-12 text-center text-muted-foreground font-medium text-xs">{i + 1}</td>
                    <td className="px-3 py-4">
                      <Link href={`/auction/${a.sourceId}`} className="block">
                        <div className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{a.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{a.province || "Không rõ"}</div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-right align-middle">
                      <DiscountBadge percent={a.priceDropPercent} size="lg" />
                    </td>
                    <td className="pr-4 py-4 w-10 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/auction/${a.sourceId}`}><ArrowRight className="h-4 w-4 text-muted-foreground hover:text-primary" /></Link>
                    </td>
                  </tr>
                ))}
                {!topByPct && <tr><td colSpan={4}><LoadingBlock className="py-12" /></td></tr>}
                {topByPct && topByPct.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Chưa có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="border-b bg-muted/30 px-5 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-sm sm:text-base">💰 Top tài sản giảm nhiều tiền nhất</h2>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm min-w-[450px]">
              <tbody>
                {(topByAmt || []).map((a, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors group">
                    <td className="px-5 py-4 w-12 text-center text-muted-foreground font-medium text-xs">{i + 1}</td>
                    <td className="px-3 py-4">
                      <Link href={`/auction/${a.sourceId}`} className="block">
                        <div className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{a.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{a.province || "Không rõ"}</div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-right align-middle">
                      <div className="inline-flex flex-col items-end">
                        <span className="font-bold text-discount-deep text-base tracking-tight">−{formatVNDShort(a.reducedAmount)}</span>
                        <span className="text-[10px] text-muted-foreground">({a.priceDropPercent.toFixed(1)}%)</span>
                      </div>
                    </td>
                    <td className="pr-4 py-4 w-10 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/auction/${a.sourceId}`}><ArrowRight className="h-4 w-4 text-muted-foreground hover:text-primary" /></Link>
                    </td>
                  </tr>
                ))}
                {!topByAmt && <tr><td colSpan={4}><LoadingBlock className="py-12" /></td></tr>}
                {topByAmt && topByAmt.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Chưa có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
