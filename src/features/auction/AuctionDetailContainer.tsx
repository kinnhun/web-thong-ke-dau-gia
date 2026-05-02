import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Building2,
  Calendar,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Printer,
  RefreshCw,
  Share2,
  Star,
  TrendingDown,
  User,
  Wallet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DiscountBadge } from "@/components/auction/DiscountBadge";
import { StatusBadge } from "@/components/auction/StatusBadge";
import { AssetTypeIcon } from "@/components/auction/AssetTypeIcon";
import { useAuctionDetail, assetTypeLabel } from "@/domains/auction";
import { formatDate, formatVND } from "@/lib/format";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/domains/watchlist/watchlist.hooks";
import { triggerRecrawlItem } from "@/services/auction.service";

interface AuctionDetailContainerProps {
  id: string;
}

export function AuctionDetailContainer({ id }: AuctionDetailContainerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: auction, isLoading, error } = useAuctionDetail(id);
  const { toggleWatch, isWatched } = useWatchlist();
  const [recrawling, setRecrawling] = useState(false);

  const watched = auction ? isWatched(auction.sourceId) : false;

  const handleRecrawl = async () => {
    if (!auction) return;
    setRecrawling(true);
    try {
      await triggerRecrawlItem(auction.sourceId, 'auction');
      await queryClient.invalidateQueries({ queryKey: ['auction', 'detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['auction', 'duplicates'] });
    } catch { /* ignore */ }
    setRecrawling(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Đang tải dữ liệu...
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="container mx-auto max-w-[1300px] px-6 py-16 text-center">
        <p className="text-muted-foreground mb-4">Không tìm thấy tài sản hoặc lỗi kết nối.</p>
        <Button variant="outline" asChild><Link href="/discounts"><ArrowLeft className="h-4 w-4" />Quay lại</Link></Button>
      </div>
    );
  }

  const pct = auction.initialPrice > 0
    ? ((auction.initialPrice - auction.currentPrice) / auction.initialPrice) * 100
    : 0;
  const amt = auction.initialPrice - auction.currentPrice;

  // Duplicate group info
  const dup = auction.duplicateGroup;
  const dupPct = dup?.priceDropPercent ?? pct;
  const dupAmt = dup ? dup.firstPrice - dup.latestPrice : amt;
  const displayFirstPrice = dup?.firstPrice ?? auction.initialPrice;
  const displayCurrentPrice = dup?.latestPrice ?? auction.currentPrice;
  const rounds = dup?.relistCount ?? auction.publishRound ?? 1;

  const entries = dup?.entries ?? [];
  const biggestStep = entries.reduce((max, h, i, arr) => {
    if (i === 0 || !arr[i - 1].price || !h.price) return max;
    const drop = ((arr[i - 1].price - h.price) / arr[i - 1].price) * 100;
    return drop > max ? drop : max;
  }, 0);

  const firstDate = entries.length > 0 ? entries[0].publishedAt : auction.publishedAt;
  const daysSinceFirst = firstDate
    ? Math.floor((Date.now() - +new Date(firstDate)) / (1000 * 60 * 60 * 24))
    : 0;

  const InfoRow = ({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto max-w-[1300px] px-3 sm:px-6 py-5 sm:py-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/discounts"><ArrowLeft className="h-4 w-4" />Quay lại danh sách</Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
              <AssetTypeIcon type={auction.type} className="h-3 w-3" />
              {assetTypeLabel[auction.type] || auction.type}
            </span>
            <StatusBadge status={auction.status} />
            {dupPct >= 25 && (
              <span className="inline-flex items-center rounded-md bg-discount-deep-soft px-2 py-0.5 text-xs font-medium text-discount-deep">
                Giảm sâu
              </span>
            )}
            {dup && dup.relistCount >= 3 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-watch-badge-soft px-2 py-0.5 text-xs font-medium text-watch-badge">
                <AlertTriangle className="h-3 w-3" />Đăng lại {dup.relistCount} lần
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">{auction.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{auction.shortDescription}</p>
          <p className="text-xs text-muted-foreground mt-2 num">Source ID: {auction.sourceId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={watched ? "default" : "outline"} 
            size="sm"
            onClick={() => toggleWatch({
              id: auction.sourceId,
              name: auction.name,
              type: auction.type,
              relistCount: dup?.relistCount || 1,
              firstPrice: dup?.firstPrice || auction.initialPrice,
              latestPrice: dup?.latestPrice || auction.currentPrice,
              priceDropPercent: dup?.priceDropPercent || 0,
              publishedAt: auction.publishedAt,
              url: `/auction/${auction.sourceId}`
            })}
          >
            <Star className={cn("h-4 w-4", watched && "fill-current text-yellow-400")} />
            {watched ? "Đã theo dõi" : "Theo dõi"}
          </Button>
          <Button variant="outline" size="sm"><Bell className="h-4 w-4" />Thông Báo</Button>
          <Button variant="outline" size="sm"><Share2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm"><Printer className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleRecrawl} disabled={recrawling}>
            {recrawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {recrawling ? "Đang cào..." : "Cào lại"}
          </Button>
          {auction.sourceUrl && (
            <Button size="sm" asChild>
              <a href={auction.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />Mở tin gốc
              </a>
            </Button>
          )}
        </div>
      </div>

        <>
          <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 mb-4 sm:mb-6">
            <div className="rounded-xl border bg-card p-3 sm:p-5">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium">Giá lần đầu</p>
              <p className="text-base sm:text-xl font-semibold num mt-1 sm:mt-1.5 text-muted-foreground line-through">{formatVND(displayFirstPrice)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 sm:p-5">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium">Giá hiện tại</p>
              <p className="text-base sm:text-xl font-semibold num mt-1 sm:mt-1.5">{formatVND(displayCurrentPrice)}</p>
            </div>
            <div className="rounded-xl border bg-discount-deep-soft p-3 sm:p-5">
              <p className="text-[10px] sm:text-xs text-discount-deep uppercase tracking-wide font-medium">Mức giảm tuyệt đối</p>
              <p className="text-base sm:text-xl font-semibold num mt-1 sm:mt-1.5 text-discount-deep">−{formatVND(dupAmt)}</p>
            </div>
            <div className="rounded-xl border bg-discount-deep-soft p-3 sm:p-5">
              <p className="text-[10px] sm:text-xs text-discount-deep uppercase tracking-wide font-medium">Tỷ lệ giảm</p>
              <p className="text-base sm:text-xl font-semibold num mt-1 sm:mt-1.5 text-discount-deep">−{dupPct.toFixed(1)}%</p>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 mb-4 sm:mb-6">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Số lần đăng</p><History className="h-4 w-4 text-muted-foreground" /></div>
              <p className="text-lg font-semibold num mt-1">{rounds} lần</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Khoảng thời gian theo dõi</p><Calendar className="h-4 w-4 text-muted-foreground" /></div>
              <p className="text-lg font-semibold num mt-1">{daysSinceFirst} ngày</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Mức giảm lớn nhất giữa 2 lần</p><TrendingDown className="h-4 w-4 text-discount-deep" /></div>
              <p className="text-lg font-semibold num mt-1 text-discount-deep">−{biggestStep.toFixed(1)}%</p>
            </div>
          </section>
        </>

      {/* Two column */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="font-semibold mb-4">Thông tin tài sản</h2>
          <InfoRow icon={MapPin} label="Địa chỉ tài sản" value={auction.address || "—"} />
          <InfoRow icon={User} label="Người có tài sản" value={auction.owner || "—"} />
          <InfoRow icon={Building2} label="Tổ chức đấu giá" value={auction.organizer || "—"} />
          <InfoRow 
            icon={Wallet} 
            label="Tiền đặt trước" 
            value={
              <span className="num">
                {auction.depositPercent 
                  ? auction.depositPercent
                  : formatVND(auction.deposit || 0)}
              </span>
            } 
          />
          <InfoRow icon={Wallet} label="Phí hồ sơ" value={<span className="num">{formatVND(auction.applicationFee || 0)}</span>} />
          <InfoRow icon={Calendar} label="Thời gian công khai" value={auction.publishedAt ? formatDate(auction.publishedAt) : "—"} />
          <InfoRow icon={Calendar} label="Hạn đăng ký" value={auction.registrationEnd ? formatDate(auction.registrationEnd) : "—"} />
          <InfoRow icon={Calendar} label="Ngày tổ chức đấu giá" value={auction.auctionDate ? formatDate(auction.auctionDate) : "—"} />

          {/* Bảng tài sản đấu giá — luôn hiển thị */}
          <Separator className="my-5" />
          <h3 className="font-medium mb-3 text-sm">Thông tin việc đấu giá · Danh mục tài sản</h3>
          {(() => {
            const rows = auction.properties && auction.properties.length > 0
              ? auction.properties
              : [{
                  name: auction.name || auction.shortDescription || '',
                  amount: auction.propertyAmount || '01',
                  startPrice: auction.initialPrice || 0,
                  deposit: auction.deposit || 0,
                  depositPercent: auction.depositPercent,
                  place: auction.address || '',
                  quality: '',
                }];
            return (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="px-3 py-2.5 text-center font-medium text-xs w-12 border-r">STT</th>
                      <th className="px-3 py-2.5 text-left font-medium text-xs min-w-[200px] border-r">Tên tài sản</th>
                      <th className="px-3 py-2.5 text-center font-medium text-xs w-20 border-r">Số lượng</th>
                      <th className="px-3 py-2.5 text-left font-medium text-xs min-w-[120px] border-r">Nơi có tài sản</th>
                      <th className="px-3 py-2.5 text-right font-medium text-xs w-36 border-r">Giá khởi điểm</th>
                      <th className="px-3 py-2.5 text-right font-medium text-xs w-32">Tiền đặt trước</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p, i) => (
                      <tr key={i} className="border-t hover:bg-secondary/20">
                        <td className="px-3 py-2.5 text-center text-muted-foreground num border-r">{i + 1}</td>
                        <td className="px-3 py-2.5 border-r">
                          <div className="leading-relaxed">{p.name || "—"}</div>
                          {p.quality && <div className="text-xs text-muted-foreground mt-0.5">Chất lượng: {p.quality}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-center num border-r">{p.amount || "01"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs border-r">{p.place || "—"}</td>
                        <td className="px-3 py-2.5 text-right num font-medium border-r">{p.startPrice ? formatVND(p.startPrice) : "—"}</td>
                        <td className="px-3 py-2.5 text-right num">{p.depositPercent || (p.deposit ? formatVND(p.deposit) : "—")}</td>
                      </tr>
                    ))}
                    {rows.length > 1 && (
                      <tr className="border-t bg-secondary/30 font-medium">
                        <td colSpan={4} className="px-3 py-2.5 text-right text-xs">Tổng cộng</td>
                        <td className="px-3 py-2.5 text-right num border-r">{formatVND(rows.reduce((s, p) => s + (p.startPrice || 0), 0))}</td>
                        <td className="px-3 py-2.5 text-right num">
                          {rows.every(p => p.depositPercent) 
                            ? rows.map(p => p.depositPercent).join(' + ') 
                            : formatVND(rows.reduce((s, p) => s + (p.deposit || 0), 0))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Lịch sử giá</h3>
                {dup && (
                  <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs">
                    <Link href={`/relisted`}>Xem tất cả</Link>
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {entries.length > 0 ? (
                  entries.slice().reverse().map((h, i) => {
                    const isCurrent = h.sourceId === auction.sourceId;
                    return (
                      <div key={i} className={`flex items-center justify-between text-xs p-2 rounded transition-colors ${isCurrent ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary/40'}`}>
                        {isCurrent ? (
                          <div className="flex-1">
                            <div className="font-medium text-primary flex items-center gap-1">
                              {h.publishRoundLabel || `Lần ${h.publishRound || entries.length - i}`}
                              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1">Đang xem</span>
                            </div>
                            <div className="text-muted-foreground">{h.publishedAt ? formatDate(h.publishedAt) : "—"}</div>
                          </div>
                        ) : (
                          <Link href={`/auction/${h.sourceId}`} className="flex-1 group">
                            <div className="font-medium group-hover:text-primary transition-colors flex items-center gap-1">
                              {h.publishRoundLabel || `Lần ${h.publishRound || entries.length - i}`}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-muted-foreground">{h.publishedAt ? formatDate(h.publishedAt) : "—"}</div>
                          </Link>
                        )}
                        <div className={`font-semibold num text-right ${isCurrent ? 'text-primary' : ''}`}>{h.price ? formatVND(h.price) : "—"}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium">Lần 1</div>
                      <div className="text-muted-foreground">{auction.publishedAt ? formatDate(auction.publishedAt) : "—"}</div>
                    </div>
                    <div className="font-semibold num">{formatVND(auction.initialPrice)}</div>
                  </div>
                )}
              </div>
            </div>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold text-sm mb-2">Đánh giá nhanh</h3>
            <div className="flex items-center gap-2">
              <DiscountBadge percent={dupPct} size="lg" />
              <span className="text-sm text-muted-foreground">
                {dupPct >= 30 ? "Cơ hội đáng cân nhắc" : dupPct >= 15 ? "Đáng theo dõi" : dupPct > 0 ? "Mới giảm nhẹ" : "Chưa giảm giá"}
              </span>
            </div>
          </div>

          {/* Files */}
          {auction.files && auction.files.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold text-sm mb-3">Tài liệu đính kèm</h3>
              <div className="space-y-1.5">
                {auction.files.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="line-clamp-1">{f.name || f.url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <button className="w-full rounded-xl border border-dashed bg-card p-4 text-xs text-muted-foreground hover:bg-secondary/40 cursor-pointer">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            Báo sai dữ liệu
          </button>
        </aside>
      </div>
    </div>
  );
}
