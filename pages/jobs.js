import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "../utils/supabaseClient";
import { requireAuth } from "../utils/authHelper";

export default function JobsPage() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      await requireAuth(router);  // 未ログインなら /auth へリダイレクト
      const loggedInUser = await supabase.auth.getUser();
      setUser(loggedInUser?.data?.user);
    };
    checkAuth();
  }, []);

  return (
    <div className="p-6">
      {user ? (
        <div>
          <h2 className="text-xl font-bold">ようこそ, {user.email}</h2>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/auth");  // ログアウト後にログインページへ
            }} 
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            ログアウト
          </button>
        </div>
      ) : (
        <p>読み込み中...</p>
      )}
    </div>
  );
}
