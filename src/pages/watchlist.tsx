import Head from 'next/head';
import { AppLayout } from '@/components/layout/AppLayout';
import { WatchlistContainer } from '@/features/watchlist/WatchlistContainer';

export default function WatchlistPage() {
  return (
    <>
      <Head>
        <title>Danh sách theo dõi - AuctionWatch</title>
        <meta name="description" content="Quản lý các tài sản đấu giá đang theo dõi" />
      </Head>
      <AppLayout>
        <WatchlistContainer />
      </AppLayout>
    </>
  );
}
