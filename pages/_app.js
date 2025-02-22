import { useEffect } from "react";
import { useRouter } from "next/router";
import { requireAuth } from "../utils/authHelper";

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    if (router.pathname !== "/auth") {
      requireAuth(router);
    }
  }, [router.pathname]);

  return <Component {...pageProps} />;
}

export default MyApp;
