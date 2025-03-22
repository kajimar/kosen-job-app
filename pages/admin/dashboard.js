import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';

const Bar = dynamic(() => import('react-chartjs-2').then((mod) => mod.Bar), { ssr: false });
import 'chart.js/auto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 認証用のラッパーコンポーネント
function AuthWrapper({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // 管理者かどうかをチェック
        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (!adminCheck) {
          // 管理者でない場合はログアウト
          await supabase.auth.signOut();
          setSession(null);
        } else {
          setSession(session);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        // 状態変更時も同じチェックを実行
        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (!adminCheck) {
          await supabase.auth.signOut();
          setSession(null);
        } else {
          setSession(session);
        }
      } else {
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ログイン処理
  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      // まず管理者テーブルでチェック
      const { data: adminCheck, error: checkError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', email)
        .single();

      if (!adminCheck || checkError) {
        setError('管理者アカウントではありません');
        return;
      }

      // 次に認証
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      

      if (authError) {
        setError('ログインに失敗しました');
        return;
      }

      // メールドメインのチェック（学生アカウントでのアクセスを防ぐ）
      if (email.endsWith('@inc.kisarazu.ac.jp')) {
        await supabase.auth.signOut();
        setError('学生アカウントではアクセスできません');
        return;
      }

    } catch (error) {
      setError('エラーが発生しました');
      console.error(error);
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              管理者ログイン
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="管理者メールアドレス"
                />
              </div>
              <div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="パスワード"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ログイン
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 認証済みの場合はダッシュボードを表示（ログアウトボタン付き）
  return (
    <div>
      <div className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold">管理者ダッシュボード</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

// 既存のダッシュボードコンポーネント
function DashboardContent() {
  const [columnSelectionData, setColumnSelectionData] = useState({});
  const [sortingData, setSortingData] = useState({});
  const [filterUsageData, setFilterUsageData] = useState({});
  const [studentAnalysis, setStudentAnalysis] = useState({});

  // フィルターの種類を日本語に変換する関数
  const translateFilterType = (filterType) => {
    const translations = {
      'salary': '給与',
      'region': '地域',
      'working_hours': '労働時間',
      'holidays': '休日',
      'overtime': '残業',
      'weekly_off': '週休',
      'company_size': '企業規模',
      'industry': '業種',
      'bonus': 'ボーナス',
      'unknown': '不明'
    };
    
    return translations[filterType] || filterType;
  };

  // グラフデータの形式を作成する関数
  const createHistogramData = (data) => {
    return {
      labels: Object.keys(data),
      datasets: [
        {
          label: 'Count',
          data: Object.values(data),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  // 全体分析データを計算する関数
  const calculateTotalAnalysis = (studentAnalysis) => {
    const totals = {
      totalViewTime: 0,
      totalViewCount: 0,
      uniqueStudents: Object.keys(studentAnalysis).length
    };
    
    Object.values(studentAnalysis).forEach(data => {
      totals.totalViewTime += data.totalViewTime || 0;
      totals.totalViewCount += data.viewCount || 0;
    });
    
    return totals;
  };
  
  // データからインサイトを取得する関数
  const getDataInsights = (studentAnalysis, columnSelectionData, sortingData, filterUsageData) => {
    // データがない場合は空のオブジェクトを返す
    if (!studentAnalysis || Object.keys(studentAnalysis).length === 0) {
      return {};
    }
    
    // 最も閲覧回数の多い学籍番号を取得
    let maxViewCountStudent = '';
    let maxViewCount = 0;
    
    // 最も閲覧時間の長い学籍番号を取得
    let maxViewTimeStudent = '';
    let maxViewTime = 0;
    
    Object.entries(studentAnalysis).forEach(([studentId, data]) => {
      if (data.viewCount > maxViewCount) {
        maxViewCount = data.viewCount;
        maxViewCountStudent = studentId;
      }
      
      if (data.totalViewTime > maxViewTime) {
        maxViewTime = data.totalViewTime;
        maxViewTimeStudent = studentId;
      }
    });
    
    // 選択された項目のトップ3を取得
    const topColumns = columnSelectionData && columnSelectionData.columnCounts 
      ? Object.entries(columnSelectionData.columnCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(entry => entry[0])
      : [];
      
    // 使用されたフィルターのトップ3を取得
    const topFilters = filterUsageData && filterUsageData.filterTypeCounts
      ? Object.entries(filterUsageData.filterTypeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(entry => entry[0])
      : [];
    
    return {
      maxViewCountStudent,
      maxViewCount,
      maxViewTimeStudent, 
      maxViewTime,
      topColumns,
      topFilters
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Supabase認証ユーザーを取得 
        // まずはauth.usersへの直接アクセスを試みる（管理者権限が必要）
        let { data: users, error: usersError } = await supabase.auth.admin.listUsers();
        
        // 管理者権限がない場合、専用ビューから取得を試みる
        if (usersError) {
          console.log("Auth adminアクセスエラー、別の方法で取得を試みます:", usersError);
          
          let { data: viewUsers, error: viewError } = await supabase
            .from('auth_users_view') // ビューまたは専用テーブルを想定
            .select('id, email');
            
          if (viewError) {
            console.error("🚨 ユーザーデータ取得エラー:", viewError);
            // 最後の手段としてプロファイルテーブルから取得を試みる
            let { data: profiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id, email');
              
            if (profilesError) {
              console.error("🚨 プロファイルデータ取得エラー:", profilesError);
              users = [];
            } else {
              users = profiles;
            }
          } else {
            users = viewUsers;
          }
        }
        
        console.log("📡 認証ユーザーデータ:", users);

        // ユーザーの学籍番号を抽出（email形式：e19217@inc.kisarazu.ac.jp）
        const processedUsersData = (users || []).map(user => {
          const email = user.email || '';
          const studentId = email.split('@')[0]; // @より前の部分を学籍番号として抽出
          return {
            ...user,
            studentId
          };
        });
        
        // 学籍番号をキーとしたマッピングを作成
        const studentIdToUser = {};
        processedUsersData.forEach(user => {
          if (user.studentId) {
            studentIdToUser[user.studentId] = user;
          }
        });

        // ビューログデータの取得
        let { data: viewLogs, error: viewError } = await supabase
          .from('view_logs')
          .select('*')
          .eq('page', 'jobs');
      
        if (viewError) {
          console.error("🚨 閲覧ログ取得エラー:", viewError);
        } else {
          console.log("📡 就職先DB閲覧ログ:", viewLogs);

          const enrichedViewLogs = (viewLogs || []).map(log => {
            const user = processedUsersData.find(u => u.id === log.user_id);
            return {
              ...log,
              studentId: log.student_id || user?.studentId || 'unknown'
            };
          });

          const studentAnalysisData = createStudentAnalysis(enrichedViewLogs);
          setStudentAnalysis(studentAnalysisData);
        }
        
        // 列選択データの取得
        let { data: columnData, error: columnError } = await supabase
          .from('mvp_column_selections')
          .select('*');
      
        if (columnError) {
          console.error("🚨 列選択データ取得エラー:", columnError);
        } else {
          console.log("📡 列選択データ:", columnData);
          
          // 学籍番号を付加した列選択データを処理
          if (columnData && columnData.length > 0) {
            const enrichedColumnData = columnData.map(item => {
              const user = processedUsersData.find(u => u.id === item.user_id);
              return {
                ...item,
                studentId: item.student_id || user?.studentId || 'unknown'
              };
            });
            
            const columnStats = processColumnSelectionData(enrichedColumnData);
            setColumnSelectionData(columnStats);
          }
        }
        
        // ソート操作データの取得
        let { data: sortData, error: sortError } = await supabase
          .from('mvp_sort_operations')
          .select('*');
          
        if (sortError) {
          console.error("🚨 ソート操作データ取得エラー:", sortError);
        } else {
          console.log("📡 ソート操作データ:", sortData);
          
          // 学籍番号を付加したソート操作データを処理
          if (sortData && sortData.length > 0) {
            const enrichedSortData = sortData.map(item => {
              const user = processedUsersData.find(u => u.id === item.user_id);
              return {
                ...item,
                studentId: item.student_id || user?.studentId || 'unknown'
              };
            });
            
            const sortStats = processSortingData(enrichedSortData);
            setSortingData(sortStats);
          }
        }
        
        // フィルター使用データの取得
        let { data: filterData, error: filterError } = await supabase
          .from('mvp_filter_operations')
          .select('*');
          
        if (filterError) {
          console.error("🚨 フィルター操作データ取得エラー:", filterError);
        } else {
          console.log("📡 フィルター操作データ:", filterData);
          
          // 学籍番号を付加したフィルター操作データを処理
          if (filterData && filterData.length > 0) {
            const enrichedFilterData = filterData.map(item => {
              const user = processedUsersData.find(u => u.id === item.user_id);
              return {
                ...item,
                studentId: item.student_id || user?.studentId || 'unknown'
              };
            });
            
            const filterStats = processFilterUsageData(enrichedFilterData);
            setFilterUsageData(filterStats);
          }
        }

      } catch (error) {
        console.error("データ取得中にエラーが発生しました:", error);
      }
    };

    // ソートデータを処理する関数
    const processSortingData = (data) => {
      // ソートされた列の出現回数をカウント
      const sortColumnCounts = {};
      
      data.forEach(sort => {
        const key = `${sort.sort_column} (${sort.sort_direction === 'asc' ? '昇順' : '降順'})`;
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
        // JSONパースを試みて失敗したら空配列を使用
        let selectedColumns = [];
        try {
          selectedColumns = typeof selection.selected_colmns === 'string' 
            ? JSON.parse(selection.selected_colmns) 
            : (selection.selected_colmns || []);
        } catch (e) {
          console.error("列選択データのパースに失敗:", e);
          selectedColumns = [];
        }
        
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
        
        // JSONパースを試みて失敗したら空配列を使用
        let selectedColumns = [];
        try {
          selectedColumns = typeof selection.selected_colmns === 'string' 
            ? JSON.parse(selection.selected_colmns) 
            : (selection.selected_colmns || []);
        } catch (e) {
          console.error("列選択データのパースに失敗:", e);
          selectedColumns = [];
        }
        
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
    
    // フィルターデータを処理する関数
    const processFilterUsageData = (data) => {
      // フィルタータイプの出現回数をカウント
      const filterTypeCounts = {};
      
      data.forEach(filter => {
        const filterType = filter.filter_type || 'unknown';
        const translatedFilterType = translateFilterType(filterType);
        
        if (!filterTypeCounts[translatedFilterType]) {
          filterTypeCounts[translatedFilterType] = 0;
        }
        filterTypeCounts[translatedFilterType]++;
      });
      
      // 学籍番号ごとのフィルター使用傾向
      const studentFilterPreferences = {};
      
      data.forEach(filter => {
        const studentId = filter.studentId || 'unknown';
        
        if (!studentFilterPreferences[studentId]) {
          studentFilterPreferences[studentId] = {};
        }
        
        const filterType = filter.filter_type || 'unknown';
        const translatedFilterType = translateFilterType(filterType);
        
        if (!studentFilterPreferences[studentId][translatedFilterType]) {
          studentFilterPreferences[studentId][translatedFilterType] = 0;
        }
        
        studentFilterPreferences[studentId][translatedFilterType]++;
      });
      
      return {
        filterTypeCounts,
        studentFilterPreferences
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
      .channel('realtime:mvp_column_selections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mvp_column_selections' }, payload => {
        console.log('リアルタイム列選択データ:', payload);
        fetchData();
      })
      .subscribe();
      
    const sortChannel = supabase
      .channel('realtime:mvp_sort_operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mvp_sort_operations' }, payload => {
        console.log('リアルタイムソート操作データ:', payload);
        fetchData();
      })
      .subscribe();
      
    const filterChannel = supabase
      .channel('realtime:mvp_filter_operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mvp_filter_operations' }, payload => {
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

  const createStudentAnalysis = (viewLogs) => {
    const analysis = {};

    viewLogs.forEach(log => {
      const studentId = log.studentId || 'unknown';
      if (!analysis[studentId]) {
        analysis[studentId] = {
          totalViewTime: 0,
          viewCount: 0,
          uniqueOpeners: new Set(),
        };
      }
      analysis[studentId].totalViewTime += log.view_time || 0;
      analysis[studentId].viewCount += 1;
      analysis[studentId].uniqueOpeners.add(log.user_id);
    });

    // Convert Set to size for unique openers count - これは閲覧したユーザー（学籍番号）の数
    Object.keys(analysis).forEach(studentId => {
      analysis[studentId].uniqueOpeners = analysis[studentId].uniqueOpeners.size;
    });

    return analysis;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4">管理者ダッシュボード</h1>
      
      {/* 全体の分析サマリー */}
      {Object.keys(studentAnalysis).length > 0 && (
        <div className="bg-white p-6 rounded shadow mb-6">
          <h2 className="text-xl font-bold mb-4">🔍 全体分析サマリー</h2>
          
          {/* 全体の統計情報 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {(() => {
              const totals = calculateTotalAnalysis(studentAnalysis);
              return (
                <>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p className="text-lg font-semibold text-blue-800">{totals.uniqueStudents}</p>
                    <p className="text-sm text-blue-600">学籍番号数</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <p className="text-lg font-semibold text-green-800">{totals.totalViewCount}</p>
                    <p className="text-sm text-green-600">閲覧回数合計</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <p className="text-lg font-semibold text-purple-800">{totals.totalViewTime}</p>
                    <p className="text-sm text-purple-600">閲覧時間合計</p>
                  </div>
                </>
              );
            })()}
          </div>
          
          {/* インサイト情報 */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
            <h3 className="text-md font-bold mb-2">📊 データインサイト</h3>
            {(() => {
              const insights = getDataInsights(studentAnalysis, columnSelectionData, sortingData, filterUsageData);
              return (
                <ul className="text-sm space-y-2">
                  {insights.maxViewCountStudent && (
                    <li><span className="font-medium">最も閲覧回数が多い学籍番号:</span> {insights.maxViewCountStudent} ({insights.maxViewCount}回)</li>
                  )}
                  {insights.maxViewTimeStudent && (
                    <li><span className="font-medium">最も閲覧時間が長い学籍番号:</span> {insights.maxViewTimeStudent} ({insights.maxViewTime}秒)</li>
                  )}
                  {insights.topColumns && insights.topColumns.length > 0 && (
                    <li><span className="font-medium">最も選択された項目:</span> {insights.topColumns.join(', ')}</li>
                  )}
                  {insights.topFilters && insights.topFilters.length > 0 && (
                    <li><span className="font-medium">最も使用されたフィルター:</span> {insights.topFilters.join(', ')}</li>
                  )}
                </ul>
              );
            })()}
          </div>
          
          {/* 分析手法の提案 */}
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
            <h3 className="text-md font-bold mb-2">💡 追加の分析手法</h3>
            <ul className="text-sm space-y-1">
              <li><span className="font-medium">時間帯別分析:</span> 学生がどの時間帯にデータを閲覧しているか</li>
              <li><span className="font-medium">アクセス経路分析:</span> どのページからアクセスしているかを追跡</li>
              <li><span className="font-medium">セッション持続時間分析:</span> 1回のセッションでの平均閲覧時間</li>
              <li><span className="font-medium">コホート分析:</span> 学年ごとの利用パターンの違い</li>
              <li><span className="font-medium">機能利用率:</span> 各機能（ソート、フィルター）の利用率の時系列変化</li>
            </ul>
          </div>
        </div>
      )}
      
      {/* 学籍番号ごとの分析 */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-bold mb-4">👥 学籍番号ごとの分析</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学籍番号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">閲覧時間</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">閲覧回数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Object.entries(studentAnalysis).map(([studentId, data]) => (
                <tr key={studentId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{studentId}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{data.totalViewTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{data.viewCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* グラフ表示部分 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-bold mb-4">🔍 選択された情報項目</h2>
          <Bar data={createHistogramData(columnSelectionData.columnCounts || {})} />
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-bold mb-4">🔄 使用されたソート条件</h2>
          <Bar data={createHistogramData(sortingData.sortColumnCounts || {})} />
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-bold mb-4">🔎 使用されたフィルター</h2>
          <Bar data={createHistogramData(filterUsageData.filterTypeCounts || {})} />
        </div>
      </div>
    </div>
  );
}

// メインコンポーネント
export default function AdminDashboard() {
  return (
    <AuthWrapper>
      <DashboardContent />
    </AuthWrapper>
  );
}