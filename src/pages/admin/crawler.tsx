import Head from "next/head";
import type { ReactElement } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CrawlerDashboardContainer } from "@/features/admin/CrawlerDashboardContainer";

export default function CrawlerDashboardPage() {
  return (
    <>
      <Head>
        <title>Nhật ký & Tiến trình Crawler | AuctionWatch</title>
        <meta name="description" content="Theo dõi tiến độ cào dữ liệu đấu giá và lịch sử hoạt động của bot" />
      </Head>
      <CrawlerDashboardContainer />
    </>
  );
}

CrawlerDashboardPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
