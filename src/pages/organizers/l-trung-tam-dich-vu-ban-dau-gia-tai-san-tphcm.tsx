import Head from "next/head";
import { useEffect } from "react";
import type { ReactElement } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { RelistedContainer } from "@/features/relisted/RelistedContainer";

const ORGANIZER_NAME = "Trung tâm Dịch vụ bán đấu giá tài sản TPHCM";

export default function LTrungTamDichVuBanDauGiaTaiSanTphcmPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.organizer === ORGANIZER_NAME) return;

    router.replace(
      {
        pathname: router.pathname,
        query: {
          ...router.query,
          organizer: ORGANIZER_NAME,
        },
      },
      undefined,
      { shallow: true }
    );
  }, [router, router.isReady, router.pathname, router.query]);

  const isReady = router.isReady && router.query.organizer === ORGANIZER_NAME;

  return (
    <>
      <Head>
        <title>{ORGANIZER_NAME} | AuctionWatch</title>
        <meta
          name="description"
          content={`Trang riêng cho tổ chức đấu giá ${ORGANIZER_NAME}, dùng cùng bộ lọc với /discounts hiện tại`}
        />
      </Head>
      {isReady ? <RelistedContainer /> : null}
    </>
  );
}

LTrungTamDichVuBanDauGiaTaiSanTphcmPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
