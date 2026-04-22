import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Building2,
  Calendar,
  ExternalLink,
  History,
  MapPin,
  Printer,
  Share2,
  Star,
  TrendingDown,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DiscountBadge } from "@/components/auction/DiscountBadge";
import { StatusBadge } from "@/components/auction/StatusBadge";
import { AssetTypeIcon } from "@/components/auction/AssetTypeIcon";
import {
  assetTypeLabel,
  auctions,
  getDiscountAmount,
  getDiscountPercent,
} from "@/data/mockAuctions";
import { formatDate, formatVND } from "@/lib/format";

interface AuctionDetailContainerProps {
  id: string;
}

export function AuctionDetailContainer({ id }: AuctionDetailContainerProps) {
  const auction = auctions.find((a) => a.id === id) ?? auctions[0];

  const pct = getDiscountPercent(auction);
  const amt = getDiscountAmount(auction);

  const biggestStep = auction.history.reduce((max, h, i, arr) => {
    if (i === 0) return max;
    const drop = ((arr[i - 1].startingPrice - h.startingPrice) / arr[i - 1].startingPrice) * 100;
    return drop > max ? drop : max;
  }, 0);

  const daysSinceFirst = Math.floor(
    (Date.now() - +new Date(auction.history[0].publishedAt)) / (1000 * 60 * 60 * 24)
  );

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
              {assetTypeLabel[auction.type]}
            </span>
            <StatusBadge status={auction.status} />
            {pct >= 25 && (
              <span className="inline-flex items-center rounded-md bg-discount-deep-soft px-2 py-0.5 text-xs font-medium text-discount-deep">
                Giảm sâu
              </span>
            )}
            {auction.isDuplicateSuspect && (
              <span className="inline-flex items-center gap-1 rounded-md bg-watch-badge-soft px-2 py-0.5 text-xs font-medium text-watch-badge">
                <AlertTriangle className="h-3 w-3" />Nghi ngờ trùng
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">{auction.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{auction.shortDescription}</p>
          <p className="text-xs text-muted-foreground mt-2 num">Mã nhóm: {auction.groupId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm"><Star className="h-4 w-4" />Theo dõi</Button>
          <Button variant="outline" size="sm"><Bell className="h-4 w-4" />Thông Báo</Button>
          <Button variant="outline" size="sm"><Share2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm"><Printer className="h-4 w-4" /></Button>
          <Button size="sm" asChild>
            <a href={auction.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />Mở tin gốc
            </a>
          </Button>
        </div>
      </div>

      {/* Price analysis */}
      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 mb-4 sm:mb-6">
        <div className="rounded-xl border bg-card p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium">Giá lần đầu</p>
          <p className="text-base sm:text-xl font-semibold num mt-1 sm:mt-1.5 text-muted-foreground line-through">{formatVND(auction.initialPrice)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium">Giá hiện tại</p>
          <p className="text-base sm:text-xl font-semibold num mt-1 sm:mt-1.5">{formatVND(auction.currentPrice)}</p>
        </div>
        <div className="rounded-xl border bg-discount-deep-soft p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs text-discount-deep uppercase tracking-wide font-medium">Mức giảm tuyệt đối</p>
          <p className="text-base sm:text-xl font-semibold num mt-1 sm:mt-1.5 text-discount-deep">−{formatVND(amt)}</p>
        </div>
        <div className="rounded-xl border bg-discount-deep-soft p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs text-discount-deep uppercase tracking-wide font-medium">Tỷ lệ giảm</p>
          <p className="text-base sm:text-xl font-semibold num mt-1 sm:mt-1.5 text-discount-deep">−{pct.toFixed(1)}%</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 mb-4 sm:mb-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Số lần đấu giá</p><History className="h-4 w-4 text-muted-foreground" /></div>
          <p className="text-lg font-semibold num mt-1">{auction.rounds} lần</p>
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

      {/* Two column */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="font-semibold mb-4">Thông tin tài sản</h2>
          <InfoRow icon={MapPin} label="Địa chỉ tài sản" value={auction.address} />
          <InfoRow icon={User} label="Người có tài sản" value={auction.owner} />
          <InfoRow icon={Building2} label="Tổ chức đấu giá" value={auction.organizer} />
          <InfoRow icon={Wallet} label="Tiền đặt cọc" value={<span className="num">{formatVND(auction.deposit)}</span>} />
          <InfoRow icon={Wallet} label="Phí hồ sơ" value={<span className="num">{formatVND(auction.applicationFee)}</span>} />
          <InfoRow icon={Calendar} label="Thời gian công khai" value={formatDate(auction.publishedAt)} />
          <InfoRow icon={Calendar} label="Hạn nhận hồ sơ" value={formatDate(auction.applicationDeadline)} />
          <InfoRow icon={Calendar} label="Ngày tổ chức đấu giá" value={formatDate(auction.auctionDate)} />
          <Separator className="my-5" />
          <h3 className="font-medium mb-2 text-sm">Mô tả chi tiết</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{auction.quality}. {auction.shortDescription}.</p>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Lịch sử giá</h3>
              <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs">
                <Link href={`/auction/${auction.id}/history`}>Xem chi tiết</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {auction.history.slice().reverse().map((h) => (
                <div key={h.round} className="flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium">Lần {h.round}</div>
                    <div className="text-muted-foreground">{formatDate(h.publishedAt)}</div>
                  </div>
                  <div className="font-semibold num">{formatVND(h.startingPrice)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold text-sm mb-2">Đánh giá nhanh</h3>
            <div className="flex items-center gap-2">
              <DiscountBadge percent={pct} size="lg" />
              <span className="text-sm text-muted-foreground">
                {pct >= 30 ? "Cơ hội đáng cân nhắc" : pct >= 15 ? "Đáng theo dõi" : "Mới giảm nhẹ"}
              </span>
            </div>
          </div>

          <button className="w-full rounded-xl border border-dashed bg-card p-4 text-xs text-muted-foreground hover:bg-secondary/40 cursor-pointer">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            Báo sai dữ liệu
          </button>
        </aside>
      </div>
    </div>
  );
}
