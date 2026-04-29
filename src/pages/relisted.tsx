import Head from "next/head";
import type { ReactElement } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
// import { RelistedContainer } from "@/features/relisted/RelistedContainer";

export default function RelistedPage() {
  return (
    <>
      <Head>
        <title>Tài sản đăng lại | AuctionWatch</title>
        <meta name="description" content="Danh sách tài sản đấu giá được đăng lại nhiều nhất" />
      </Head>
      {/*
        <RelistedContainer />
      */}
    </>
  );
}

RelistedPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
