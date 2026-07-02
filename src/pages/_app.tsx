import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";

if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (
      args[0] &&
      typeof args[0] === "string" &&
      (args[0].includes("should be greater than 0") || args[0].includes("ResponsiveContainer"))
    ) {
      return;
    }
    originalWarn(...args);
  };
}

export default function App({ Component, pageProps }: AppProps) {
  // Pages can define a `getLayout` function to use a custom layout
  const getLayout = (Component as { getLayout?: (page: React.ReactElement) => React.ReactNode }).getLayout;

  return (
    <QueryProvider>
      <ThemeProvider>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        {getLayout ? getLayout(<Component {...pageProps} />) : <Component {...pageProps} />}
      </ThemeProvider>
    </QueryProvider>
  );
}
