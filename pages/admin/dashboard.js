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
  const [jobViewData, setJobViewData] = useState([]);
  const [columnSelectionData, setColumnSelectionData] = useState({});
  const [sortingData, setSortingData] = useState({});
  const [filterUsageData, setFilterUsageData] = useState({});
  const [studentData, setStudentData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Supabase認証ユーザーを取得 - auth.usersテーブルから
        let { data: users, error: usersError } = await supabase
          .from('auth_users_view') // ビューまたは専用テーブルを想定
          .select('id, email');
        
        if (usersError) {
          console.error("🚨 ユーザーデータ取得エラー:", usersError);
        } else {
          console.log("📡 認証ユーザーデータ:", users);
        }

        // ユーザーの学籍番号を抽出（email形式：e19217@inc.kisarazu.ac.jp）
        const processedUsers = users?.map(user => {
          const email = user.email || '';
          const studentId = email.split('@')[0]; // @より前の部分を学籍番号として抽出
          return {
            ...user,
            studentId
          };
        }) || [];
        
        // 学籍番号をキーとしたマッピングを作成
        const studentIdToUser = {};
        processedUsers.forEach(user => {
          if (user.studentId) {
            studentIdToUser[user.studentId] = user;
          }
        });
        
        setStudentData(processedUsers);

        // ビューログデータの取得
        let { data: viewLogs, error: viewError } = await supabase
          .from('view_logs')
          .select('*')
          .eq('page', 'jobs');
      
        if (viewError) {
          console.error("🚨 閲覧ログ取得エラー:", viewError);
        } else {
          console.log("📡 就職先DB閲覧ログ:", viewLogs);

          // 学籍番号を付加した閲覧ログを作成
          const enrichedViewLogs = viewLogs.map(log => {
            // user_idを使って認証ユーザーを検索
            const user = processedUsers.find(u => u.id === log.user_id);
            return {
              ...log,
              studentId: user?.studentId || 'unknown'
            };
          });
          
          setJobViewData(enrichedViewLogs);
        }
        
        // 列選択データの取得
        let { data: columnData, error: columnError } = await supabase
          .from('column_selections')
          .select('*');
      
        if (columnError) {
          console.error("🚨 列選択データ取得エラー:", columnError);
        } else {
          console.log("📡 列選択データ:", columnData);
          
          // 学籍番号を付加した列選択データを処理
          if (columnData && columnData.length > 0) {
            const enrichedColumnData = columnData.map(item => {
              const user = processedUsers.find(u => u.id === item.user_id);
              return {
                ...item,
                studentId: user?.studentId || 'unknown'
              };
            });
            
            const columnStats = processColumnSelectionData(enrichedColumnData);
            setColumnSelectionData(columnStats);
          }
        }
        
        // ソート操作データの取得
        let { data: sortData, error: sortError } = await supabase
          .from('sort_operations')
          .select('*');
          
        if (sortError) {
          console.error("🚨 ソート操作データ取得エラー:", sortError);
        } else {
          console.log("📡 ソート操作データ:", sortData);
          
          // 学籍番号を付加したソート操作データを処理
          if (sortData && sortData.length > 0) {
            const enrichedSortData = sortData.map(item => {
              const user = processedUsers.find(u => u.id === item.user_id);
              return {
                ...item,
                studentId: user?.studentId || 'unknown'
              };
            });
            
            const sortStats = processSortingData(enrichedSortData);
            setSortingData(sortStats);
          }
        }
        
        // フィルター使用データの取得
        let { data: filterData, error: filterError } = await supabase
          .from('filter_operations')
          .select('*');
          
        if (filterError) {
          console.error("🚨 フィルター操作データ取得エラー:", filterError);
        } else {
          console.log("📡 フィルター操作データ:", filterData);
          
          // 学籍番号を付加したフィルター操作データを処理
          if (filterData && filterData.length > 0) {
            const enrichedFilterData = filterData.map(item => {
              const user = processedUsers.find(u => u.id === item.user_id);
              return {
                ...item,
                studentId: user?.studentId || 'unknown'
              };
            });
            
            const filterStats = processFilterData(enrichedFilterData);
            setFilterUsageData(filterStats);
          }
        }
      } catch (err) {
        console.error("データ取得中にエラーが発生しました:", err);
      } finally {
        setLoading(false);
      }
    };
    
    // フィルター操作データを処理する関数
    const processFilterData = (data) => {
      // フィルター種類別の使用回数
      const filterTypeCounts = {};
      
      data.forEach(filter => {
        const filterType = filter.filter_type || 'unknown';
        
        if (!filterTypeCounts[filterType]) {
          filterTypeCounts[filterType] = 0;
        }
        filterTypeCounts[filterType]++;
      });
      
      // 学籍番号ごとのフィルター使用傾向
      const studentFilterPreferences = {};
      
      data.forEach(filter => {
        const studentId = filter.studentId || 'unknown';
        
        if (!studentFilterPreferences[studentId]) {
          studentFilterPreferences[studentId] = {};
        }
        
        const filterType = filter.filter_type || 'unknown';
        
        if (!studentFilterPreferences[studentId][filterType]) {
          studentFilterPreferences[studentId][filterType] = 0;
        }
        
        studentFilterPreferences[studentId][filterType]++;
      });
      
      return {
        filterTypeCounts,
        studentFilterPreferences
      };
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
      
      // 学籍番号ごとのソート傾向
      const studentSortPreferences = {};
      
      data.forEach(sort => {
        const studentId = sort.studentId || 'unknown';
        
        if (!studentSortPreferences[studentId]) {
          studentSortPreferences[studentId] = {};
        }
        
        const sortColumn = sort.sort_column;
        
        if (!studentSortPreferences[studentId][sortColumn]) {
          studentSortPreferences[studentId][sortColumn] = 0;
        }
        
        studentSortPreferences[studentId][sortColumn]++;
      });
      
      return {
        sortColumnCounts,
        studentSortPreferences
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
      
      // 学籍番号ごとの列選択傾向
      const studentColumnPreferences = {};
      
      data.forEach(selection => {
        const studentId = selection.studentId || 'unknown';
        
        if (!studentColumnPreferences[studentId]) {
          studentColumnPreferences[studentId] = {};
        }
        
        const selectedColumns = selection.selected_columns || [];
        
        selectedColumns.forEach(column => {
          if (!studentColumnPreferences[studentId][column]) {
            studentColumnPreferences[studentId][column] = 0;
          }
          
          studentColumnPreferences[studentId][column]++;
        });
      });
      
      return {
        columnCounts,
        studentColumnPreferences
      };
    };
  
    fetchData();

    // リアルタイムリスナー設定
    const viewChannel = supabase
      .channel('realtime:view_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'view_logs' }, payload => {
        console.log('リアルタイム閲覧データ:', payload);
        fetchData();
      })
      .subscribe();
      
    const columnChannel = supabase
      .channel('realtime:column_selections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'column_selections' }, payload => {
        console.log('リアルタイム列選択データ:', payload);
        fetchData();
      })
      .subscribe();
      
    const sortChannel = supabase
      .channel('realtime:sort_operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sort_operations' }, payload => {
        console.log('リアルタイムソート操作データ:', payload);
        fetchData();
      })
      .subscribe();
      
    const filterChannel = supabase
      .channel('realtime:filter_operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'filter_operations' }, payload => {
        console.log('リアルタイムフィルター操作データ:', payload);
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(viewChannel);
      supabase.removeChannel(columnChannel);
      supabase.removeChannel(sortChannel);
      supabase.removeChannel(filterChannel);
    };
  }, []);

  // 学籍番号別の閲覧時間グラフデータ
  const studentViewChartData = {
    labels: Array.from(new Set(jobViewData.map(d => d.studentId))).sort(),
    datasets: [
      {
        label: '就職先DB閲覧時間（秒）',
        data: Array.from(new Set(jobViewData.map(d => d.studentId))).sort().map(studentId => {
          const studentLogs = jobViewData.filter(log => log.studentId === studentId);
          const totalTime = studentLogs.reduce((sum, log) => sum + (log.view_time || 0), 0);
          return totalTime;
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
      },
      {
        label: '閲覧回数',
        data: Array.from(new Set(jobViewData.map(d => d.studentId))).sort().map(studentId => {
          return jobViewData.filter(log => log.studentId === studentId).length;
        }),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
      }
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
  
  // フィルター使用分布のグラフデータ
  const filterUsageChartData = {
    labels: Object.keys(filterUsageData.filterTypeCounts || {}),
    datasets: [
      {
        label: 'フィルター使用回数',
        data: Object.values(filterUsageData.filterTypeCounts || {}),
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(153, 102, 255, 0.6)',
        ],
      },
    ],
  };

  const chartOptions = {
    scales: {
      y: {
        beginAtZero: true,
      },
    },
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };
  
  // 特定の学生の最近の活動を表示する関数
  const renderMostActiveStudents = () => {
    // 閲覧回数でユーザーをグループ化
    const studentActivity = {};
    
    jobViewData.forEach(log => {
      const studentId = log.studentId || 'unknown';
      if (!studentActivity[studentId]) {
        studentActivity[studentId] = {
          viewCount: 0,
          totalTime: 0,
          lastActive: null
        };
      }
      
      studentActivity[studentId].viewCount++;
      studentActivity[studentId].totalTime += log.view_time || 0;
      
      const logDate = new Date(log.created_at || log.timestamp || Date.now());
      if (!studentActivity[studentId].lastActive || logDate > new Date(studentActivity[studentId].lastActive)) {
        studentActivity[studentId].lastActive = logDate;
      }
    });
    
    // 閲覧回数の多い順にソート
    const topStudents = Object.entries(studentActivity)
      .map(([studentId, stats]) => ({
        studentId,
        viewCount: stats.viewCount,
        totalTime: stats.totalTime,
        averageTime: stats.totalTime / stats.viewCount,
        lastActive: stats.lastActive
      }))
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10);
    
    if (topStudents.length === 0) return <p className="text-gray-600">学生活動データがありません</p>;
    
    return (
      <div className="mt-6 overflow-x-auto">
        <h4 className="text-lg font-semibold mb-2">最もアクティブな学生（閲覧回数上位10名）</h4>
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-2 px-4 border-b">学籍番号</th>
              <th className="py-2 px-4 border-b">閲覧回数</th>
              <th className="py-2 px-4 border-b">合計閲覧時間</th>
              <th className="py-2 px-4 border-b">平均閲覧時間</th>
              <th className="py-2 px-4 border-b">最終アクセス</th>
            </tr>
          </thead>
          <tbody>
            {topStudents.map(student => (
              <tr key={student.studentId} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b font-medium">{student.studentId}</td>
                <td className="py-2 px-4 border-b text-center">{student.viewCount}回</td>
                <td className="py-2 px-4 border-b text-center">{student.totalTime.toFixed(1)}秒</td>
                <td className="py-2 px-4 border-b text-center">{student.averageTime.toFixed(1)}秒/回</td>
                <td className="py-2 px-4 border-b">
                  {student.lastActive ? student.lastActive.toLocaleString('ja-JP') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">就職先DB学生利用分析ダッシュボード</h2>
        
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <p className="text-lg text-gray-600">データ読み込み中...</p>
          </div>
        ) : (
          <>
            {/* 概要情報 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-800">総閲覧回数</h3>
                <p className="text-3xl font-bold text-blue-900">{jobViewData.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800">ユニークユーザー数</h3>
                <p className="text-3xl font-bold text-green-900">
                  {new Set(jobViewData.map(d => d.studentId)).size}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-800">平均閲覧時間</h3>
                <p className="text-3xl font-bold text-purple-900">
                  {jobViewData.length > 0 
                    ? `${(jobViewData.reduce((sum, d) => sum + (d.view_time || 0), 0) / jobViewData.length).toFixed(1)}秒` 
                    : '0秒'}
                </p>
              </div>
            </div>
            
            {/* 学生別の閲覧データ */}
            <h3 className="text-lg font-semibold mt-6 mb-3">👩‍🎓 学籍番号別の利用状況</h3>
            {jobViewData.length > 0 ? (
              <Bar data={studentViewChartData} options={chartOptions} />
            ) : (
              <p className="text-gray-600">閲覧データがありません</p>
            )}
            
            {/* アクティブな学生のテーブル */}
            {renderMostActiveStudents()}
            
            {/* 列選択・ソート・フィルター分析 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div>
                <h3 className="text-lg font-semibold mb-2">🔍 選択された情報項目</h3>
                {Object.keys(columnSelectionData.columnCounts || {}).length > 0 ? (
                  <Pie 
                    data={columnSelectionChartData}
                    options={{
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            boxWidth: 15
                          }
                        }
                      }
                    }} 
                  />
                ) : (
                  <p className="text-gray-600">列選択データがありません</p>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">🔄 使用されたソート条件</h3>
                {Object.keys(sortingData.sortColumnCounts || {}).length > 0 ? (
                  <Pie 
                    data={sortingChartData}
                    options={{
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            boxWidth: 15
                          }
                        }
                      }
                    }} 
                  />
                ) : (
                  <p className="text-gray-600">ソート操作データがありません</p>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">🔎 使用されたフィルター</h3>
                {Object.keys(filterUsageData.filterTypeCounts || {}).length > 0 ? (
                  <Pie 
                    data={filterUsageChartData}
                    options={{
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            boxWidth: 15
                          }
                        }
                      }
                    }} 
                  />
                ) : (
                  <p className="text-gray-600">フィルター操作データがありません</p>
                )}
              </div>
            </div>
            
            {/* インサイトと推奨事項 */}
            <div className="mt-8 p-4 bg-blue-50 rounded">
              <h3 className="text-lg font-semibold text-blue-800">💡 分析インサイト</h3>
              <ul className="list-disc pl-5 mt-2 text-blue-900">
                <li>最もアクティブな学生（例：e19217）は特に熱心に就職活動を行っている可能性があります</li>
                <li>よく選ばれる情報項目（給与、年間休日など）は学生が最も重視する就職条件を示しています</li>
                <li>特定の条件でのソートが多いことから、その条件が就職先選びの決め手になっている可能性があります</li>
                <li>閲覧データのパターンから、就職活動の本格化時期が見えてきます</li>
                <li>フィルター使用状況から、学生が避けたい条件（残業時間不明など）を把握できます</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}