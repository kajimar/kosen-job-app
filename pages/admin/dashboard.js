import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';

const Bar = dynamic(() => import('react-chartjs-2').then((mod) => mod.Bar), { ssr: false });
const Pie = dynamic(() => import('react-chartjs-2').then((mod) => mod.Pie), { ssr: false });
import 'chart.js/auto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminDashboard() {
  const [viewData, setViewData] = useState([]);
  const [jobViewData, setJobViewData] = useState([]);
  const [columnSelectionData, setColumnSelectionData] = useState({});
  const [sortingData, setSortingData] = useState({});

  useEffect(() => {
    const fetchViewData = async () => {
      // 全ビューデータの取得
      let { data: viewLogs, error: viewError } = await supabase
        .from('view_logs')
        .select('*');
  
      console.log("📡 ビューログデータ:", viewLogs);
      if (viewError) console.error("🚨 ビューログ取得エラー:", viewError);
  
      // 選択された列のデータを取得（新しいテーブルを想定）
      let { data: columnData, error: columnError } = await supabase
        .from('column_selections')
        .select('*');
  
      console.log("📡 列選択データ:", columnData);
      if (columnError) console.error("🚨 列選択データ取得エラー:", columnError);
      
      // ソート操作のデータを取得（新しいテーブルを想定）
      let { data: sortData, error: sortError } = await supabase
        .from('sort_operations')
        .select('*');
        
      console.log("📡 ソート操作データ:", sortData);
      if (sortError) console.error("🚨 ソート操作データ取得エラー:", sortError);
  
      if (viewLogs && viewLogs.length > 0) {
        setViewData(viewLogs.filter(d => d.page === 'interviews'));
        setJobViewData(viewLogs.filter(d => d.page === 'jobs'));
      }
      
      if (columnData && columnData.length > 0) {
        // 選択された列の分布を分析
        const columnStats = processColumnSelectionData(columnData);
        setColumnSelectionData(columnStats);
      }
      
      if (sortData && sortData.length > 0) {
        // ソート操作の分布を分析
        const sortStats = processSortingData(sortData);
        setSortingData(sortStats);
      }
    };
    
    // ソート操作データを処理する関数
    const processSortingData = (data) => {
      // ソートされた列の出現回数をカウント
      const sortColumnCounts = {};
      
      data.forEach(sort => {
        const sortColumn = sort.sort_column;
        const sortDirection = sort.sort_direction || 'asc'; // デフォルトは昇順
        
        const key = `${sortColumn} (${sortDirection === 'asc' ? '昇順' : '降順'})`;
        
        if (!sortColumnCounts[key]) {
          sortColumnCounts[key] = 0;
        }
        sortColumnCounts[key]++;
      });
      
      // ユーザーごとのソートパターンも分析
      const userSortPatterns = {};
      data.forEach(sort => {
        const userId = sort.user_id;
        const sortColumn = sort.sort_column;
        const sortDirection = sort.sort_direction || 'asc';
        
        const key = `${sortColumn} (${sortDirection === 'asc' ? '昇順' : '降順'})`;
        
        if (!userSortPatterns[userId]) {
          userSortPatterns[userId] = {};
        }
        
        if (!userSortPatterns[userId][key]) {
          userSortPatterns[userId][key] = 0;
        }
        userSortPatterns[userId][key]++;
      });
      
      // 時間的なソートパターンも分析（時間帯ごとの人気ソート列）
      const timePatterns = {};
      data.forEach(sort => {
        if (!sort.created_at) return;
        
        const timestamp = new Date(sort.created_at);
        const hour = timestamp.getHours();
        const timeSlot = Math.floor(hour / 4); // 0-5, 6-11, 12-17, 18-23 の4つの時間帯
        const timeSlotLabel = [
          '深夜 (0-5時)', 
          '午前 (6-11時)', 
          '午後 (12-17時)', 
          '夜間 (18-23時)'
        ][timeSlot];
        
        const sortColumn = sort.sort_column;
        
        if (!timePatterns[timeSlotLabel]) {
          timePatterns[timeSlotLabel] = {};
        }
        
        if (!timePatterns[timeSlotLabel][sortColumn]) {
          timePatterns[timeSlotLabel][sortColumn] = 0;
        }
        
        timePatterns[timeSlotLabel][sortColumn]++;
      });
      
      return {
        sortColumnCounts,
        userSortPatterns,
        timePatterns
      };
    };
    
    // 列選択データを処理する関数
    const processColumnSelectionData = (data) => {
      // 選択された列の出現回数をカウント
      const columnCounts = {};
      
      data.forEach(selection => {
        // 選択された列の情報がJSON形式で保存されていると想定
        const selectedColumns = selection.selected_columns || [];
        
        selectedColumns.forEach(column => {
          if (!columnCounts[column]) {
            columnCounts[column] = 0;
          }
          columnCounts[column]++;
        });
      });
      
      // ユーザーごとの選択パターンも分析
      const userPatterns = {};
      data.forEach(selection => {
        const userId = selection.user_id;
        const selectedColumns = selection.selected_columns || [];
        
        if (!userPatterns[userId]) {
          userPatterns[userId] = {};
        }
        
        selectedColumns.forEach(column => {
          if (!userPatterns[userId][column]) {
            userPatterns[userId][column] = 0;
          }
          userPatterns[userId][column]++;
        });
      });
      
      return {
        columnCounts,
        userPatterns
      };
    };
  
    fetchViewData();

    // リアルタイムリスナー
    const viewChannel = supabase
      .channel('realtime:view_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'view_logs' }, payload => {
        console.log('リアルタイムビューデータ:', payload);
        fetchViewData();
      })
      .subscribe();
      
    const columnChannel = supabase
      .channel('realtime:column_selections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'column_selections' }, payload => {
        console.log('リアルタイム列選択データ:', payload);
        fetchViewData();
      })
      .subscribe();
      
    const sortChannel = supabase
      .channel('realtime:sort_operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sort_operations' }, payload => {
        console.log('リアルタイムソート操作データ:', payload);
        fetchViewData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(viewChannel);
      supabase.removeChannel(columnChannel);
      supabase.removeChannel(sortChannel);
    };
  }, []);

  // 就職先DB閲覧時間グラフデータ
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
  
  // ソート操作分布のグラフデータ
  const sortingChartData = {
    labels: Object.keys(sortingData.sortColumnCounts || {}),
    datasets: [
      {
        label: 'ソート操作の回数',
        data: Object.values(sortingData.sortColumnCounts || {}),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(199, 199, 199, 0.6)',
        ],
      },
    ],
  };
  
  // 列選択分布のグラフデータ
  const columnSelectionChartData = {
    labels: Object.keys(columnSelectionData.columnCounts || {}),
    datasets: [
      {
        label: '選択された列の回数',
        data: Object.values(columnSelectionData.columnCounts || {}),
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(199, 199, 199, 0.6)',
        ],
      },
    ],
  };

  const chartOptions = {
    scales: {
      y: {
        beginAtZero: true,
        max: jobViewData.length > 0 ? Math.max(...jobViewData.map((d) => d.view_time)) + 10: 100,
      },
    },
  };

  // 時間帯別のソートパターンを表示する関数
  const renderTimeSortPatterns = () => {
    const timePatterns = sortingData.timePatterns || {};
    const timeSlots = Object.keys(timePatterns);
    
    if (timeSlots.length === 0) return <p>時間帯別ソートパターンデータがありません</p>;
    
    return (
      <div className="mt-6">
        <h4 className="text-md font-semibold">時間帯別の人気ソート条件</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">時間帯</th>
                <th className="py-2 px-4 border-b">最も人気のソート列</th>
                <th className="py-2 px-4 border-b">ソート回数</th>
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(timeSlot => {
                const sortColumns = timePatterns[timeSlot];
                const mostPopularColumn = Object.keys(sortColumns).reduce(
                  (a, b) => sortColumns[a] > sortColumns[b] ? a : b,
                  Object.keys(sortColumns)[0]
                );
                
                return (
                  <tr key={timeSlot}>
                    <td className="py-2 px-4 border-b">{timeSlot}</td>
                    <td className="py-2 px-4 border-b">{mostPopularColumn}</td>
                    <td className="py-2 px-4 border-b">{sortColumns[mostPopularColumn]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  // 特定のユーザーの列選択パターンを表示する関数
  const renderUserColumnSelections = () => {
    const userPatterns = columnSelectionData.userPatterns || {};
    const userIds = Object.keys(userPatterns);
    
    if (userIds.length === 0) return <p>ユーザー選択パターンデータがありません</p>;
    
    return (
      <div className="mt-6">
        <h4 className="text-md font-semibold">ユーザー別の選択傾向（上位5ユーザー）</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">ユーザーID</th>
                <th className="py-2 px-4 border-b">最も頻繁に選択する列</th>
                <th className="py-2 px-4 border-b">選択回数</th>
              </tr>
            </thead>
            <tbody>
              {userIds.slice(0, 5).map(userId => {
                const userColumns = userPatterns[userId];
                const mostSelectedColumn = Object.keys(userColumns).reduce(
                  (a, b) => userColumns[a] > userColumns[b] ? a : b,
                  Object.keys(userColumns)[0]
                );
                
                return (
                  <tr key={userId}>
                    <td className="py-2 px-4 border-b">User {userId}</td>
                    <td className="py-2 px-4 border-b">{mostSelectedColumn}</td>
                    <td className="py-2 px-4 border-b">{userColumns[mostSelectedColumn]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-5xl">
        <h2 className="text-2xl font-bold mb-4">就職先DB分析ダッシュボード</h2>
        
        {/* 就職先DB閲覧時間グラフ */}
        <h3 className="text-lg font-semibold mt-4">📊 就職先DBの閲覧データ</h3>
        {jobViewData.length > 0 ? (
          <Bar data={jobChartData} options={chartOptions} />
        ) : (
          <p className="text-gray-600">データを取得中...</p>
        )}
        
        {/* 列選択分布グラフ */}
        <h3 className="text-lg font-semibold mt-8">🔍 最も選択されている情報項目</h3>
        {Object.keys(columnSelectionData.columnCounts || {}).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Bar 
                data={columnSelectionChartData} 
                options={{
                  indexAxis: 'y',
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }} 
              />
            </div>
            <div>
              <Pie 
                data={columnSelectionChartData}
                options={{
                  plugins: {
                    legend: {
                      position: 'right'
                    }
                  }
                }} 
              />
            </div>
          </div>
        ) : (
          <p className="text-gray-600">列選択データを取得中...</p>
        )}
        
        {/* ソート操作分布グラフ */}
        <h3 className="text-lg font-semibold mt-8">🔄 最も使用されているソート条件</h3>
        {Object.keys(sortingData.sortColumnCounts || {}).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Bar 
                data={sortingChartData} 
                options={{
                  indexAxis: 'y',
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }} 
              />
            </div>
            <div>
              <Pie 
                data={sortingChartData}
                options={{
                  plugins: {
                    legend: {
                      position: 'right'
                    }
                  }
                }} 
              />
            </div>
          </div>
        ) : (
          <p className="text-gray-600">ソート操作データを取得中...</p>
        )}
        
        {/* ユーザー別選択パターン */}
        <h3 className="text-lg font-semibold mt-8">👥 ユーザー行動分析</h3>
        {Object.keys(columnSelectionData.userPatterns || {}).length > 0 ? (
          renderUserColumnSelections()
        ) : (
          <p className="text-gray-600">ユーザー選択パターンデータを取得中...</p>
        )}
        
        {/* 時間帯別ソートパターン */}
        <h3 className="text-lg font-semibold mt-8">🕒 時間帯別ソート行動分析</h3>
        {Object.keys(sortingData.timePatterns || {}).length > 0 ? (
          renderTimeSortPatterns()
        ) : (
          <p className="text-gray-600">時間帯別ソートパターンデータを取得中...</p>
        )}
        
        {/* インサイトと推奨事項 */}
        <div className="mt-8 p-4 bg-blue-50 rounded">
          <h3 className="text-lg font-semibold text-blue-800">💡 分析インサイト</h3>
          <ul className="list-disc pl-5 mt-2 text-blue-900">
            <li>最も選択されている情報は何かを把握し、その情報をより充実させることでユーザー満足度を向上できます</li>
            <li>あまり選択されていない項目は、有用性を再評価するか、より見つけやすくする改善が必要かもしれません</li>
            <li>ユーザーごとの選択パターンから、パーソナライズされた情報提供が可能です</li>
            <li>最も使用されているソート条件は、ユーザーが重視している企業比較のポイントを示しています</li>
            <li>時間帯別のソート傾向から、ユーザーの就活行動パターンを理解できます</li>
          </ul>
        </div>
      </div>
    </div>
  );
}