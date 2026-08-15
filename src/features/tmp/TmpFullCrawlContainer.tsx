import React, { useEffect, useState } from 'react';
import { Button, Card, Progress, Tag, Typography, notification } from 'antd';
import { Play, RotateCw, CheckCircle2, AlertCircle, Database, Zap, Activity } from 'lucide-react';
import {
  getTmpFullCrawlStatus,
  startTmpFullCrawl,
  continueTmpFullCrawl,
  TmpFullCrawlStatus,
} from '@/services/tmp-full-crawl.service';

const { Title, Text } = Typography;

export function TmpFullCrawlContainer() {
  const [status, setStatus] = useState<TmpFullCrawlStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await getTmpFullCrawlStatus();
      setStatus(data);
    } catch (err: any) {
      // Ignore network error on polling if service isn't active
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await startTmpFullCrawl();
      notification.success({ message: res.message || 'Bắt đầu crawl thành công' });
      fetchStatus();
    } catch (err: any) {
      notification.error({ message: err.message || 'Không thể bắt đầu crawl' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleContinue = async () => {
    setActionLoading(true);
    try {
      const res = await continueTmpFullCrawl();
      notification.success({ message: res.message || 'Tiếp tục crawl thành công' });
      fetchStatus();
    } catch (err: any) {
      notification.error({ message: err.message || 'Không thể tiếp tục crawl' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero Banner */}
      <div className="bg-white/60 backdrop-blur-xl border border-neutral-200/80 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-medium mb-3">
              <Zap className="w-3.5 h-3.5" /> Dịch vụ Crawl Toàn bộ Data (547k)
            </div>
            <Title level={2} className="!mb-1 text-slate-800 tracking-tight font-normal">
              Theo Dõi Tiến Trình Crawl Toàn Bộ
            </Title>
            <Text className="text-slate-500">
              Giám sát tiến độ cào 547,000+ thông báo đấu giá và đồng bộ dữ liệu chi tiết
            </Text>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="primary"
              size="large"
              icon={<Play className="w-4 h-4" />}
              loading={actionLoading}
              onClick={handleStart}
              className="bg-slate-900 hover:!bg-slate-800 text-white border-none rounded-xl px-6"
            >
              Bắt Đầu Mới
            </Button>
            <Button
              size="large"
              icon={<RotateCw className="w-4 h-4" />}
              loading={actionLoading}
              onClick={handleContinue}
              className="rounded-xl border-slate-300 hover:bg-slate-50"
            >
              Tiếp Tục
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/70 backdrop-blur-md border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">Tổng mục tiêu</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold text-slate-900">
              {status ? status.target.toLocaleString() : '547,000'}
            </span>
            <span className="text-xs text-slate-400 block mt-1">Bản ghi trên hệ thống DGTS</span>
          </div>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">Đã lưu trong DB</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold text-slate-900">
              {status ? status.totalSaved.toLocaleString() : '0'}
            </span>
            <span className="text-xs text-emerald-600 font-medium block mt-1">
              +{status ? status.missingToTarget.toLocaleString() : '0'} cần cào thêm
            </span>
          </div>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">Chi tiết (Detail)</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold text-slate-900">
              {status ? status.detailDone.toLocaleString() : '0'}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              Còn thiếu: {status ? status.detailPending.toLocaleString() : '0'}
            </span>
          </div>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">Tốc độ xử lý</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold text-slate-900">
              {status ? status.speedPerSecond.toFixed(1) : '0'}
            </span>
            <span className="text-xs text-slate-400 block mt-1">bản ghi / giây</span>
          </div>
        </Card>
      </div>

      {/* Progress Cards */}
      <Card className="bg-white/70 backdrop-blur-md border border-slate-100 rounded-2xl shadow-sm">
        <Title level={4} className="!mb-4 text-slate-800 font-normal">
          Tiến Độ Hoàn Thành
        </Title>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600 font-medium">Tổng tiến độ cào data</span>
              <span className="text-slate-900 font-semibold">{status ? status.progressPercent.toFixed(2) : 0}%</span>
            </div>
            <Progress
              percent={status ? Number(status.progressPercent.toFixed(2)) : 0}
              status="active"
              strokeColor={{ '0%': '#2563eb', '100%': '#10b981' }}
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600 font-medium">Tiến độ cào trang (Pages)</span>
              <span className="text-slate-900 font-semibold">{status ? status.pagePercent.toFixed(2) : 0}%</span>
            </div>
            <Progress
              percent={status ? Number(status.pagePercent.toFixed(2)) : 0}
              strokeColor="#8b5cf6"
            />
          </div>
        </div>
      </Card>

      {/* Recent Worker Log */}
      {status?.latestLog && (
        <Card className="bg-white/70 backdrop-blur-md border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Title level={4} className="!mb-0 text-slate-800 font-normal">
              Nhật Ký Đợt Crawl Mới Nhất
            </Title>
            <Tag color={status.latestLog.status === 'running' ? 'processing' : 'success'} className="rounded-full px-3">
              {status.latestLog.status.toUpperCase()}
            </Tag>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
            <div>
              <span className="text-slate-400 block">Số trang đã xử lý</span>
              <span className="font-semibold text-slate-800">
                {status.latestLog.pagesProcessed} / {status.latestLog.totalPages}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Thêm mới</span>
              <span className="font-semibold text-emerald-600">+{status.latestLog.itemsInserted}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Bỏ qua (Trùng)</span>
              <span className="font-semibold text-slate-600">{status.latestLog.itemsSkipped}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Cập nhật</span>
              <span className="font-semibold text-blue-600">{status.latestLog.itemsUpdated}</span>
            </div>
          </div>

          {status.latestLog.errorMessages && status.latestLog.errorMessages.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Thông báo / Lỗi:
              </div>
              {status.latestLog.errorMessages.slice(-3).map((err, idx) => (
                <div key={idx}>• {err}</div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
