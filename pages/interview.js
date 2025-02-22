import { useState, useEffect } from 'react';
import Link from 'next/link';

const mockInterviews = [
  { id: 1, title: '卒業生Aのインタビュー', summary: '卒業後のキャリアについて' },
  { id: 2, title: '卒業生Bのインタビュー', summary: '起業の道を選んだ理由' },
];

export default function Interviews() {
  const [interviews, setInterviews] = useState([]);

  useEffect(() => {
    setInterviews(mockInterviews); // 実際には外部CMSやデータソースから取得
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-4">卒業生インタビュー</h2>
        <ul>
          {interviews.map((interview) => (
            <li key={interview.id} className="border-b py-2">
              <Link href={`/interviews/${interview.id}`}>
                <a className="text-blue-600 font-bold hover:underline">{interview.title}</a>
              </Link>
              <p>{interview.summary}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
