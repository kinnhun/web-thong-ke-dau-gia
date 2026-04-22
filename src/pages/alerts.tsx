import Head from "next/head";
import type { ReactElement } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AlertsContainer } from "@/features/alerts/AlertsContainer";

export default function AlertsPage() {
  return (
    <>
      <Head>
        <title>Thông Báo & bộ lọc | AuctionWatch</title>
        <meta name="description" content="Tự động theo dõi và nhận thông báo khi có tài sản phù hợp" />
      </Head>
      <AlertsContainer />
    </>
  );
}

AlertsPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
