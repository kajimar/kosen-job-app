import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabaseクライアントの作成
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function JobsPage() {
  const [companies, setCompanies] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([
    "年間休日", "給与"
  ]);
  const [sortConfig, setSortConfig] = useState({ key: "給与", direction: "asc" });
  const [filters, setFilters] = useState({
    hideUnknownHolidays: false,
    hideUnknownOvertime: false,
    hideUnknownWeeklyHoliday: false,
    hideUnknownSalary: false,
  });

  // スクロール深度と閲覧時間のトラッキング
  useEffect(() => {
    // 閲覧ログを記録する関数
    const recordViewLog = async () => {
      try {
        // 現在のログインユーザーを取得
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const studentId = user.email.split('@')[0];
          const startTime = new Date();

          // スクロール深度トラッキングの実装
          let maxScrollDepth = 0;
          
          const updateScrollDepth = () => {
            const scrollPosition = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            
            // スクロール深度をパーセンテージで計算
            const currentScrollDepth = Math.round(
              (scrollPosition + windowHeight) / documentHeight * 100
            );
            
            maxScrollDepth = Math.max(maxScrollDepth, currentScrollDepth);
          };

          // スクロールイベントリスナーを追加
          window.addEventListener('scroll', updateScrollDepth);

          // 初期ログエントリを挿入
          const { error: logError } = await supabase
            .from('view_logs')
            .insert({
              user_id: user.id,
              student_id: studentId,
              page: 'jobs',
              view_time: 0,
              article_id: null,
              scroll_depth: 0,
              timestamp: new Date().toISOString()
            });

          if (logError) {
            console.error("閲覧ログ記録エラー:", logError);
          }

          // ページ離脱時またはコンポーネントアンマウント時の処理
          const handlePageExit = async () => {
            // 閲覧時間を計算
            const endTime = new Date();
            const viewTimeSeconds = Math.round((endTime - startTime) / 1000);

            // 最新のログエントリを取得して更新
            const { data: latestLogs, error: fetchError } = await supabase
              .from('view_logs')
              .select('*')
              .eq('user_id', user.id)
              .eq('page', 'jobs')
              .order('timestamp', { ascending: false })
              .limit(1);

            if (fetchError) {
              console.error("最新ログ取得エラー:", fetchError);
              return;
            }

            if (latestLogs && latestLogs.length > 0) {
              // ログエントリを実際の閲覧時間とスクロール深度で更新
              const { error: updateError } = await supabase
                .from('view_logs')
                .update({ 
                  view_time: viewTimeSeconds,
                  scroll_depth: maxScrollDepth 
                })
                .eq('id', latestLogs[0].id);

              if (updateError) {
                console.error("閲覧ログ更新エラー:", updateError);
              }
            }

            // イベントリスナーを削除
            window.removeEventListener('scroll', updateScrollDepth);
          };

          // ページ離脱時のイベントリスナーを追加
          window.addEventListener('beforeunload', handlePageExit);

          // コンポーネントのクリーンアップ関数を返す
          return () => {
            window.removeEventListener('beforeunload', handlePageExit);
            handlePageExit(); // コンポーネントのアンマウント時にも更新
          };
        }
      } catch (err) {
        console.error("閲覧ログ記録中にエラー:", err);
      }
    };

    // 閲覧ログ記録を実行
    const cleanup = recordViewLog();

    // クリーンアップ関数を返す
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []); // 空の依存配列で初回のみ実行

  // 会社データの取得
  useEffect(() => {
    const fetchCompanies = async () => {
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*");

      if (companiesError) {
        console.error("Companies fetch error:", companiesError);
        return;
      }

      const { data: statsData, error: statsError } = await supabase
        .from("company_stats")
        .select("*");

      if (statsError) {
        console.error("Stats fetch error:", statsError);
        return;
      }

      const { data: employmentData, error: employmentError } = await supabase
        .from("employment_statistics")
        .select("*");

      if (employmentError) {
        console.error("Employment stats fetch error:", employmentError);
        return;
      }

      const mergedData = companiesData.map(company => {
        const stats = statsData.find(s => s.company_id === company.id) || {};
        const employment = employmentData.find(e => e.company_id === company.id) || {};

        return {
          id: company.id,
          企業名: company.name,
          従業員数: company.employees_count || "不明",
          学士卒採用数: stats.bachelor_graduates_count ?? "データなし",
          女性比率: stats.female_ratio ?? "データなし",
          採用人数: employment.recruited_count ?? "データなし",
          給与: company.salary ? `${Number(company.salary).toLocaleString()}円` : "不明",
          ボーナス: company.bonus || "不明",
          労働時間: company.working_hours ? `${company.working_hours} 時間` : "不明",
          年間休日: company.holidays_per_year ? `${company.holidays_per_year} 日` : "不明",
          残業時間: company.overtime_hours ? `${company.overtime_hours} 時間` : "不明",
          週休: company.weekly_holiday || "不明"
        };
      });

      setCompanies(mergedData);
    };

    fetchCompanies();
  }, []);

  // 列選択変更時のログ記録
  useEffect(() => {
    const recordColumnChange = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const studentId = user.email.split('@')[0];
          
          const { error } = await supabase.from('mvp_column_selections').insert({
            user_id: user.id,
            student_id: studentId,
            selected_colmns: selectedColumns,
            timestamp: new Date().toISOString()
          });
          
          if (error) {
            console.error("列選択変更記録エラー:", error);
          }
        }
      } catch (err) {
        console.error("列選択変更記録中にエラー:", err);
      }
    };
    
    // 初回レンダリング時は除外
    if (selectedColumns.length > 0) {
      recordColumnChange();
    }
  }, [selectedColumns]);

  // 企業データのフィルタリング
  const filteredCompanies = companies.filter((company) => {
    if (filters.hideUnknownHolidays && company.年間休日 === "不明") return false;
    if (filters.hideUnknownOvertime && company.残業時間 === "不明") return false;
    if (filters.hideUnknownWeeklyHoliday && company.週休 === "不明") return false;
    if (filters.hideUnknownSalary && company.給与 === "不明") return false;
    return true;
  });

  // 企業データのソート
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aValue = a[sortConfig.key] === "不明" ? "" : a[sortConfig.key];
    const bValue = b[sortConfig.key] === "不明" ? "" : b[sortConfig.key];

    return String(aValue).localeCompare(String(bValue), "ja", {
      numeric: true,
      sensitivity: "base",
    }) * (sortConfig.direction === "asc" ? 1 : -1);
  });

  // フィルタ切り替えハンドラ
  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ソート設定ハンドラ
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // 列表示切り替えハンドラ
  const toggleColumn = (column) => {
    setSelectedColumns((prevColumns) =>
      prevColumns.includes(column)
        ? prevColumns.filter((col) => col !== column)
        : [...prevColumns, column]
    );
  };

  // UIのレンダリング
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* フィルターセクション */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">
          不明データをフィルタリングするボタン
        </h3>
        <p className="text-sm text-gray-600 mb-4">以下のトグルスイッチを使って、不明なデータを持つ企業を表示/非表示できます。</p>
        
        <div className="flex flex-wrap gap-4">
          {/* フィルターボタン：トグルスイッチスタイル */}
          <div className="flex items-center">
            <button 
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${filters.hideUnknownHolidays ? 'bg-blue-600' : 'bg-gray-300'}`}
              onClick={() => toggleFilter('hideUnknownHolidays')}
              aria-pressed={filters.hideUnknownHolidays}
            >
              <span 
                className={`absolute left-0.5 inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300
                  ${filters.hideUnknownHolidays ? 'translate-x-6' : 'translate-x-0'}`} 
              />
            </button>
            <span className="ml-3 text-gray-700">
              休日不明
              <span className="text-xs ml-2 text-gray-500">
                {filters.hideUnknownHolidays ? '(非表示中)' : '(表示中)'}
              </span>
            </span>
          </div>
          
          <div className="flex items-center">
            <button 
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${filters.hideUnknownOvertime ? 'bg-blue-600' : 'bg-gray-300'}`}
              onClick={() => toggleFilter('hideUnknownOvertime')}
              aria-pressed={filters.hideUnknownOvertime}
            >
              <span 
                className={`absolute left-0.5 inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300
                  ${filters.hideUnknownOvertime ? 'translate-x-6' : 'translate-x-0'}`} 
              />
            </button>
            <span className="ml-3 text-gray-700">
              残業不明
              <span className="text-xs ml-2 text-gray-500">
                {filters.hideUnknownOvertime ? '(非表示中)' : '(表示中)'}
              </span>
            </span>
          </div>
          
          <div className="flex items-center">
            <button 
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${filters.hideUnknownWeeklyHoliday ? 'bg-blue-600' : 'bg-gray-300'}`}
              onClick={() => toggleFilter('hideUnknownWeeklyHoliday')}
              aria-pressed={filters.hideUnknownWeeklyHoliday}
            >
              <span 
                className={`absolute left-0.5 inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300
                  ${filters.hideUnknownWeeklyHoliday ? 'translate-x-6' : 'translate-x-0'}`} 
              />
            </button>
            <span className="ml-3 text-gray-700">
              週休不明
              <span className="text-xs ml-2 text-gray-500">
                {filters.hideUnknownWeeklyHoliday ? '(非表示中)' : '(表示中)'}
              </span>
            </span>
          </div>
          
          <div className="flex items-center">
            <button 
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${filters.hideUnknownSalary ? 'bg-blue-600' : 'bg-gray-300'}`}
              onClick={() => toggleFilter('hideUnknownSalary')}
              aria-pressed={filters.hideUnknownSalary}
            >
              <span 
                className={`absolute left-0.5 inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300
                  ${filters.hideUnknownSalary ? 'translate-x-6' : 'translate-x-0'}`} 
              />
            </button>
            <span className="ml-3 text-gray-700">
              給与不明
              <span className="text-xs ml-2 text-gray-500">
                {filters.hideUnknownSalary ? '(非表示中)' : '(表示中)'}
              </span>
            </span>
          </div>
        </div>
      </div>
      
      {/* 列選択セクション */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">
          表示する列を選択するボタン
        </h3>
        <p className="text-sm text-gray-600 mb-4">以下のボタンを使って、テーブルに表示する列を選択できます。</p>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {["従業員数", "学士卒採用数", "女性比率", "採用人数", "給与", "ボーナス", "労働時間", "年間休日", "残業時間", "週休"].map((column) => (
            <div 
              key={column} 
              className={`relative flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-200 
                ${selectedColumns.includes(column) 
                  ? 'bg-green-50 border-green-500 shadow-sm' 
                  : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}
              onClick={() => toggleColumn(column)}
            >
              <div 
                className={`flex justify-center items-center w-6 h-6 mr-2 rounded border 
                  ${selectedColumns.includes(column) 
                    ? 'bg-green-500 border-green-600 text-white' 
                    : 'bg-white border-gray-400'}`}
              >
                {selectedColumns.includes(column) && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-sm ${selectedColumns.includes(column) ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                {column}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* データテーブル */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[8rem]">
                  企業名
                </th>
                {selectedColumns.map((column) => (
                  <th
                    key={column}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 min-w-[8rem]"
                    onClick={() => requestSort(column)}
                  >
                    <div className="flex items-center">
                      <span>{column}</span>
                      <span className="ml-1">
                        {sortConfig.key === column && (
                          sortConfig.direction === "asc" 
                            ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                        )}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedCompanies.length > 0 ? (
                sortedCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 min-w-[8rem]">
                      {company.企業名}
                    </td>
                    {selectedColumns.map((column) => (
                      <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 min-w-[8rem]">
                        {company[column]}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td 
                    colSpan={selectedColumns.length + 1} 
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    該当する企業データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="py-2 px-4 text-xs text-gray-500 text-center border-t">
          表を横にスクロールすると、すべての列を見ることができます
        </div>
      </div>
    </div>
  );
}