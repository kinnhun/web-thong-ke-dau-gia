import Head from "next/head";
import type { ReactElement } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ListingContainer } from "@/features/listing/ListingContainer";

export default function ListingPage() {
  return (
    <>
      <Head>
        <title>Thông báo đấu giá | AuctionWatch</title>
        <meta name="description" content="Danh sách thông báo công khai việc đấu giá tài sản từ Cổng Đấu Giá Tài Sản Quốc Gia" />
      </Head>
      <ListingContainer />
    </>
  );
}

ListingPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
