import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
// import Link from "next/link";  // 未使用のため削除

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function JobsPage() {
  const [companies, setCompanies] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([
    "従業員数", "学士卒採用数", "女性比率", "採用人数", 
    "給与", "ボーナス", "労働時間", "年間休日", "残業時間", "週休"
  ]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState({
    hideUnknownHolidays: false,
    hideUnknownOvertime: false,
    hideUnknownWeeklyHoliday: false,
    hideUnknownSalary: false,
  });

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
      // 企業データ取得のロジック（以前と同じ）
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*");

      if (companiesError) {
        console.error("Companies fetch error:", companiesError);
        return;
      }

      // company_stats データを取得
      const { data: statsData, error: statsError } = await supabase
        .from("company_stats")
        .select("*");

      if (statsError) {
        console.error("Stats fetch error:", statsError);
        return;
      }

      // employment_statistics データを取得
      const { data: employmentData, error: employmentError } = await supabase
        .from("employment_statistics")
        .select("*");

      if (employmentError) {
        console.error("Employment stats fetch error:", employmentError);
        return;
      }

      // データを結合
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

  // 以下は既存のメソッド（toggleColumn、toggleFilter、requestSort等）
  const toggleColumn = (column) => {
    setSelectedColumns((prevColumns) =>
      prevColumns.includes(column)
        ? prevColumns.filter((col) => col !== column)
        : [...prevColumns, column]
    );
  };

  const toggleFilter = (key) => {
    const recordFilterUsage = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const studentId = user.email.split('@')[0];
          
          const { error } = await supabase.from('mvp_filter_operations').insert({
            user_id: user.id,
            student_id: studentId,
            filter_type: key,
            filter_value: !filters[key],
            timestamp: new Date().toISOString()
          });
          
          if (error) {
            console.error("フィルター使用記録エラー:", error);
          }
        }
      } catch (err) {
        console.error("フィルター使用記録中にエラー:", err);
      }
    };
    
    recordFilterUsage();
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  const requestSort = (key) => {
    const recordSortOperation = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const studentId = user.email.split('@')[0];
          
          let direction = "asc";
          if (sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
          }
          
          const { error } = await supabase.from('mvp_sort_operations').insert({
            user_id: user.id,
            student_id: studentId,
            sort_column: key,
            sort_direction: direction,
            timestamp: new Date().toISOString()
          });
          
          if (error) {
            console.error("ソート操作記録エラー:", error);
          }
        }
      } catch (err) {
        console.error("ソート操作記録中にエラー:", err);
      }
    };
    
    recordSortOperation();
    
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // レンダリングのためのコードは以前と同じ
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* 既存のレンダリングロジック */}
    </div>
  );
}