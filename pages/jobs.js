import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function JobsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const studentId = localStorage.getItem("studentId");
    const password = localStorage.getItem("password");

    if (!studentId || password !== "kosenjbtest!table") {
      router.push("/auth");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]); // ✅ router を依存配列に追加

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div>
      <h2>ログイン成功！</h2>
    </div>
  );
}
