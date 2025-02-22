import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import Link from 'next/link';
// import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function TopPage() {
  const [interviews, setInterviews] = useState([]);

  useEffect(() => {
    const fetchInterviews = async () => {
      let { data, error } = await supabase.from('interviews').select('*');
      if (error) console.error("🚨 データ取得エラー:", error);
      else setInterviews(data);
    };

    fetchInterviews();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-4xl text-center">
        <h2 className="text-2xl font-bold mb-6">管理者ページ</h2>
        
        {/* ナビゲーション */}
        <div className="flex flex-col space-y-4 mb-6">
          <Link href="/jobs">
            <a className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-700">就職先DBページへ</a>
          </Link>
          <Link href="/admin/dashboard">
            <a className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-700">管理ダッシュボードへ</a>
          </Link>
          <Link href="/interviews">
            <a className="bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-700">インタビュー一覧へ</a>
          </Link>
        </div>

        <h3 className="text-xl font-semibold mb-4">インタビュー一覧</h3>
        {interviews.length > 0 ? (
          <ul>
            {interviews.map((interview) => (
              <li key={interview.id} className="border-b py-2">
                <Link href={`/interviews/${interview.id}`}>
                  <a className="text-blue-600 font-bold hover:underline">
                    {interview.title}
                  </a>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">データを取得中...</p>
        )}
      </div>
    </div>
  );
}
