import Head from "next/head";
import type { ReactElement } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReportsContainer } from "@/features/reports/ReportsContainer";

export default function ReportsPage() {
  return (
    <>
      <Head>
        <title>Báo cáo thị trường | AuctionWatch</title>
        <meta name="description" content="Phân tích xu hướng đấu giá theo khu vực, loại tài sản và thời gian" />
      </Head>
      <ReportsContainer />
    </>
  );
}

ReportsPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
