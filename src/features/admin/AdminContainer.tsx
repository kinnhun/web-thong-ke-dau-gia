import { useState } from "react";
import {
  AlertCircle, CheckCircle2, Database, Eye, GitMerge,
  Loader2, Pencil, RefreshCw, Split, Wand2, XCircle, Activity,
  TrendingDown, Layers, FileBarChart, Download, Copy, ExternalLink, Globe,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCrawlLogs, useAuctions, useDashboardStats, useCollections, useTunnelUrl } from "@/domains/auction";
import { formatDate } from "@/lib/format";
import {
  triggerListCrawl,
  triggerDetailCrawl,
  triggerDuplicateScan,
  triggerRecrawlMissingProperties,
  triggerKillRecrawlMissingProperties,
  triggerMegaDetailCrawl,
  triggerKillDuplicateScan,
  triggerCrawlDuplicateDetails,
  setSkipDetailCrawlSetting,
  triggerRecrawlMissingPrice,
  triggerKillRecrawlMissingPrice,
  triggerRecrawlItem,
} from "@/services/auction.service";
import { continueTmpFullCrawl } from "@/services/tmp-full-crawl.service";

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

const crawlTypeLabel: Record<string, string> = {
  auction_notice: "Crawl thông báo đấu giá",
  duplicate_scan: "Quét trùng lặp",
  recrawl_missing_properties: "Cào lại tài sản lỗi",
  mega_detail_crawl: "Mega crawl chi tiết",
  crawl_duplicate_details: "Cào detail nhóm trùng lặp",
};

