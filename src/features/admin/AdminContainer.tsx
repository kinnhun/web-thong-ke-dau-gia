import {
  AlertCircle, CheckCircle2, Database, Download, Eye, GitMerge, Pencil, RefreshCw, Split, Wand2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auctions } from "@/data/mockAuctions";
import { formatDate } from "@/lib/format";

const rawRecords = auctions.slice(0, 8).map((a, i) => ({
  id: `RAW-${1000 + i}`, name: a.name, price: a.currentPrice, province: a.province,
  crawledAt: a.publishedAt, source: "moj.gov.vn", status: i % 4 === 0 ? "error" : i % 3 === 0 ? "pending" : "ok",
}));

const groups = auctions.slice(0, 6).map((a, i) => ({
  groupId: a.groupId, name: a.name, count: a.history.length, confidence: 95 - i * 6,
  status: i % 3 === 0 ? "pending" : "approved",
}));

const logs = [
  { time: "10:42", module: "crawler", message: "Timeout khi gọi danh sách tỉnh Đồng Nai trang 12", level: "error", handled: false },
  { time: "10:35", module: "matcher", message: "Phát hiện 3 cặp nghi ngờ trùng cần duyệt thủ công", level: "warning", handled: false },
  { time: "09:58", module: "crawler", message: "Hoàn tất đồng bộ 247 tin mới", level: "info", handled: true },
  { time: "09:30", module: "stats", message: "Tính lại thống kê thành công", level: "info", handled: true },
  { time: "08:15", module: "normalizer", message: "Lỗi parse giá: ký tự đặc biệt trong tin RAW-1042", level: "error", handled: true },
];

const statusBadge = (s: string) => {
  const map: Record<string, string> = { ok: "bg-new-badge-soft text-new-badge", pending: "bg-watch-badge-soft text-watch-badge", error: "bg-discount-deep-soft text-discount-deep", approved: "bg-new-badge-soft text-new-badge" };
  const label: Record<string, string> = { ok: "Đã xử lý", pending: "Chờ duyệt", error: "Lỗi", approved: "Đã duyệt" };
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${map[s]}`}>{label[s]}</span>;
};

const levelIcon = { error: XCircle, warning: AlertCircle, info: CheckCircle2 } as const;
const levelColor = { error: "text-destructive", warning: "text-watch-badge", info: "text-new-badge" } as const;

export function AdminContainer() {
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

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        {[
          { icon: RefreshCw, title: "Crawl ngay", desc: "Thu thập tin mới" },
          { icon: Database, title: "Đồng bộ dữ liệu", desc: "Sync từ nguồn" },
          { icon: Wand2, title: "Chuẩn hóa", desc: "Làm sạch dữ liệu" },
          { icon: GitMerge, title: "Tính lại thống kê", desc: "Recalc KPI" },
          { icon: Eye, title: "Tạo lại chỉ mục", desc: "Search index" },
        ].map((item) => (
          <button key={item.title} className="rounded-xl border bg-card p-3 sm:p-4 text-left hover:border-foreground/20 transition-colors cursor-pointer">
            <item.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary mb-2" />
            <div className="font-medium text-[13px] sm:text-sm">{item.title}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{item.desc}</div>
          </button>
        ))}
      </section>

      <Tabs defaultValue="raw" className="space-y-4">
        <TabsList>
          <TabsTrigger value="raw">Dữ liệu thô</TabsTrigger>
          <TabsTrigger value="groups">Ghép tài sản</TabsTrigger>
          <TabsTrigger value="logs">Nhật ký lỗi</TabsTrigger>
        </TabsList>

        <TabsContent value="raw">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="text-xs text-muted-foreground border-b bg-secondary/30">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">ID nguồn</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tên tài sản</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tỉnh</th>
                  <th className="px-4 py-2.5 text-left font-medium">Ngày crawl</th>
                  <th className="px-4 py-2.5 text-left font-medium">Nguồn</th>
                  <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
                  <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rawRecords.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-3 line-clamp-1 max-w-md">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.province}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.crawledAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.source}</td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="groups">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="text-xs text-muted-foreground border-b bg-secondary/30">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Group ID</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tên chuẩn hóa</th>
                  <th className="px-4 py-2.5 text-center font-medium">Số bản ghi</th>
                  <th className="px-4 py-2.5 text-center font-medium">Độ tin cậy</th>
                  <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
                  <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.groupId} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{g.groupId}</td>
                    <td className="px-4 py-3 line-clamp-1 max-w-md">{g.name}</td>
                    <td className="px-4 py-3 text-center num">{g.count}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium num ${g.confidence >= 80 ? "bg-new-badge-soft text-new-badge" : "bg-watch-badge-soft text-watch-badge"}`}>
                        {g.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(g.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><GitMerge className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Split className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-3 sm:px-5 py-3">
              <h3 className="font-semibold text-sm">Nhật ký gần đây</h3>
              <Button variant="outline" size="sm" className="text-xs h-7 sm:h-9"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Xuất log</span></Button>
            </div>
            <div className="divide-y">
              {logs.map((l, i) => {
                const Icon = levelIcon[l.level as keyof typeof levelIcon];
                return (
                  <div key={i} className="flex items-start gap-2 sm:gap-3 px-3 sm:px-5 py-3">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${levelColor[l.level as keyof typeof levelColor]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                        <span className="font-mono">{l.time}</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5">{l.module}</span>
                        {l.handled && <span className="text-new-badge">đã xử lý</span>}
                      </div>
                      <div className="text-xs sm:text-sm mt-0.5 leading-relaxed">{l.message}</div>
                    </div>
                    {!l.handled && <Button variant="outline" size="sm" className="text-xs h-7 sm:h-9 shrink-0">Đánh dấu</Button>}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
