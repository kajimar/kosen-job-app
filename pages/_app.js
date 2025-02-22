import { useEffect } from "react";
import { useRouter } from "next/router";
import { requireAuth } from "../utils/authHelper";
import '../styles/globals.css'; // グローバルCSSのインポート

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    if (router.pathname !== "/auth") {
      requireAuth(router);
    }
  }, [router]);

  return <Component {...pageProps} />;
}

export default MyApp;
