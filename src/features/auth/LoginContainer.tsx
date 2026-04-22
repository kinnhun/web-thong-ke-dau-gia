import Link from "next/link";
import { Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginContainer() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gavel className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold">AuctionWatch</div>
              <div className="text-xs text-muted-foreground">Thống kê đấu giá giảm sâu</div>
            </div>
          </Link>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Đăng nhập</h1>
            <p className="text-sm text-muted-foreground">Truy cập bộ lọc đã lưu và Thông Báo của bạn</p>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="ban@email.com" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mật khẩu</Label>
                <a href="#" className="text-xs text-muted-foreground hover:text-primary">Quên mật khẩu?</a>
              </div>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full">Đăng nhập</Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Chưa có tài khoản?{" "}
            <a href="#" className="text-primary font-medium hover:underline">Đăng ký miễn phí</a>
          </p>

          <Link href="/" className="block text-center text-xs text-muted-foreground hover:text-primary">
            ← Quay lại trang tổng quan
          </Link>
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center bg-secondary/40 p-12 border-l">
        <div className="max-w-md space-y-6">
          <div className="inline-flex rounded-md bg-discount-deep-soft px-2.5 py-1 text-xs font-medium text-discount-deep">
            ✦ Thống kê thời gian thực
          </div>
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Theo dõi tài sản đấu giá<br />giảm sâu mỗi ngày
          </h2>
          <p className="text-muted-foreground">
            AuctionWatch tổng hợp dữ liệu đấu giá công khai, nhận diện tài sản có lịch sử giảm giá và Thông Báo bạn ngay khi xuất hiện cơ hội phù hợp.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { v: "1.2K+", l: "Tài sản theo dõi" },
              { v: "47%", l: "Giảm sâu nhất" },
              { v: "63", l: "Tỉnh thành" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border bg-card p-3">
                <div className="text-xl font-semibold num">{s.v}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
