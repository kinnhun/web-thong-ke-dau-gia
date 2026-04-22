import Head from "next/head";
import type { ReactElement } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardContainer } from "@/features/dashboard/DashboardContainer";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Tổng quan | AuctionWatch</title>
        <meta name="description" content="Thống kê tài sản đấu giá giảm sâu - Theo dõi, phân tích xu hướng đấu giá từ dữ liệu công khai" />
      </Head>
      <DashboardContainer />
    </>
  );
}

HomePage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
