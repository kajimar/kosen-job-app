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
    showOnlyBookmarks: false,
  });

  // ブックマーク機能の状態とロジック
  const [bookmarks, setBookmarks] = useState(new Set());
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // ブックマークの初期読み込み
  useEffect(() => {
    const fetchBookmarks = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: bookmarksData, error } = await supabase
          .from('bookmarks')
          .select('company_id')
          .eq('user_id', user.id);

        if (!error && bookmarksData) {
          setBookmarks(new Set(bookmarksData.map(b => b.company_id)));
        }
      }
    };

    fetchBookmarks();
  }, []);

  // ブックマークの切り替え処理
  const toggleBookmark = async (companyId) => {
    setBookmarkLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isBookmarked = bookmarks.has(companyId);
      if (isBookmarked) {
        // ブックマーク削除
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('company_id', companyId);

        if (!error) {
          const newBookmarks = new Set(bookmarks);
          newBookmarks.delete(companyId);
          setBookmarks(newBookmarks);
        }
      } else {
        // ブックマーク追加
        const { error } = await supabase
          .from('bookmarks')
          .insert({
            user_id: user.id,
            company_id: companyId
          });

        if (!error) {
          const newBookmarks = new Set(bookmarks);
          newBookmarks.add(companyId);
          setBookmarks(newBookmarks);
        }
      }
    } catch (error) {
      console.error('ブックマーク処理エラー:', error);
    } finally {
      setBookmarkLoading(false);
    }
  };

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

  // フィルタリングロジック
  const filteredCompanies = companies.filter((company) => {
    // ブックマークフィルターを追加
    if (filters.showOnlyBookmarks && !bookmarks.has(company.id)) return false;
    
    // 既存のフィルター
    if (filters.hideUnknownHolidays && company.年間休日 === "不明") return false;
    if (filters.hideUnknownOvertime && company.残業時間 === "不明") return false;
    if (filters.hideUnknownWeeklyHoliday && company.週休 === "不明") return false;
    if (filters.hideUnknownSalary && company.給与 === "不明") return false;
    return true;
  });

  // 企業データのソート
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (!sortConfig.key) return 0;

    // 数値を含む可能性のあるカラムを定義
    const numericColumns = ["給与", "年間休日", "残業時間", "従業員数"];
    
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    // "不明"の場合の処理
    if (aValue === "不明" || aValue === "データなし") aValue = "";
    if (bValue === "不明" || bValue === "データなし") bValue = "";

    // 数値を含むカラムの場合、数値部分のみを抽出してソート
    if (numericColumns.includes(sortConfig.key)) {
      const aNum = Number(String(aValue).replace(/[^0-9.-]/g, ''));
      const bNum = Number(String(bValue).replace(/[^0-9.-]/g, ''));
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return (aNum - bNum) * (sortConfig.direction === "asc" ? 1 : -1);
      }
    }

    // 文字列の場合は通常の比較
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
          フィルター
        </h3>
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
              年間休日
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
              残業時間
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
              週休
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
              給与
              <span className="text-xs ml-2 text-gray-500">
                {filters.hideUnknownSalary ? '(非表示中)' : '(表示中)'}
              </span>
            </span>
          </div>

          {/* ブックマークフィルター */}
          <div className="flex items-center">
            <button 
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${filters.showOnlyBookmarks ? 'bg-blue-600' : 'bg-gray-300'}`}
              onClick={() => setFilters(prev => ({ ...prev, showOnlyBookmarks: !prev.showOnlyBookmarks }))}
              aria-pressed={filters.showOnlyBookmarks}
            >
              <span 
                className={`absolute left-0.5 inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300
                  ${filters.showOnlyBookmarks ? 'translate-x-6' : 'translate-x-0'}`} 
              />
            </button>
            <span className="ml-3 text-gray-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" 
                   className={`h-5 w-5 mr-1 ${filters.showOnlyBookmarks ? 'text-blue-500' : 'text-gray-400'}`} 
                   viewBox="0 0 20 20" 
                   fill="currentColor">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
              </svg>
              ブックマーク済み
              <span className="text-xs ml-2 text-gray-500">
                {filters.showOnlyBookmarks ? '(表示中)' : '(すべて表示中)'}
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
        {/* テーブル上部のスクロールガイダンス */}
        <div className="py-3 px-4 text-sm text-gray-600 text-center border-b bg-gray-50 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          横にスワイプするとすべてのデータを確認できます
        </div>
        
        <div className="relative">
          {/* スクロールインジケーター */}
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-gray-100 to-transparent z-10 pointer-events-none flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          
          <div className="overflow-x-auto w-full pb-2">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    ブックマーク
                  </th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-16">
                        <button
                          onClick={() => toggleBookmark(company.id)}
                          disabled={bookmarkLoading}
                          className={`hover:text-blue-600 focus:outline-none disabled:opacity-50 border-2 rounded ${
                            bookmarks.has(company.id) ? 'border-blue-500' : 'border-gray-300'
                          }`}
                        >
                          {bookmarks.has(company.id) ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td 
                      colSpan={selectedColumns.length + 2} 
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      該当する企業データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}