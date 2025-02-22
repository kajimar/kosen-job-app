import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Bar } from 'react-chartjs-2';
// import Link from "next/link";  // 未使用のため削除

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

  const [columnSelectionData, setColumnSelectionData] = useState({});
  const [sortingData, setSortingData] = useState({});
  const [filterUsageData, setFilterUsageData] = useState({});

  // スクロール深度と閲覧時間のトラッキング関数
  const useViewLogging = () => {
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
  };

  // 既存のフックと同様に追加
  useViewLogging();

  // 以下は既存のコードと同じ（fetchCompanies、toggleColumn、toggleFilter等）
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

  useEffect(() => {
    // ヒストグラムデータの更新
    const updateHistogramData = () => {
      const columnCounts = {};
      selectedColumns.forEach(column => {
        columnCounts[column] = (columnCounts[column] || 0) + 1;
      });
      setColumnSelectionData(columnCounts);

      const sortCounts = {};
      if (sortConfig.key) {
        const key = `${sortConfig.key} (${sortConfig.direction === 'asc' ? '昇順' : '降順'})`;
        sortCounts[key] = (sortCounts[key] || 0) + 1;
      }
      setSortingData(sortCounts);

      const filterCounts = {};
      Object.keys(filters).forEach(filter => {
        if (filters[filter]) {
          filterCounts[filter] = (filterCounts[filter] || 0) + 1;
        }
      });
      setFilterUsageData(filterCounts);
    };

    updateHistogramData();
  }, [selectedColumns, sortConfig, filters]);

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

  // 残りのコードは以前と同じ（フィルタリング、ソート、レンダリングロジック）
  const filteredCompanies = companies.filter((company) => {
    if (filters.hideUnknownHolidays && company.年間休日 === "不明") return false;
    if (filters.hideUnknownOvertime && company.残業時間 === "不明") return false;
    if (filters.hideUnknownWeeklyHoliday && company.週休 === "不明") return false;
    if (filters.hideUnknownSalary && company.給与 === "不明") return false;
    return true;
  });

  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aValue = a[sortConfig.key] === "不明" ? "" : a[sortConfig.key];
    const bValue = b[sortConfig.key] === "不明" ? "" : b[sortConfig.key];

    return String(aValue).localeCompare(String(bValue), "ja", {
      numeric: true,
      sensitivity: "base",
    }) * (sortConfig.direction === "asc" ? 1 : -1);
  });

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const toggleColumn = (column) => {
    setSelectedColumns((prevColumns) =>
      prevColumns.includes(column)
        ? prevColumns.filter((col) => col !== column)
        : [...prevColumns, column]
    );
  };

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
      <div className="mb-4 space-x-2">
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => toggleFilter('hideUnknownHolidays')}>
          {filters.hideUnknownHolidays ? "❌ 休日不明" : "✅ 休日不明"}
        </button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => toggleFilter('hideUnknownOvertime')}>
          {filters.hideUnknownOvertime ? "❌ 残業不明" : "✅ 残業不明"}
        </button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => toggleFilter('hideUnknownWeeklyHoliday')}>
          {filters.hideUnknownWeeklyHoliday ? "❌ 週休不明" : "✅ 週休不明"}
        </button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => toggleFilter('hideUnknownSalary')}>
          {filters.hideUnknownSalary ? "❌ 給与不明" : "✅ 給与不明"}
        </button>
      </div>
      <div className="mb-4 space-x-2">
        {["従業員数", "学士卒採用数", "女性比率", "採用人数", "給与", "ボーナス", "労働時間", "年間休日", "残業時間", "週休"].map((column) => (
          <button
            key={column}
            className={`px-4 py-2 rounded ${selectedColumns.includes(column) ? 'bg-green-500 text-white' : 'bg-gray-300'}`}
            onClick={() => toggleColumn(column)}
          >
            {selectedColumns.includes(column) ? `✅ ${column}` : `❌ ${column}`}
          </button>
        ))}
      </div>
      <table className="min-w-full bg-white border">
        <thead>
          <tr>
            <th className="border-b-2 border-gray-300 px-4 py-2 text-left">企業名</th>
            {selectedColumns.map((column) => (
              <th
                key={column}
                className="border-b-2 border-gray-300 px-4 py-2 text-left cursor-pointer"
                onClick={() => requestSort(column)}
              >
                {column} {sortConfig.key === column ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedCompanies.map((company) => (
            <tr key={company.id} className="hover:bg-gray-100">
              <td className="border-b border-gray-300 px-4 py-2">{company.企業名}</td>
              {selectedColumns.map((column) => (
                <td key={column} className="border-b border-gray-300 px-4 py-2">
                  {company[column]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">🔍 選択された情報項目</h2>
        <Bar data={createHistogramData(columnSelectionData)} />
      </div>
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">🔄 使用されたソート条件</h2>
        <Bar data={createHistogramData(sortingData)} />
      </div>
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">🔎 使用されたフィルター</h2>
        <Bar data={createHistogramData(filterUsageData)} />
      </div>
    </div>
  );
}