import Head from "next/head";
import type { ReactElement } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DiscountsContainer } from "@/features/discounts/DiscountsContainer";

export default function DiscountsPage() {
  return (
    <>
      <Head>
        <title>Tài sản giảm giá | AuctionWatch</title>
        <meta name="description" content="Danh sách tài sản đấu giá đang giảm giá, xếp hạng theo tỷ lệ giảm" />
      </Head>
      <DiscountsContainer />
    </>
  );
}

DiscountsPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
