import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function JobsPage() {
  const [companies, setCompanies] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([
    "従業員数",
    "学士卒採用数",
    "女性比率",
    "採用人数",
    "給与",
    "ボーナス",
    "労働時間",
    "年間休日",
    "残業時間",
    "週休"
  ]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [filters, setFilters] = useState({
    hideUnknownHolidays: false,
    hideUnknownOvertime: false,
    hideUnknownWeeklyHoliday: false,
    hideUnknownSalary: false,
  });

  useEffect(() => {
    const fetchCompanies = async () => {
      // まず companies テーブルからデータを取得
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

  const toggleColumn = (column) => {
    setSelectedColumns((prevColumns) =>
      prevColumns.includes(column)
        ? prevColumns.filter((col) => col !== column)
        : [...prevColumns, column]
    );
  };

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const allColumns = [
    "従業員数",
    "学士卒採用数",
    "女性比率",
    "採用人数",
    "給与",
    "ボーナス",
    "労働時間",
    "年間休日",
    "残業時間",
    "週休"
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="bg-white p-6 rounded-lg shadow-md max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">就職先企業一覧</h2>

        {/* コントロールパネル */}
        <div className="mb-6 space-y-4">
          {/* 列の表示切り替え */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">表示する列:</h3>
            <div className="flex flex-wrap gap-2">
              {allColumns.map((column) => (
                <button
                  key={column}
                  onClick={() => toggleColumn(column)}
                  className={`
                    px-4 py-2 rounded-md transition-colors duration-200
                    ${selectedColumns.includes(column)
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white text-gray-700 border border-gray-300"}
                    hover:opacity-80
                  `}
                >
                  <span className="mr-2">
                    {selectedColumns.includes(column) ? "✓" : "×"}
                  </span>
                  {column}
                </button>
              ))}
            </div>
          </div>

          {/* フィルター切り替え */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">フィルター設定:</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleFilter("hideUnknownSalary")}
                className={`
                  px-4 py-2 rounded-md transition-colors duration-200
                  ${filters.hideUnknownSalary
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300"}
                  hover:opacity-80
                `}
              >
                <span className="mr-2">
                  {filters.hideUnknownSalary ? "✓" : "×"}
                </span>
                給与不明を非表示
              </button>
              <button
                onClick={() => toggleFilter("hideUnknownHolidays")}
                className={`
                  px-4 py-2 rounded-md transition-colors duration-200
                  ${filters.hideUnknownHolidays
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300"}
                  hover:opacity-80
                `}
              >
                <span className="mr-2">
                  {filters.hideUnknownHolidays ? "✓" : "×"}
                </span>
                休日不明を非表示
              </button>
              <button
                onClick={() => toggleFilter("hideUnknownOvertime")}
                className={`
                  px-4 py-2 rounded-md transition-colors duration-200
                  ${filters.hideUnknownOvertime
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300"}
                  hover:opacity-80
                `}
              >
                <span className="mr-2">
                  {filters.hideUnknownOvertime ? "✓" : "×"}
                </span>
                残業不明を非表示
              </button>
              <button
                onClick={() => toggleFilter("hideUnknownWeeklyHoliday")}
                className={`
                  px-4 py-2 rounded-md transition-colors duration-200
                  ${filters.hideUnknownWeeklyHoliday
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300"}
                  hover:opacity-80
                `}
              >
                <span className="mr-2">
                  {filters.hideUnknownWeeklyHoliday ? "✓" : "×"}
                </span>
                週休不明を非表示
              </button>
            </div>
          </div>
        </div>

         {/* 企業一覧テーブル */}
         {/* 企業一覧テーブル */}
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th 
                  scope="col" 
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    backgroundColor: '#F9FAFB',
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827',
                    border: '2px solid #E5E7EB'
                  }}
                >
                  企業名
                </th>
                {selectedColumns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    style={{
                      padding: '14px 12px',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#111827',
                      backgroundColor: '#F9FAFB',
                      border: '2px solid #E5E7EB',
                      cursor: 'pointer'
                    }}
                    onClick={() => requestSort(col)}
                  >
                    <div style={{ display: 'inline-flex' }}>
                      {col}
                      {sortConfig.key === col && (
                        <span style={{ marginLeft: '8px' }}>
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCompanies.map((company) => (
                <tr key={company.id}>
                  <td style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    backgroundColor: 'white',
                    padding: '16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#111827',
                    border: '1px solid #E5E7EB'
                  }}>
                    <Link 
                      href={`/jobs/${company.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      {company.企業名}
                    </Link>
                  </td>
                  {selectedColumns.map((col) => (
                    <td 
                      key={col}
                      style={{
                        padding: '16px 12px',
                        fontSize: '14px',
                        color: '#6B7280',
                        textAlign: 'center',
                        border: '1px solid #E5E7EB'
                      }}
                    >
                      {company[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}