import { useState } from "react";
import { useRouter } from "next/router";
import supabase from "../utils/supabaseClient";

export default function AuthPage() {
  const [studentId, setStudentId] = useState("");  // 学籍番号
  const [password, setPassword] = useState("");  // パスワード
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleLogin = async () => {
    // 学籍番号をメールアドレスに変換
    const email = `${studentId}@inc.kisarazu.ac.jp`;

    // 学籍番号の形式チェック（例: e19217）
    const studentIdPattern = /^[a-zA-Z]\d{5}$/;
    if (!studentIdPattern.test(studentId)) {
      setError("学籍番号の形式が正しくありません");
      return;
    }

    console.log("Email:", email);  // デバッグ用
    console.log("Password:", password);  // デバッグ用

    // Supabase にログインリクエストを送る
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("Login error:", error);  // デバッグ用
      setError("学籍番号またはパスワードが間違っています");
    } else {
      // ログイン成功時に /jobs へリダイレクト
      router.push("/jobs");
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
      
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 w-full mb-2"
      />

      <button onClick={handleLogin} className="bg-blue-500 text-white px-4 py-2 rounded w-full">
        ログイン
      </button>
    </div>
  );
}
