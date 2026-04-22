import Head from "next/head";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>404 | AuctionWatch</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Trang không tồn tại</p>
          <Link href="/" className="text-primary underline hover:text-primary/90">
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    </>
  );
}
