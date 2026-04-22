import Head from "next/head";
import type { ReactElement } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { PriceHistoryContainer } from "@/features/auction/PriceHistoryContainer";

export default function PriceHistoryPage() {
  const router = useRouter();
  const { id } = router.query;

  if (!id || typeof id !== "string") return null;

  return (
    <>
      <Head>
        <title>Lịch sử giá | AuctionWatch</title>
        <meta name="description" content="Lịch sử giá và so sánh các lần đấu giá" />
      </Head>
      <PriceHistoryContainer id={id} />
    </>
  );
}

PriceHistoryPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
