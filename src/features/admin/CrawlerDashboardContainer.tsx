import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Play,
  Database,
  Loader2,
  RefreshCw,
  Server,
  TrendingUp,
  Cpu,
  Layers,
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrawlLogs, useDashboardStats } from "@/domains/auction";
import { formatDate } from "@/lib/format";
import { triggerListCrawl, triggerDuplicateScan, triggerRecrawlMissingProperties } from "@/services/auction.service";

// Load Recharts dynamically to prevent server-side rendering (SSR) mismatch issues
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const RechartsTooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

const crawlTypeLabel: Record<string, string> = {
  auction_notice: "Cào thông báo đấu giá",
  duplicate_scan: "Quét trùng lặp tài sản",
  recrawl_missing_properties: "Sửa dữ liệu chi tiết lỗi",
  mega_detail_crawl: "Mega cào chi tiết toàn sàn",
  crawl_duplicate_details: "Cào chi tiết nhóm trùng",
  crawl_missing_places: "Cào bổ sung địa danh",
  recrawl_missing_price: "Cào lại tin thiếu giá",
};

export function CrawlerDashboardContainer() {
  const { data: crawlLogs, isLoading: logsLoading, refetch: refetchLogs, isFetching } = useCrawlLogs();
  const { data: stats } = useDashboardStats();
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [btnLoading, setBtnLoading] = useState<string | null>(null);
  const [chartMounted, setChartMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setChartMounted(true), 250);
    return () => clearTimeout(t);
  }, []);

  const logs = useMemo(() => {
    return [...(crawlLogs?.logs || [])].sort((a, b) => {
      const left = new Date(a.startedAt || a.createdAt || 0).getTime();
      const right = new Date(b.startedAt || b.createdAt || 0).getTime();
      return right - left;
    });
  }, [crawlLogs]);

  // Find running logs
  const runningLog = useMemo(() => {
    return logs.find((log) => log.status === "running");
  }, [logs]);

  // Calculate statistics from loaded logs
  const crawlStats = useMemo(() => {
    if (!logs.length) return { todayCount: 0, totalNew: 0, totalSkipped: 0, successRate: 100, errorCount: 0 };
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let todayCount = 0;
    let totalNew = 0;
    let totalSkipped = 0;
    let errorCount = 0;

    logs.forEach((log) => {
      const date = new Date(log.startedAt || log.createdAt);
      if (date >= startOfToday) {
        todayCount++;
      }
      totalNew += log.itemsInserted || 0;
      totalSkipped += log.itemsSkipped || 0;
      if (log.status === "failed") {
        errorCount++;
      }
    });

    const finishedLogs = logs.filter(log => log.status !== "running");
    const successRate = finishedLogs.length 
      ? Math.round(((finishedLogs.length - errorCount) / finishedLogs.length) * 100) 
      : 100;

    return { todayCount, totalNew, totalSkipped, successRate, errorCount };
  }, [logs]);

  // Map data for Recharts AreaChart (last 8 sessions)
  const chartData = useMemo(() => {
    return logs
      .slice(0, 8)
      .reverse()
      .map((log) => {
        const time = log.startedAt 
          ? new Date(log.startedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) 
          : "?";
        return {
          time,
          "Mới": log.itemsInserted || 0,
          "Bỏ qua (Trùng)": log.itemsSkipped || 0,
          "Cập nhật": log.itemsUpdated || 0,
        };
      });
  }, [logs]);

  const handleTriggerAction = async (actionName: string, fn: () => Promise<any>) => {
    setBtnLoading(actionName);
    try {
      await fn();
      setTimeout(() => {
        refetchLogs();
        setBtnLoading(null);
      }, 2000);
    } catch (err) {
      alert(`Thất bại: ${err instanceof Error ? err.message : "Lỗi hệ thống"}`);
      setBtnLoading(null);
    }
  };

  const handleListCrawlTrigger = () => {
    const val = window.prompt("Nhập số trang muốn cào:", "5");
    if (val === null) return; // User cancelled
    const pages = parseInt(val, 10);
    if (isNaN(pages) || pages <= 0) {
      alert("Số trang phải là số nguyên dương lớn hơn 0!");
      return;
    }
    handleTriggerAction("list-crawl", () => triggerListCrawl(pages, "auction"));
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
      case "ok":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "running":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse";
      case "early_stopped":
        return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
      case "failed":
      case "error":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed": return "Hoàn thành";
      case "running": return "Đang chạy";
      case "early_stopped": return "Dừng sớm (Trùng)";
      case "failed": return "Thất bại";
      default: return status;
    }
  };

  return (
    <div className="container mx-auto max-w-[1500px] space-y-5 px-3 sm:px-6 py-5 sm:py-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Nhật ký & Tiến trình Crawler
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Giám sát trạng thái hoạt động trực tiếp của Bot cào dữ liệu đấu giá và lịch sử lưu trữ
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchLogs()}
            disabled={isFetching}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Làm mới {isFetching && <span className="text-[10px] opacity-75">(đang tải)</span>}
          </Button>
        </div>
      </header>

      {/* Live active crawl progress monitoring */}
      {runningLog && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-start sm:items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <div className="font-semibold text-sm sm:text-base flex items-center gap-2">
                  Bot đang cào trực tiếp
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    Live
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Loại: <span className="font-medium text-foreground">{crawlTypeLabel[runningLog.type] || runningLog.type}</span>
                </div>
              </div>
            </div>
            <div className="text-right text-xs sm:text-sm shrink-0">
              <div className="font-medium text-foreground">
                Tiến độ: Trang {runningLog.pagesProcessed || 0} / {runningLog.totalPages || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Bắt đầu lúc: {runningLog.startedAt ? new Date(runningLog.startedAt).toLocaleTimeString("vi-VN") : "—"}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    runningLog.totalPages 
                      ? Math.min(100, Math.round(((runningLog.pagesProcessed || 0) / runningLog.totalPages) * 100)) 
                      : 10 // default fallback
                  }%`
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Đã hoàn thành {runningLog.pagesProcessed || 0} trang</span>
              <span>
                {runningLog.totalPages 
                  ? `${Math.round(((runningLog.pagesProcessed || 0) / runningLog.totalPages) * 100)}%` 
                  : "Đang cào..."}
              </span>
            </div>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-background/50 border rounded-lg p-3 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Thêm mới</div>
              <div className="text-sm sm:text-base font-bold text-emerald-600 num">+{runningLog.itemsInserted || 0}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cập nhật</div>
              <div className="text-sm sm:text-base font-bold text-blue-600 num">+{runningLog.itemsUpdated || 0}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Bỏ qua (Trùng)</div>
              <div className="text-sm sm:text-base font-bold text-muted-foreground num">{runningLog.itemsSkipped || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard KPI cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Tổng đợt cào hôm nay</span>
            <Server className="h-4 w-4 text-primary/70" />
          </div>
          <div className="text-xl sm:text-2xl font-bold num">{crawlStats.todayCount}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Lịch cào định kỳ mỗi 15 phút</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Bản ghi mới (Mỗi đợt)</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 num">+{crawlStats.totalNew.toLocaleString("vi-VN")}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Được thêm trực tiếp vào CSDL</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Tỷ lệ thành công</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 num">{crawlStats.successRate}%</div>
          <p className="text-[10px] text-muted-foreground mt-1">Hoàn thành không gặp lỗi 406/403</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Tổng tin trên hệ thống</span>
            <Database className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold num">{(stats?.totalAuctions ?? 0).toLocaleString("vi-VN")}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Cập nhật mới nhất lúc này</p>
        </div>
      </section>

      {/* Main content grid: charts and controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Graph of crawl statistics over last sessions */}
        <div className="rounded-xl border bg-card p-4 lg:col-span-2 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="font-semibold text-sm sm:text-base">Biểu đồ hiệu suất cào</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Số lượng bản ghi cào được trong 8 phiên gần nhất</p>
          </div>
          <div className="h-[250px] w-full mt-2 relative">
            {chartMounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUpdated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, pt: 10 }} />
                  <Area type="monotone" dataKey="Mới" stroke="#10b981" fillOpacity={1} fill="url(#colorNew)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Cập nhật" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUpdated)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                Đang tải biểu đồ...
              </div>
            )}
          </div>
        </div>

        {/* Bot Quick Operations Panel */}
        <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-sm sm:text-base">Kích hoạt nhanh Bot</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Các lệnh điều khiển cào thủ công ngay trên trình duyệt</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!btnLoading || !!runningLog}
                  onClick={handleListCrawlTrigger}
                  className="w-full justify-start h-10 gap-2.5 text-xs font-medium"
                >
                  {btnLoading === "list-crawl" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Play className="h-4 w-4 text-primary" />
                  )}
                  Cào thủ công (chọn số trang)
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!btnLoading || !!runningLog}
                  onClick={() => handleTriggerAction("dup-scan", () => triggerDuplicateScan())}
                  className="w-full justify-start h-10 gap-2.5 text-xs font-medium"
                >
                  {btnLoading === "dup-scan" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Cpu className="h-4 w-4 text-primary" />
                  )}
                  Chạy quét trùng lặp
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!btnLoading || !!runningLog}
                  onClick={() => handleTriggerAction("fix-data", () => triggerRecrawlMissingProperties(0, "auction", 100))}
                  className="w-full justify-start h-10 gap-2.5 text-xs font-medium"
                >
                  {btnLoading === "fix-data" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Layers className="h-4 w-4 text-primary" />
                  )}
                  Cào lại tài sản lỗi/thiếu
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4 text-xs text-muted-foreground flex gap-1.5 items-center">
            <Server className="h-3.5 w-3.5" />
            <span>Server: localhost:4321 · MongoDB: Online</span>
          </div>
        </div>
      </div>

      {/* Crawl log table & details */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left Side: Recent Logs list */}
        <div className="rounded-xl border bg-card shadow-sm xl:col-span-2">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-sm sm:text-base">Nhật ký hoạt động</h3>
            <span className="text-xs text-muted-foreground font-medium">Hiện 12 đợt gần nhất</span>
          </div>
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {logsLoading ? (
              <div className="py-20 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Đang tải nhật ký...
              </div>
            ) : logs.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">Chưa có nhật ký hoạt động nào.</div>
            ) : (
              logs.slice(0, 12).map((log) => {
                const isSelected = selectedLog?._id === log._id;
                const status = log.status || "unknown";
                const startedAt = log.startedAt ? new Date(log.startedAt) : null;
                const finishedAt = log.finishedAt ? new Date(log.finishedAt) : null;
                const duration = startedAt && finishedAt
                  ? Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)
                  : null;

                return (
                  <div
                    key={log._id}
                    onClick={() => setSelectedLog(log)}
                    className={`flex items-start justify-between gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors cursor-pointer border-l-2 ${
                      isSelected ? "border-primary bg-primary/5" : "border-transparent"
                    }`}
                  >
                    <div className="flex gap-2.5 min-w-0">
                      {status === "completed" || status === "ok" ? (
                        <CheckCircle2 className="h-4.5 w-4.5 mt-0.5 text-emerald-500 shrink-0" />
                      ) : status === "running" ? (
                        <Loader2 className="h-4.5 w-4.5 mt-0.5 text-amber-500 animate-spin shrink-0" />
                      ) : (
                        <XCircle className="h-4.5 w-4.5 mt-0.5 text-rose-500 shrink-0" />
                      )}
                      
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            {crawlTypeLabel[log.type] || log.type}
                          </span>
                          <span className={`border text-[9px] font-semibold rounded px-1.5 ${getStatusBadgeClass(status)}`}>
                            {getStatusText(status)}
                          </span>
                        </div>
                        
                        <div className="text-xs mt-1 text-muted-foreground leading-normal">
                          {log.type === "recrawl_missing_properties" || log.type === "mega_detail_crawl" ? (
                            <>
                              Đã quét: <strong className="num text-foreground">{log.itemsInserted || 0}</strong> ·
                              Đủ dữ liệu bỏ qua: <strong className="num text-foreground">{log.itemsSkipped || 0}</strong> ·
                              Đã sửa: <strong className="num text-foreground">{log.itemsUpdated || 0}</strong>
                            </>
                          ) : (
                            <>
                              Thêm mới: <strong className="num text-foreground">+{log.itemsInserted || 0}</strong> ·
                              Cập nhật: <strong className="num text-foreground">+{log.itemsUpdated || 0}</strong> ·
                              Bỏ qua: <strong className="num text-foreground">{log.itemsSkipped || 0}</strong>
                            </>
                          )}
                          {log.pagesProcessed !== undefined && log.pagesProcessed > 0 && (
                            <span> · Số trang: <strong className="num text-foreground">{log.pagesProcessed}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 text-[10px] text-muted-foreground flex flex-col justify-center">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{startedAt ? startedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                      </div>
                      {duration !== null && <div className="mt-0.5">{duration}s</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Selected Log Detail */}
        <div className="rounded-xl border bg-card shadow-sm flex flex-col">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold text-sm sm:text-base">Thông tin đợt cào</h3>
          </div>
          
          <div className="flex-1 p-4">
            {selectedLog ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Loại hoạt động</div>
                  <div className="font-semibold text-sm">{crawlTypeLabel[selectedLog.type] || selectedLog.type}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Bắt đầu lúc</div>
                    <div className="text-xs font-medium mt-0.5">
                      {selectedLog.startedAt ? new Date(selectedLog.startedAt).toLocaleString("vi-VN") : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Kết thúc lúc</div>
                    <div className="text-xs font-medium mt-0.5">
                      {selectedLog.finishedAt ? new Date(selectedLog.finishedAt).toLocaleString("vi-VN") : "—"}
                    </div>
                  </div>
                </div>

                {/* Notices crawled list */}
                {Array.isArray(selectedLog.recentNotices) && selectedLog.recentNotices.length > 0 ? (
                  <div className="space-y-2 border-t pt-3">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                      Bản ghi cào gần nhất ({Math.min(5, selectedLog.recentNotices.length)})
                    </div>
                    
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {selectedLog.recentNotices.slice(0, 5).map((notice: any, idx: number) => (
                        <div key={idx} className="bg-secondary/40 border border-border/50 rounded-lg p-2.5 text-xs flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{notice.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-1.5 items-center">
                              <span className="font-mono text-foreground/80">#{notice.sourceId}</span>
                              {notice.province && (
                                <>
                                  <span>·</span>
                                  <span>{notice.province}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                            <a
                              href={`https://dgts.moj.gov.vn/thong-bao-cong-khai-viec-dau-gia/${notice.sourceId}.html`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-4 text-center text-xs text-muted-foreground">
                    Không có thông tin chi tiết các bản ghi trong đợt cào này.
                  </div>
                )}

                {/* Error messages if exists */}
                {Array.isArray(selectedLog.errorMessages) && selectedLog.errorMessages.length > 0 && (
                  <div className="space-y-1.5 border-t pt-3">
                    <div className="text-xs font-medium text-rose-500 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Thông báo lỗi / chi tiết log
                    </div>
                    <div className="bg-rose-500/5 text-rose-600 rounded-lg p-2.5 text-[11px] font-mono leading-relaxed border border-rose-500/10 max-h-[150px] overflow-y-auto">
                      {selectedLog.errorMessages.join("; ")}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-xs py-20">
                <Layers className="h-8 w-8 opacity-45 mb-2" />
                <span>Chọn một đợt cào bên danh sách để xem chi tiết thông tin và log lỗi</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
