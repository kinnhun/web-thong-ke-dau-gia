import Head from "next/head";
import type { ReactElement } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { OrganizerAuctionNoticesContainer } from "@/features/listing/OrganizerAuctionNoticesContainer";

const ORGANIZER_NAME = "Trung tâm Dịch vụ bán đấu giá tài sản TPHCM";

export default function LTrungTamDichVuBanDauGiaTaiSanTphcmPage() {
  return (
    <>
      <Head>
        <title>Trung tâm Dịch vụ bán đấu giá tài sản TPHCM | AuctionWatch</title>
        <meta
          name="description"
          content="Tất cả thông báo đấu giá của Trung tâm Dịch vụ bán đấu giá tài sản TPHCM, gồm cả bài đăng một lần và bài đăng lại."
        />
      </Head>
      <OrganizerAuctionNoticesContainer
        fixedOrganizer={ORGANIZER_NAME}
        title="Trung tâm Dịch vụ bán đấu giá tài sản TPHCM"
        description="Toàn bộ bài đăng của đơn vị này, bao gồm cả bài đăng một lần và bài đăng lại với bộ lọc nâng cao."
      />
    </>
  );
}

LTrungTamDichVuBanDauGiaTaiSanTphcmPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
