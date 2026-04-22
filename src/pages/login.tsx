import Head from "next/head";
import { LoginContainer } from "@/features/auth/LoginContainer";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>Đăng nhập | AuctionWatch</title>
        <meta name="description" content="Đăng nhập để truy cập bộ lọc đã lưu và Thông Báo" />
      </Head>
      <LoginContainer />
    </>
  );
}
