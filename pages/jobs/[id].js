import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function JobsListPage() {
  const [companies, setCompanies] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([
    "industry",
    "employees",
    "bachelor_graduate_count",
    "female_ratio",
    "recruited_count",
  ]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    const fetchCompanies = async () => {
      let { data, error } = await supabase
        .from("companies")
        .select(`
          id, name, location, employees,
          company_stats(bachelor_graduate_count, bachelor_managers_count, female_ratio),
          employment_statistics(recruited_count, year),
          company_industries(industry_id),
          industries(industry_name)
        `);
      if (error) {
        console.error("🚨 データ取得エラー:", error);
        return;
      }
      
      // `company_stats`, `employment_statistics`, `industries` から値を取り出す
      const formattedData = data.map((company) => ({
        id: company.id,
        name: company.name,
        industry: company.industries?.industry_name || "不明",
        employees: company.employees || "不明",
        bachelor_graduate_count: company.company_stats?.bachelor_graduate_count || 0,
        female_ratio: company.company_stats?.female_ratio || 0,
        recruited_count: company.employment_statistics?.recruited_count || 0,
        year: company.employment_statistics?.year || "不明",
      }));

      setCompanies(formattedData);
    };

    fetchCompanies();
  }, []);

  // 列の表示切り替え
  const toggleColumn = (column) => {
    setSelectedColumns((prevColumns) =>
      prevColumns.includes(column)
        ? prevColumns.filter((col) => col !== column)
        : [...prevColumns, column]
    );
  };

  // ソート処理
  const sortedCompanies = [...companies].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="bg-white p-6 rounded shadow-md max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-4 text-center">就職先企業一覧</h2>

        {/* 列の選択 UI */}
        <div className="mb-4 flex flex-wrap gap-3">
          {[
            { key: "industry", label: "業種" },
            { key: "employees", label: "従業員数" },
            { key: "bachelor_graduate_count", label: "学士卒の人数" },
            { key: "female_ratio", label: "女性比率 (%)" },
            { key: "recruited_count", label: "採用人数" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedColumns.includes(key)}
                onChange={() => toggleColumn(key)}
                className="w-4 h-4"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {/* 企業一覧テーブル */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-gray-200">
                <th className="border px-4 py-2">企業名</th>
                {selectedColumns.includes("industry") && (
                  <th className="border px-4 py-2">業種</th>
                )}
                {selectedColumns.includes("employees") && (
                  <th className="border px-4 py-2 cursor-pointer" onClick={() => requestSort("employees")}>
                    従業員数 {sortConfig.key === "employees" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                  </th>
                )}
                {selectedColumns.includes("bachelor_graduate_count") && (
                  <th className="border px-4 py-2 cursor-pointer" onClick={() => requestSort("bachelor_graduate_count")}>
                    学士卒の人数 {sortConfig.key === "bachelor_graduate_count" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                  </th>
                )}
                {selectedColumns.includes("female_ratio") && (
                  <th className="border px-4 py-2 cursor-pointer" onClick={() => requestSort("female_ratio")}>
                    女性比率 (%) {sortConfig.key === "female_ratio" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                  </th>
                )}
                {selectedColumns.includes("recruited_count") && (
                  <th className="border px-4 py-2 cursor-pointer" onClick={() => requestSort("recruited_count")}>
                    採用人数 {sortConfig.key === "recruited_count" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedCompanies.map((company) => (
                <tr key={company.id} className="border">
                  <td className="border px-4 py-2">
                    <Link href={`/jobs/${company.id}`}>
                      <span className="text-blue-600 font-bold hover:underline cursor-pointer">
                        {company.name}
                      </span>
                    </Link>
                  </td>
                  {selectedColumns.includes("industry") && (
                    <td className="border px-4 py-2">{company.industry}</td>
                  )}
                  {selectedColumns.includes("employees") && (
                    <td className="border px-4 py-2">{company.employees}</td>
                  )}
                  {selectedColumns.includes("bachelor_graduate_count") && (
                    <td className="border px-4 py-2">{company.bachelor_graduate_count}</td>
                  )}
                  {selectedColumns.includes("female_ratio") && (
                    <td className="border px-4 py-2">{company.female_ratio}%</td>
                  )}
                  {selectedColumns.includes("recruited_count") && (
                    <td className="border px-4 py-2">{company.recruited_count}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