export function AdminContainer() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [skipDetail, setSkipDetail] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"raw" | "logs" | "missingPrice">("raw");
  const { data: crawlLogs, isLoading: logsLoading, refetch: refetchLogs } = useCrawlLogs();
  const { data: rawAuctions, isLoading: rawLoading } = useAuctions({ page: 1, limit: 200, sort: "publishedAt", order: "desc" });
  const { data: stats } = useDashboardStats();
  const { data: collectionsData, isLoading: collectionsLoading } = useCollections();
  const { data: tunnelData } = useTunnelUrl();
  const [copied, setCopied] = useState(false);

  // States & query for missing price items
  const [missingPricePage, setMissingPricePage] = useState(1);
  const [singleRecrawling, setSingleRecrawling] = useState<Record<number, boolean>>({});
  const { data: missingAuctions, isLoading: missingLoading, refetch: refetchMissing } = useAuctions({
    page: missingPricePage,
    limit: 50,
    missingPrice: "true",
    sort: "publishedAt",
    order: "desc"
  });
  const missingRecords = missingAuctions?.items || [];

  const handleSingleRecrawl = async (sourceId: number) => {
    setSingleRecrawling(prev => ({ ...prev, [sourceId]: true }));
    try {
      await triggerRecrawlItem(sourceId, "auction");
      setActionResult(`✅ Đã gửi yêu cầu cào lại tài sản #${sourceId}. Dữ liệu sẽ tự động cập nhật sau vài giây.`);
      setTimeout(() => {
        refetchMissing();
      }, 3000);
    } catch (err) {
      setActionResult(`❌ Lỗi khi cào lại tài sản #${sourceId}: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setSingleRecrawling(prev => ({ ...prev, [sourceId]: false }));
    }
  };

  const copyTunnelUrl = () => {
    if (tunnelData?.url) {
      navigator.clipboard.writeText(tunnelData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const rawRecords = rawAuctions?.items || [];
  const crawlLogPayload = crawlLogs;
  const logs = [...(crawlLogPayload?.logs || [])]
    .sort((a, b) => {
      const left = new Date(String(b.createdAt || b.startedAt || 0)).getTime();
      const right = new Date(String(a.createdAt || a.startedAt || 0)).getTime();
      return left - right;
    })
    .slice(0, 15);
  const duplicateScanLog = logs.find((log) => log.type === "duplicate_scan");
  const hasRunningDuplicateScan = Boolean(crawlLogPayload?.hasRunningDuplicateScan);

  const handleAction = async (name: string, fn: () => Promise<unknown>) => {
    setActionLoading(name);
    setActionResult(null);
    try {
      const result = await fn();
      const payload = result as {
        message?: string;
        totalMatched?: number;
        scannedCount?: number;
        skippedCompleteCount?: number;
      };

      if (name === "Cào lại tài sản" || name === "Mega crawl chi tiết" || name === "Tiếp tục mega crawl" || name === "Cào detail trùng lặp") {
        const scannedLabel = payload.scannedCount !== undefined ? `Đã quét ${payload.scannedCount} item` : null;
        const matchedLabel = payload.totalMatched !== undefined ? `cần recrawl ${payload.totalMatched} item` : null;
        const skippedLabel = payload.skippedCompleteCount !== undefined ? `bỏ qua ${payload.skippedCompleteCount} item đủ dữ liệu` : null;
        const summary = [scannedLabel, matchedLabel, skippedLabel].filter(Boolean).join(" · ");
        setActionResult(`✅ ${payload.message || `${name} đã chạy nền`}${summary ? ` — ${summary}` : ""}. Theo dõi tiến trình trong Nhật ký crawl.`);
      } else {
        setActionResult(`✅ ${name} thành công`);
      }

      refetchLogs();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown";
      if (name === "Quét trùng lặp" && message.includes("Đang có một tiến trình quét trùng lặp chạy nền")) {
        setActionResult("ℹ️ Quét trùng lặp đang chạy nền. Bạn có thể theo dõi tiến trình ngay trong Nhật ký crawl.");
        refetchLogs();
      } else if (name === "Cào lại tài sản" && message.includes("Đang có tiến trình cào lại tài sản chạy nền")) {
        setActionResult("ℹ️ Cào lại tài sản đang chạy nền. Bạn có thể theo dõi tiến trình ngay trong Nhật ký crawl.");
        refetchLogs();
      } else if ((name === "Mega crawl chi tiết" || name === "Tiếp tục mega crawl") && message.includes("Đang có tiến trình mega crawl detail chạy nền")) {
        setActionResult("ℹ️ Mega crawl chi tiết đang chạy nền. Bạn có thể theo dõi tiến trình ngay trong Nhật ký crawl.");
        refetchLogs();
      } else {
        setActionResult(`❌ ${name} thất bại: ${message}`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const actions = [
    { icon: RefreshCw, title: "Crawl thủ công", desc: "Cập nhật dữ liệu mới", fn: () => triggerListCrawl(5, "auction") },
    { icon: Wand2, title: "Quét trùng lặp", desc: "Tìm & gộp bài trùng", fn: () => triggerDuplicateScan() },
    { icon: XCircle, title: "Dừng quét trùng", desc: "Hủy quét trùng đang chạy", fn: () => triggerKillDuplicateScan() },
    { icon: Split, title: "Sửa dữ liệu lỗi", desc: "Cào lại item thiếu chi tiết", fn: () => triggerRecrawlMissingProperties(0, "auction", 100) },
    { icon: XCircle, title: "Dừng sửa lỗi", desc: "Hủy job sửa dữ liệu đang chạy", fn: () => triggerKillRecrawlMissingProperties() },
    { icon: TrendingDown, title: "Crawl thiếu giá", desc: "Cào lại tin thiếu giá", fn: () => triggerRecrawlMissingPrice(0, "auction", 100) },
    { icon: XCircle, title: "Dừng cào thiếu giá", desc: "Dừng job cào tin thiếu giá", fn: () => triggerKillRecrawlMissingPrice() },
    { icon: Activity, title: "Mega Crawl", desc: "Quét chi tiết toàn bộ DB", fn: () => triggerMegaDetailCrawl(0, "auction", 10) },
    { icon: RefreshCw, title: "Tiếp tục Mega Crawl", desc: "Chạy tiếp tiến trình dở dang", fn: () => continueTmpFullCrawl() },
    { icon: GitMerge, title: "Cào detail trùng lặp", desc: "Cào detail cho bài trong nhóm trùng", fn: () => triggerCrawlDuplicateDetails() },
    {
      icon: skipDetail ? Activity : XCircle,
      title: skipDetail ? "Đang BỎ QUA Detail" : "Cho phép cào Detail",
      desc: "Chặn bot không cào detail khi bị lỗi 406",
      fn: async () => {
        const newStatus = !skipDetail;
        setSkipDetail(newStatus);
        const res = await setSkipDetailCrawlSetting(newStatus);
        return { message: res.message || (newStatus ? "Đã TẮT cào detail." : "Đã BẬT cào detail.") };
      }
    },
    {
      icon: Database,
      title: "Backup dữ liệu",
      desc: "Tải DB về máy (.gz)",
      fn: () => {
        window.location.href = "/api/system/backup";
        return Promise.resolve({ message: "Đang bắt đầu tải xuống tệp backup dữ liệu..." });
      }
    },
    {
      icon: Download,
      title: "Xuất dữ liệu",
      desc: "Tải CSV/JSON từng bảng",
      fn: () => {
        setExportOpen(true);
        return Promise.resolve({ message: "Mở menu xuất dữ liệu" });
      }
    }
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

      {/* Tunnel URL Section — luôn hiện */}
      <section className={`rounded-xl border px-4 py-3 sm:px-5 sm:py-4 ${tunnelData?.active ? "border-primary/20 bg-primary/5" : "border-border bg-secondary/30"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Globe className={`h-4 w-4 ${tunnelData?.active ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-xs sm:text-sm font-medium ${tunnelData?.active ? "text-primary" : "text-muted-foreground"}`}>Link truy cập từ xa</span>
          </div>
          {tunnelData?.active && tunnelData?.url ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <code className="text-xs sm:text-sm font-mono bg-background/80 border rounded px-2.5 py-1.5 truncate flex-1 select-all">
                {tunnelData.url}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5"
                onClick={copyTunnelUrl}
              >
                {copied ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-new-badge" /><span className="text-xs">Đã copy</span></>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /><span className="text-xs">Copy</span></>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5"
                onClick={() => window.open(tunnelData.url!, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="text-xs hidden sm:inline">Mở</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Tunnel đang kết nối... (tự động bật WARP)</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {actionResult && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm flex items-center gap-2 ${actionResult.startsWith("✅") ? "bg-new-badge-soft border-new-badge/20 text-new-badge" : "bg-discount-deep-soft border-discount-deep/20 text-discount-deep"}`}>
          {actionResult.startsWith("✅") ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {actionResult}
        </div>
      )}

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xuất dữ liệu hệ thống</DialogTitle>
            <DialogDescription>
              Tải xuống dữ liệu từ các collection dưới dạng JSON (mặc định) hoặc CSV. File sẽ được nén dưới định dạng .gz để tiết kiệm băng thông.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {collectionsLoading ? (
              <div className="flex items-center justify-center p-4 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Đang tải danh sách...</div>
            ) : collectionsData?.collections?.length ? (
              collectionsData.collections.map((col: { key: string, label: string, count: number }) => (
                <div key={col.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm">{col.label}</div>
                    <div className="text-xs text-muted-foreground num">{col.count.toLocaleString("vi-VN")} bản ghi</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs font-medium" onClick={() => window.location.href = `/api/system/export/${col.key}?format=csv`}>CSV</Button>
                    <Button variant="default" size="sm" className="h-8 text-xs font-medium" onClick={() => window.location.href = `/api/system/export/${col.key}?format=json`}>JSON</Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-muted-foreground">Không tìm thấy collection nào.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Layers className="h-4 w-4" />
            <span className="text-xs font-medium">Thông báo đấu giá</span>
          </div>
          <div className="text-lg sm:text-xl font-bold num">{(stats?.totalAuctions ?? 0).toLocaleString("vi-VN")}</div>
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

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-6">
        {actions.map((item) => {
          const isDuplicateAction = item.title === "Quét trùng lặp";
          const isKillDuplicateAction = item.title === "Dừng quét trùng";
          const isDisabled = !!actionLoading || (isDuplicateAction && hasRunningDuplicateScan) || (isKillDuplicateAction && !hasRunningDuplicateScan);

          return (
            <button
              key={item.title}
              onClick={() => handleAction(item.title, item.fn)}
              disabled={isDisabled}
              className="rounded-xl border bg-card p-3 sm:p-4 text-left hover:border-foreground/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {actionLoading === item.title ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary mb-2 animate-spin" />
              ) : (
                <item.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary mb-2" />
              )}
              <div className="font-medium text-[13px] sm:text-sm">{item.title}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              {isDuplicateAction && hasRunningDuplicateScan && (
                <div className="mt-2 text-[10px] sm:text-xs text-watch-badge">Đang có tiến trình chạy nền...</div>
              )}
              {isKillDuplicateAction && !hasRunningDuplicateScan && (
                <div className="mt-2 text-[10px] sm:text-xs text-muted-foreground">Không có tiến trình để dừng</div>
              )}
            </button>
          );
        })}
      </section>

      {duplicateScanLog && (
        <section className="rounded-xl border bg-card px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="font-semibold">Tiến trình quét trùng lặp</span>
            {statusBadge(String(duplicateScanLog.status || "unknown"))}
            {duplicateScanLog.pagesProcessed !== undefined && (
              <span className="text-muted-foreground">Đã xử lý: <strong className="num text-foreground">{String(duplicateScanLog.pagesProcessed)}</strong></span>
            )}
            {duplicateScanLog.itemsUpdated !== undefined && (
              <span className="text-muted-foreground"> · Cập nhật: <strong className="num text-foreground">{String(duplicateScanLog.itemsUpdated)}</strong></span>
            )}
          </div>
          {Array.isArray(duplicateScanLog.errorMessages) && duplicateScanLog.errorMessages.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {String(duplicateScanLog.errorMessages[duplicateScanLog.errorMessages.length - 1] || "")}
            </div>
          )}
        </section>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "raw" | "logs" | "missingPrice")} className="space-y-4">
        <TabsList>
          <TabsTrigger value="raw">Dữ liệu gần đây</TabsTrigger>
          <TabsTrigger value="missingPrice">Tin thiếu giá</TabsTrigger>
          <TabsTrigger value="logs">Nhật ký crawl</TabsTrigger>
        </TabsList>

        <TabsContent value="raw">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <div className="w-full min-w-[1200px] text-sm">
              <div className="hidden lg:flex items-center border-b bg-secondary/30 text-xs font-medium text-muted-foreground">
                <div className="px-4 py-2.5 w-24">Mã</div>
                <div className="px-4 py-2.5 flex-1 min-w-[360px]">Tài sản</div>
                <div className="px-4 py-2.5 w-[260px]">Thông tin tài sản</div>
                <div className="px-4 py-2.5 w-32">Tỉnh</div>
                <div className="px-4 py-2.5 w-32">Ngày đăng</div>
                <div className="px-4 py-2.5 w-20 text-center">% giảm</div>
                <div className="px-4 py-2.5 w-32">Trạng thái</div>
                <div className="px-4 py-2.5 w-24 text-right">Thao tác</div>
              </div>

              <div className="max-h-[500px] overflow-auto">
                {rawLoading ? (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </div>
                ) : rawRecords.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground">Chưa có dữ liệu</div>
                ) : (
                  rawRecords.map((record) => {
                    const r = record as {
                      _id?: string | number;
                      sourceId?: string | number;
                      name?: string;
                      type?: string | null;
                      organizer?: string | null;
                      province?: string | null;
                      publishedAt?: string | Date | null;
                      priceDropPercent?: number;
                      status?: string | null;
                    };

                    return (
                      <div key={String(r._id ?? r.sourceId ?? r.name ?? Math.random())} className="flex items-start border-b last:border-0 hover:bg-secondary/40">
                        <div className="px-4 py-3 w-24 font-mono text-xs">{r.sourceId}</div>
                        <div className="px-4 py-3 flex-1 min-w-[360px]">
                          <div className="font-medium leading-6 whitespace-normal break-words" title={r.name}>{r.name}</div>
                        </div>
                        <div className="px-4 py-3 w-[260px] text-xs text-muted-foreground">
                          <div className="space-y-1.5">
                            <div className="whitespace-normal break-words">
                              Phân loại: <span className="text-foreground/80">{r.type || "—"}</span>
                            </div>
                            <div className="whitespace-normal break-words">
                              Đơn vị: <span className="text-foreground/80">{r.organizer || "—"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="px-4 py-3 w-32 text-muted-foreground">{r.province || "—"}</div>
                        <div className="px-4 py-3 w-32 text-muted-foreground text-xs">{typeof r.publishedAt === "string" ? formatDate(r.publishedAt) : "—"}</div>
                        <div className="px-4 py-3 w-20 text-center num text-discount-deep font-medium">
                          {typeof r.priceDropPercent === "number" && r.priceDropPercent > 0 ? `−${r.priceDropPercent.toFixed(1)}%` : "—"}
                        </div>
                        <div className="px-4 py-3 w-32">{statusBadge(r.status || "ok")}</div>
                        <div className="px-4 py-3 w-24 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="missingPrice">
          <div className="space-y-4">
            {/* Batch crawl banner */}
            <div className="bg-card border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-sm">Cào lại hàng loạt tài sản thiếu giá</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Hệ thống hiện có <strong className="num text-discount-deep text-sm">{missingAuctions?.pagination?.total?.toLocaleString("vi-VN") || 0}</strong> tài sản bị thiếu giá khởi điểm.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => handleAction("Crawl thiếu giá", () => triggerRecrawlMissingPrice(0, "auction", 100))}
                  disabled={!!actionLoading}
                >
                  <RefreshCw className="h-4 w-4" />
                  Cào hàng loạt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-discount-deep border-discount-deep/20 hover:bg-discount-deep-soft"
                  onClick={() => handleAction("Dừng cào thiếu giá", () => triggerKillRecrawlMissingPrice())}
                  disabled={!!actionLoading}
                >
                  <XCircle className="h-4 w-4" />
                  Dừng cào
                </Button>
              </div>
            </div>

            {/* List and Table */}
            <div className="rounded-xl border bg-card overflow-x-auto">
              <div className="w-full min-w-[1200px] text-sm">
                <div className="hidden lg:flex items-center border-b bg-secondary/30 text-xs font-medium text-muted-foreground">
                  <div className="px-4 py-2.5 w-24">Mã</div>
                  <div className="px-4 py-2.5 flex-1 min-w-[360px]">Tài sản</div>
                  <div className="px-4 py-2.5 w-[260px]">Thông tin tài sản</div>
                  <div className="px-4 py-2.5 w-32">Tỉnh</div>
                  <div className="px-4 py-2.5 w-32">Ngày đăng</div>
                  <div className="px-4 py-2.5 w-32">Số lần thử</div>
                  <div className="px-4 py-2.5 w-32 text-right">Thao tác</div>
                </div>

                <div className="max-h-[500px] overflow-auto">
                  {missingLoading ? (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline" />
                    </div>
                  ) : missingRecords.length === 0 ? (
                    <div className="px-4 py-8 text-center text-muted-foreground">Không có tin nào thiếu giá</div>
                  ) : (
                    missingRecords.map((record) => {
                      const r = record as {
                        _id?: string | number;
                        sourceId: number;
                        name?: string;
                        type?: string | null;
                        organizer?: string | null;
                        province?: string | null;
                        publishedAt?: string | Date | null;
                        zeroPriceRetryCount?: number;
                      };

                      const isRecrawling = singleRecrawling[r.sourceId];

                      return (
                        <div key={String(r._id ?? r.sourceId)} className="flex items-start border-b last:border-0 hover:bg-secondary/40">
                          <div className="px-4 py-3 w-24 font-mono text-xs">
                            <a href={`/auction/${r.sourceId}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary font-medium">
                              {r.sourceId}
                            </a>
                          </div>
                          <div className="px-4 py-3 flex-1 min-w-[360px]">
                            <div className="font-medium leading-6 whitespace-normal break-words" title={r.name}>{r.name}</div>
                          </div>
                          <div className="px-4 py-3 w-[260px] text-xs text-muted-foreground">
                            <div className="space-y-1.5">
                              <div className="whitespace-normal break-words">
                                Phân loại: <span className="text-foreground/80">{r.type || "—"}</span>
                              </div>
                              <div className="whitespace-normal break-words">
                                Đơn vị: <span className="text-foreground/80">{r.organizer || "—"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="px-4 py-3 w-32 text-muted-foreground">{r.province || "—"}</div>
                          <div className="px-4 py-3 w-32 text-muted-foreground text-xs">{r.publishedAt ? formatDate(String(r.publishedAt)) : "—"}</div>
                          <div className="px-4 py-3 w-32 text-muted-foreground num font-medium">
                            {r.zeroPriceRetryCount || 0} / 2
                          </div>
                          <div className="px-4 py-3 w-32 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => handleSingleRecrawl(r.sourceId)}
                              disabled={isRecrawling}
                            >
                              {isRecrawling ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              <span>Cào lại</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Pagination Controls */}
            {missingAuctions?.pagination && missingAuctions.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border rounded-xl px-4 py-3 bg-card text-sm">
                <div className="text-muted-foreground text-xs sm:text-sm">
                  Hiển thị bản ghi <strong className="num text-foreground">{((missingPricePage - 1) * 50 + 1).toLocaleString("vi-VN")}</strong> -{" "}
                  <strong className="num text-foreground">{Math.min(missingPricePage * 50, missingAuctions.pagination.total).toLocaleString("vi-VN")}</strong> của{" "}
                  <strong className="num text-foreground">{missingAuctions.pagination.total.toLocaleString("vi-VN")}</strong> bản ghi
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={missingPricePage === 1}
                    onClick={() => setMissingPricePage(prev => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-xs font-medium px-2 py-1 bg-secondary rounded num">
                    Trang {missingPricePage} / {missingAuctions.pagination.totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={missingPricePage === missingAuctions.pagination.totalPages}
                    onClick={() => setMissingPricePage(prev => Math.min(missingAuctions.pagination.totalPages, prev + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
                    <div key={String(l._id || `${type}-${String(l.startedAt || i)}`)} className="flex items-start gap-2 sm:gap-3 px-3 sm:px-5 py-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                          <span className="font-mono">{startedAt ? startedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "?"}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.5">{crawlTypeLabel[type] || type}</span>
                          {statusBadge(status)}
                          {duration !== null && <span>{duration}s</span>}
                        </div>
                        <div className="text-xs sm:text-sm mt-0.5 leading-relaxed">
                          {type === "recrawl_missing_properties" || type === "mega_detail_crawl" ? (
                            <>
                              {l.itemsInserted !== undefined && <span>Đã quét: <strong className="num">{String(l.itemsInserted)}</strong></span>}
                              {l.itemsSkipped !== undefined && <span> · Đủ dữ liệu bỏ qua: <strong className="num">{String(l.itemsSkipped)}</strong></span>}
                              {l.itemsUpdated !== undefined && <span> · Đã recrawl: <strong className="num">{String(l.itemsUpdated)}</strong></span>}
                              {l.pagesProcessed !== undefined && l.totalPages !== undefined && <span> · Đang xử lý: <strong className="num">{String(l.pagesProcessed)}</strong>/<strong className="num">{String(l.totalPages)}</strong></span>}
                            </>
                          ) : (
                            <>
                              {l.itemsInserted !== undefined && <span>Mới: <strong className="num">{String(l.itemsInserted)}</strong></span>}
                              {l.itemsUpdated !== undefined && <span> · Cập nhật: <strong className="num">{String(l.itemsUpdated)}</strong></span>}
                              {l.itemsSkipped !== undefined && <span> · Bỏ qua: <strong className="num">{String(l.itemsSkipped)}</strong></span>}
                              {l.pagesProcessed !== undefined && <span> · Trang: <strong className="num">{String(l.pagesProcessed)}</strong></span>}
                            </>
                          )}
                        </div>
                        {Array.isArray(l.recentNotices) && l.recentNotices.length > 0 && (
                          <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-secondary/20 p-2">
                            <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">Notice đã lưu</div>
                            {(l.recentNotices as Array<Record<string, unknown>>).slice(0, 5).map((notice, noticeIndex) => (
                              <div key={`${String(notice.sourceId || noticeIndex)}-${noticeIndex}`} className="text-xs leading-relaxed text-foreground/90">
                                <span className="font-mono text-muted-foreground">#{String(notice.sourceId || "?")}</span>
                                <span className="mx-1.5">·</span>
                                <span>{String(notice.name || "Không có tên")}</span>
                                {notice.province ? <span className="text-muted-foreground"> ({String(notice.province)})</span> : null}
                              </div>
                            ))}
                          </div>
                        )}
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
