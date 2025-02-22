import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';

const Bar = dynamic(() => import('react-chartjs-2').then((mod) => mod.Bar), { ssr: false });
import 'chart.js/auto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminDashboard() {
  const [columnSelectionData, setColumnSelectionData] = useState({});
  const [sortingData, setSortingData] = useState({});
  const [filterUsageData, setFilterUsageData] = useState({});

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

          // 学籍番号を付加した閲覧ログを作成
          const enrichedViewLogs = (viewLogs || []).map(log => {
            // user_idを使って認証ユーザーを検索
            const user = processedUsersData.find(u => u.id === log.user_id);
            return {
              ...log,
              studentId: log.student_id || user?.studentId || 'unknown'
            };
          });
          
          // setJobViewData(enrichedViewLogs); // 未使用のため削除
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
      } finally {
        // setLoading(false); // 未使用のため削除
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

  const createHistogramData = (data) => ({
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
  });

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4">管理者ダッシュボード</h1>
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">🔍 選択された情報項目</h2>
        <Bar data={createHistogramData(columnSelectionData.columnCounts || {})} />
      </div>
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">🔄 使用されたソート条件</h2>
        <Bar data={createHistogramData(sortingData.sortColumnCounts || {})} />
      </div>
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">🔎 使用されたフィルター</h2>
        <Bar data={createHistogramData(filterUsageData.filterTypeCounts || {})} />
      </div>
    </div>
  );
}