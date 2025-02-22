import { useState } from "react";
import { useRouter } from "next/router";
import supabase from "../utils/supabaseClient";

export default function AuthPage() {
  const [studentId, setStudentId] = useState("");  // 学籍番号
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleLogin = async () => {
    const email = `${studentId}@example.com`;  // Supabase Auth ではメール形式が必要
    const password = "kosenjbtest!table";  // 固定パスワード

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("学籍番号またはパスワードが間違っています");
    } else {
      router.push("/jobs");  // ログイン成功時に /jobs へリダイレクト
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">ログイン</h2>
      {error && <p className="text-red-500">{error}</p>}

      <input
        type="text"
        placeholder="学籍番号 (例: e19217)"
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        className="border p-2 w-full mb-2"
      />
      
      <button onClick={handleLogin} className="bg-blue-500 text-white px-4 py-2 rounded w-full">
        ログイン
      </button>
    </div>
  );
}
