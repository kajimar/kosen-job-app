import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

const Bar = dynamic(() => import('react-chartjs-2').then((mod) => mod.Bar), { ssr: false });
import 'chart.js/auto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminDashboard() {
  const [viewData, setViewData] = useState([]);
  const [jobViewData, setJobViewData] = useState([]);

  useEffect(() => {
    const fetchViewData = async () => {
      let { data, error } = await supabase.from('view_logs').select('*');
  
      console.log("📡 Supabase から取得したデータ:", data); // ここで取得データを確認
      if (error) console.error("🚨 データ取得エラー:", error);
  
      if (data && data.length > 0) {
        setViewData(data.filter(d => d.page === 'interviews'));
        setJobViewData(data.filter(d => d.page === 'jobs'));
      }
    };
  
    fetchViewData();

    // ✅ Supabase の最新リアルタイムリスナー
    const channel = supabase
      .channel('realtime:view_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'view_logs' }, payload => {
        console.log('リアルタイムデータ:', payload);
        fetchViewData(); // データを再取得
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const interviewChartData = {
    labels: viewData.map((d) => `記事 ${d.article_id}`),
    datasets: [
      {
        label: '平均閲覧時間（秒）',
        data: viewData.map((d) => d.view_time),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
    ],
  };

  const jobChartData = {
    labels: jobViewData.map((d) => `User ${d.user_id}`),
    datasets: [
      {
        label: '就職先DB閲覧時間（秒）',
        data: jobViewData.map((d) => d.view_time),
        backgroundColor: 'rgba(192, 75, 75, 0.6)',
      },
    ],
  };

  const chartOptions = {
    scales: {
      y: {
        beginAtZero: true,
        max: viewData.length > 0 ? Math.max(...viewData.map((d) => d.view_time)) + 10: 100,
      },
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-4">管理者ダッシュボード</h2>
        <h3 className="text-lg font-semibold mt-4">📊 インタビュー記事の閲覧データ</h3>
        {viewData.length > 0 ? (
          <Bar data={interviewChartData} options={chartOptions} />
        ) : (
          <p className="text-gray-600">データを取得中...</p>
        )}
        <h3 className="text-lg font-semibold mt-4">📊 就職先DBの閲覧データ</h3>
        {jobViewData.length > 0 ? (
          <Bar data={jobChartData} options={chartOptions} />
        ) : (
          <p className="text-gray-600">データを取得中...</p>
        )}
      </div>
    </div>
  );
}
