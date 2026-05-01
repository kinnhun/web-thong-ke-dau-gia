import { RefreshCw, Rocket, Database, FileCheck2, AlertTriangle, Activity, PlayCircle } from 'lucide-react';
import { useTmpFullCrawl } from './hooks/useTmpFullCrawl';

function formatNumber(value?: number) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function formatSpeed(value?: number) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value || 0)} bài/s`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

export function TmpFullCrawlContainer() {
  const { status, isLoading, isStarting, isContinuing, error, notice, refresh, start, continueCrawl } = useTmpFullCrawl();
  const log = status?.latestLog;
  const nextPage = Math.max((log?.pagesProcessed || 0) + 1, 1);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#172554_0,#020617_38%,#030712_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-white/10 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                <Activity className="h-4 w-4" /> Luồng riêng: mass-crawl / 547k records
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Theo dõi cào đủ 547.632 dữ liệu
              </h1>
              <p className="mt-3 max-w-3xl text-base text-slate-300">
                Trang này hiển thị riêng tiến độ luồng crawler PM2 đang quét toàn bộ danh sách đấu giá, không phụ thuộc thao tác admin thông thường.
              </p>
              <p className="mt-3 text-sm font-semibold text-cyan-100/90">
                Điểm tiếp tục đề xuất: trang {formatNumber(nextPage)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                id="tmp-refresh-crawl-status"
                onClick={() => void refresh()}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/20"
                type="button"
              >
                <RefreshCw className="h-4 w-4" /> Làm mới
              </button>
              <button
                id="tmp-continue-full-crawl"
                onClick={() => void continueCrawl()}
                disabled={isContinuing}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-400/15 px-5 py-3 font-black text-emerald-50 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                <PlayCircle className="h-4 w-4" /> {isContinuing ? 'Đang tiếp tục...' : 'Tiếp tục từ trang kế'}
              </button>
              <button
                id="tmp-start-full-crawl"
                onClick={() => void start()}
                disabled={isStarting}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                <Rocket className="h-4 w-4" /> {isStarting ? 'Đang bật...' : 'Bật full crawl riêng'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-rose-100">
            <AlertTriangle className="mr-2 inline h-5 w-5" /> {error}
          </div>
        )}
        {notice && <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-emerald-100">{notice}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Database />} label="Đã lưu MongoDB" value={formatNumber(status?.totalSaved)} hint={`/ ${formatNumber(status?.target || 547632)} bản ghi`} />
          <Metric icon={<Rocket />} label="Tốc độ hiện tại" value={formatSpeed(status?.speedPerSecond)} hint={`Mới: ${formatSpeed(status?.insertPerSecond)} · ${formatNumber(status?.workerCount)} worker`} />
          <Metric icon={<FileCheck2 />} label="Detail đã đủ" value={formatNumber(status?.detailDone)} hint={`${formatNumber(status?.detailPending)} còn chờ detail`} />
          <Metric icon={<Activity />} label="Trang đã quét" value={`${formatNumber(log?.pagesProcessed)} / ${formatNumber(log?.totalPages || 27382)}`} hint={`${status?.pagePercent || 0}% số trang`} />
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
            <span>Tiến độ tổng theo số bản ghi đã lưu</span>
            <span>{status?.progressPercent || 0}%</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-slate-950/70">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400 transition-all duration-700" style={{ width: `${status?.progressPercent || 0}%` }} />
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-cyan-300/20 bg-slate-950/50 p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Chi tiết lượt crawl hiện tại</div>
                <div className="mt-1 text-sm text-slate-400">Số liệu lấy trực tiếp từ CrawlLog của tiến trình mass-crawl.</div>
              </div>
              <div className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-black text-emerald-100">
                Mới: {formatNumber(log?.itemsInserted)} · Cập nhật: {formatNumber(log?.itemsUpdated)} · Bỏ qua: {formatNumber(log?.itemsSkipped)} · Trang: {formatNumber(log?.pagesProcessed)} · Tốc độ: {formatSpeed(status?.speedPerSecond)}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailStat label="Mới" value={formatNumber(log?.itemsInserted)} tone="from-emerald-400/25 to-cyan-400/10" />
              <DetailStat label="Cập nhật" value={formatNumber(log?.itemsUpdated)} tone="from-sky-400/25 to-blue-400/10" />
              <DetailStat label="Bỏ qua" value={formatNumber(log?.itemsSkipped)} tone="from-amber-400/25 to-orange-400/10" />
              <DetailStat label="Tốc độ" value={formatSpeed(status?.speedPerSecond)} tone="from-lime-400/25 to-emerald-400/10" />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Info label="Trạng thái log" value={isLoading ? 'Đang tải...' : log?.status || 'Chưa có log'} />
            <Info label="Worker đang chạy" value={formatNumber(status?.workerCount || log?.workerCount || 0)} />
            <Info label="Đã xử lý / thời gian" value={`${formatNumber(status?.processedItems)} bài / ${formatNumber(status?.elapsedSeconds)}s`} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <h2 className="mb-4 text-xl font-black">Bản ghi mới gần nhất</h2>
            <div className="space-y-3">
              {(log?.recentNotices || []).length === 0 && <p className="text-slate-400">Chưa có dữ liệu recent.</p>}
              {(log?.recentNotices || []).map((item) => (
                <div key={`${item.sourceId}-${item.name}`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="font-bold text-cyan-100">#{item.sourceId} — {item.name || 'Không tên'}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.province || 'Chưa rõ tỉnh'} · {formatDate(item.publishedAt || undefined)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
            <h2 className="mb-4 text-xl font-black">Lỗi gần nhất</h2>
            <div className="space-y-3">
              {(log?.errorMessages || []).length === 0 && <p className="text-slate-400">Chưa ghi nhận lỗi.</p>}
              {(log?.errorMessages || []).map((message, index) => (
                <div key={`${message}-${index}`} className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-amber-100">
                  {message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/15">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-200">{icon}</div>
      <div className="text-sm font-semibold text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{hint}</div>
    </div>
  );
}

function DetailStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${tone} p-4 shadow-lg shadow-slate-950/20`}>
      <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 font-bold text-slate-100">{value}</div>
    </div>
  );
}
