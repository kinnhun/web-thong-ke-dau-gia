import Head from "next/head";
import type { ReactElement } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminContainer } from "@/features/admin/AdminContainer";

export default function AdminPage() {
  return (
    <>
      <Head>
        <title>Quản trị dữ liệu | AuctionWatch</title>
        <meta name="description" content="Quản trị crawler, chuẩn hóa, ghép tài sản và xử lý lỗi" />
      </Head>
      <AdminContainer />
    </>
  );
}

AdminPage.getLayout = function getLayout(page: ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};
