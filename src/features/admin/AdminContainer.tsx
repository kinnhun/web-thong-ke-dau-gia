import { useState, useRef } from "react";
import {
  AlertCircle, CheckCircle2, Database, Download, Eye, GitMerge,
  Loader2, Pencil, RefreshCw, Split, Wand2, XCircle, Activity,
  TrendingDown, Layers, FileBarChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCrawlLogs, useAuctions, useDashboardStats } from "@/domains/auction";
import { formatDate, formatVNDShort } from "@/lib/format";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  triggerListCrawl,
  triggerDetailCrawl,
  triggerDuplicateScan,
  triggerRecrawlMissingProperties,
} from "@/services/auction.service";

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    ok: "bg-new-badge-soft text-new-badge",
    completed: "bg-new-badge-soft text-new-badge",
    early_stopped: "bg-discount-light-soft text-discount-light-foreground",
    pending: "bg-watch-badge-soft text-watch-badge",
    running: "bg-watch-badge-soft text-watch-badge",
    error: "bg-discount-deep-soft text-discount-deep",
    failed: "bg-discount-deep-soft text-discount-deep",
    approved: "bg-new-badge-soft text-new-badge",
  };
  const label: Record<string, string> = {
    ok: "Đã xử lý", completed: "Hoàn thành", early_stopped: "Dừng sớm", pending: "Chờ duyệt",
    running: "Đang chạy", error: "Lỗi", failed: "Thất bại", approved: "Đã duyệt",
  };
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${map[s] || "bg-secondary"}`}>{label[s] || s}</span>;
};

export function AdminContainer() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const { data: crawlLogs, isLoading: logsLoading, refetch: refetchLogs } = useCrawlLogs();
  const { data: rawAuctions, isLoading: rawLoading } = useAuctions({ page: 1, limit: 200, sort: "publishedAt", order: "desc" });
  const { data: stats } = useDashboardStats();

  const rawRecords = rawAuctions?.items || [];
  const logs = (crawlLogs || []).slice(0, 15);

  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: rawRecords.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 5,
  });

  const handleAction = async (name: string, fn: () => Promise<unknown>) => {
    setActionLoading(name);
    setActionResult(null);
    try {
      await fn();
      setActionResult(`✅ ${name} thành công`);
      refetchLogs();
    } catch (err) {
      setActionResult(`❌ ${name} thất bại: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const actions = [
    { icon: RefreshCw, title: "Crawl danh sách", desc: "Thu thập tin mới", fn: () => triggerListCrawl(5, "auction") },
    { icon: Database, title: "Crawl chi tiết", desc: "Lấy thông tin chi tiết", fn: () => triggerDetailCrawl(20, "auction") },
    { icon: Wand2, title: "Quét trùng lặp", desc: "Tìm bài đăng lại", fn: () => triggerDuplicateScan() },
    { icon: GitMerge, title: "Crawl tổ chức", desc: "Crawl thông báo lựa chọn", fn: () => triggerListCrawl(5, "org") },
    { icon: Eye, title: "Chi tiết tổ chức", desc: "Detail org selection", fn: () => triggerDetailCrawl(20, "org") },
    { icon: Split, title: "Cào lại tài sản", desc: "Cào lại items thiếu bảng tài sản", fn: () => triggerRecrawlMissingProperties(100, "auction") },
  ];

  return (
    <div className="container mx-auto max-w-[1400px] px-3 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />Quản trị dữ liệu
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Crawler, chuẩn hóa, ghép tài sản và xử lý lỗi</p>
        </div>
      </header>

      {actionResult && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm flex items-center gap-2 ${actionResult.startsWith("✅") ? "bg-new-badge-soft border-new-badge/20 text-new-badge" : "bg-discount-deep-soft border-discount-deep/20 text-discount-deep"}`}>
          {actionResult.startsWith("✅") ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {actionResult}
        </div>
      )}

      {/* Tổng quan dữ liệu */}
      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Layers className="h-4 w-4" />
            <span className="text-xs font-medium">Thông báo đấu giá</span>
          </div>
          <div className="text-lg sm:text-xl font-bold num">{(stats?.totalAuctions ?? 0).toLocaleString("vi-VN")}</div>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <FileBarChart className="h-4 w-4" />
            <span className="text-xs font-medium">Lựa chọn tổ chức</span>
          </div>
          <div className="text-lg sm:text-xl font-bold num">{(stats?.totalOrg ?? 0).toLocaleString("vi-VN")}</div>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingDown className="h-4 w-4 text-discount-deep" />
            <span className="text-xs font-medium">Đang giảm giá</span>
          </div>
          <div className="text-lg sm:text-xl font-bold num text-discount-deep">{(stats?.totalDiscounted ?? 0).toLocaleString("vi-VN")}</div>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Activity className="h-4 w-4 text-new-badge" />
            <span className="text-xs font-medium">Mới 72h</span>
          </div>
          <div className="text-lg sm:text-xl font-bold num text-new-badge">{(stats?.newIn72h ?? 0).toLocaleString("vi-VN")}</div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        {actions.map((item) => (
          <button
            key={item.title}
            onClick={() => handleAction(item.title, item.fn)}
            disabled={!!actionLoading}
            className="rounded-xl border bg-card p-3 sm:p-4 text-left hover:border-foreground/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            {actionLoading === item.title ? (
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary mb-2 animate-spin" />
            ) : (
              <item.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary mb-2" />
            )}
            <div className="font-medium text-[13px] sm:text-sm">{item.title}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{item.desc}</div>
          </button>
        ))}
      </section>

      <Tabs defaultValue="raw" className="space-y-4">
        <TabsList>
          <TabsTrigger value="raw">Dữ liệu gần đây</TabsTrigger>
          <TabsTrigger value="logs">Nhật ký crawl</TabsTrigger>
        </TabsList>

        <TabsContent value="raw">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <div className="w-full min-w-[950px] text-sm">
              <div className="flex text-xs text-muted-foreground border-b bg-secondary/30 font-medium">
                <div className="px-4 py-2.5 w-24">Source ID</div>
                <div className="px-4 py-2.5 flex-1 min-w-[250px]">Tên tài sản</div>
                <div className="px-4 py-2.5 w-32">Tỉnh</div>
                <div className="px-4 py-2.5 w-32">Ngày đăng</div>
                <div className="px-4 py-2.5 w-20 text-center">% giảm</div>
                <div className="px-4 py-2.5 w-32">Trạng thái</div>
                <div className="px-4 py-2.5 w-24 text-right">Thao tác</div>
              </div>
              
              <div ref={parentRef} className="h-[500px] overflow-auto">
                <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const r = rawRecords[virtualRow.index];
                    return (
                      <div
                        key={r._id}
                        className="flex items-center border-b last:border-0 hover:bg-secondary/40 absolute top-0 left-0 w-full"
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="px-4 py-3 w-24 font-mono text-xs">{r.sourceId}</div>
                        <div className="px-4 py-3 flex-1 min-w-[250px]">
                          <div className="line-clamp-1" title={r.name}>{r.name}</div>
                        </div>
                        <div className="px-4 py-3 w-32 text-muted-foreground">{r.province || "—"}</div>
                        <div className="px-4 py-3 w-32 text-muted-foreground text-xs">{r.publishedAt ? formatDate(r.publishedAt) : "—"}</div>
                        <div className="px-4 py-3 w-20 text-center num text-discount-deep font-medium">
                          {r.priceDropPercent > 0 ? `−${r.priceDropPercent.toFixed(1)}%` : "—"}
                        </div>
                        <div className="px-4 py-3 w-32">{statusBadge(r.status || "ok")}</div>
                        <div className="px-4 py-3 w-24 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                  {rawRecords.length === 0 && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      {logsLoading ? <Loader2 className="h-5 w-5 animate-spin inline" /> : "Chưa có dữ liệu"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-3 sm:px-5 py-3">
              <h3 className="font-semibold text-sm">Nhật ký crawl gần đây</h3>
              <Button variant="outline" size="sm" className="text-xs h-7 sm:h-9" onClick={() => refetchLogs()}>
                <RefreshCw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Làm mới</span>
              </Button>
            </div>
            <div className="divide-y">
              {logsLoading ? (
                <div className="px-5 py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Đang tải...</div>
              ) : logs.length === 0 ? (
                <div className="px-5 py-8 text-center text-muted-foreground">Chưa có nhật ký</div>
              ) : (
                logs.map((l: Record<string, unknown>, i: number) => {
                  const status = String(l.status || "unknown");
                  const type = String(l.type || "");
                  const Icon = status === "failed" ? XCircle : status === "running" ? AlertCircle : CheckCircle2;
                  const color = status === "failed" ? "text-destructive" : status === "running" ? "text-watch-badge" : "text-new-badge";
                  const startedAt = l.startedAt ? new Date(l.startedAt as string) : null;
                  const finishedAt = l.finishedAt ? new Date(l.finishedAt as string) : null;
                  const duration = startedAt && finishedAt
                    ? Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)
                    : null;

                  return (
                    <div key={i} className="flex items-start gap-2 sm:gap-3 px-3 sm:px-5 py-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                          <span className="font-mono">{startedAt ? startedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "?"}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.5">{type}</span>
                          {statusBadge(status)}
                          {duration !== null && <span>{duration}s</span>}
                        </div>
                        <div className="text-xs sm:text-sm mt-0.5 leading-relaxed">
                          {l.itemsInserted !== undefined && <span>Mới: <strong className="num">{String(l.itemsInserted)}</strong></span>}
                          {l.itemsUpdated !== undefined && <span> · Cập nhật: <strong className="num">{String(l.itemsUpdated)}</strong></span>}
                          {l.itemsSkipped !== undefined && <span> · Bỏ qua: <strong className="num">{String(l.itemsSkipped)}</strong></span>}
                          {l.pagesProcessed !== undefined && <span> · Trang: <strong className="num">{String(l.pagesProcessed)}</strong></span>}
                        </div>
                        {Array.isArray(l.errorMessages) && l.errorMessages.length > 0 && (
                          <div className="text-xs text-destructive mt-1">{(l.errorMessages as string[]).slice(0, 2).join("; ")}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
