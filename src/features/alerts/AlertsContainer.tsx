import { useState } from "react";
import { Bell, Bookmark, Copy, Mail, MessageCircle, Pencil, Play, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { assetTypeLabel, provincesList } from "@/data/mockAuctions";

const savedFilters = [
  { name: "Đất Đồng Nai giảm >20%", condition: "Loại: Đất · Tỉnh: Đồng Nai · Giảm ≥ 20%", created: "2 ngày trước", matches: 12, status: "active" },
  { name: "Ô tô dưới 1 tỷ", condition: "Loại: Ô tô · Giá ≤ 1 tỷ", created: "1 tuần trước", matches: 8, status: "active" },
  { name: "Tài sản thi hành án giảm sâu", condition: "Loại: THA · Giảm ≥ 30%", created: "3 tuần trước", matches: 5, status: "paused" },
];

const alerts = [
  { name: "Đất Đồng Nai giảm sâu", condition: "Đất, Đồng Nai, giảm ≥ 20%", channel: ["email", "web"], lastSent: "Hôm qua, 14:30", on: true },
  { name: "Ô tô giá < 600 triệu", condition: "Ô tô, giá ≤ 600 triệu, giảm ≥ 15%", channel: ["telegram"], lastSent: "3 ngày trước", on: true },
  { name: "Nhà phố Hà Nội", condition: "Nhà ở, Hà Nội, giảm ≥ 10%, ≥ 2 lần ĐG", channel: ["email"], lastSent: "Chưa gửi", on: false },
];

const channelIcon = { email: Mail, web: Bell, telegram: Send } as const;
const channelLabel = { email: "Email", web: "Web", telegram: "Telegram" } as const;

export function AlertsContainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="container mx-auto max-w-[1200px] px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-watch-badge" />
            Thông Báo & bộ lọc đã lưu
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Tự động theo dõi và nhận thông báo khi có tài sản phù hợp</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />Tạo Thông Báo</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Tạo Thông Báo mới</DialogTitle>
              <DialogDescription>Nhận thông báo khi có tài sản khớp điều kiện bạn đặt ra.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label>Tên Thông Báo</Label><Input placeholder="VD: Đất Long Thành giảm sâu" /></div>
              <div className="space-y-1.5"><Label>Từ khóa</Label><Input placeholder="VD: long thành, biên hòa" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Loại tài sản</Label>
                  <Select defaultValue="all"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả</SelectItem>{Object.entries(assetTypeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tỉnh / thành</Label>
                  <Select defaultValue="all"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả</SelectItem>{provincesList.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Giá từ (tỷ)</Label><Input type="number" placeholder="0" /></div>
                <div className="space-y-1.5"><Label>Giá đến (tỷ)</Label><Input type="number" placeholder="∞" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>% giảm tối thiểu</Label><Input type="number" placeholder="20" /></div>
                <div className="space-y-1.5"><Label>Số lần ĐG tối thiểu</Label><Input type="number" placeholder="2" /></div>
              </div>
              <div className="space-y-2">
                <Label>Kênh nhận</Label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> Email</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox /> Telegram</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> Thông báo web</label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
              <Button onClick={() => setOpen(false)}>Lưu Thông Báo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts"><Bell className="h-3.5 w-3.5" />Thông Báo của tôi</TabsTrigger>
          <TabsTrigger value="filters"><Bookmark className="h-3.5 w-3.5" />Bộ lọc đã lưu</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-3">
          {alerts.map((a) => (
            <div key={a.name} className="rounded-xl border bg-card p-4 flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.on ? "bg-watch-badge-soft text-watch-badge" : "bg-secondary text-muted-foreground"}`}>
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.condition}</div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Gửi gần nhất: {a.lastSent}</span><span>·</span>
                  <div className="flex items-center gap-1.5">
                    {a.channel.map((c) => {
                      const Icon = channelIcon[c as keyof typeof channelIcon];
                      return (
                        <span key={c} className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5">
                          <Icon className="h-3 w-3" />{channelLabel[c as keyof typeof channelLabel]}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch defaultChecked={a.on} />
                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="filters" className="space-y-3">
          {savedFilters.map((f) => (
            <div key={f.name} className="rounded-xl border bg-card p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><Bookmark className="h-5 w-5 text-muted-foreground" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{f.condition}</div>
                <div className="text-xs text-muted-foreground mt-1">Tạo {f.created} · <span className="text-foreground font-medium num">{f.matches}</span> tài sản đang khớp</div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm"><Play className="h-3.5 w-3.5" />Chạy</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
