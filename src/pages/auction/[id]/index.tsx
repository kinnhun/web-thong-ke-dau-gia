import Head from "next/head";
import type { ReactElement } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuctionDetailContainer } from "@/features/auction/AuctionDetailContainer";

export default function AuctionDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  if (!id || typeof id !== "string") return null;

  return (
    <>
      <Head>
        <title>Chi tiết tài sản | AuctionWatch</title>
        <meta name="description" content="Chi tiết phân tích giá và lịch sử đấu giá tài sản" />
      </Head>
      <AuctionDetailContainer id={id} />
    </>
  );
}

AuctionDetailPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
