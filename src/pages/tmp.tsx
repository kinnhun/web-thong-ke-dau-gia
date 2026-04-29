import Head from 'next/head';
import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TmpFullCrawlContainer } from '@/features/tmp/TmpFullCrawlContainer';

export default function TmpPage() {
  return (
    <>
      <Head>
        <title>Full Crawl 547k | AuctionWatch</title>
        <meta name="description" content="Theo dõi luồng crawler riêng đang cào toàn bộ 547k dữ liệu đấu giá" />
      </Head>
      <TmpFullCrawlContainer />
    </>
  );
}

TmpPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
