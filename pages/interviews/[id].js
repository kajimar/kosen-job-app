import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

const mockInterviews = [
  { id: 1, title: '卒業生Aのインタビュー', content: '卒業後のキャリアについての詳細な内容...' },
  { id: 2, title: '卒業生Bのインタビュー', content: '起業の道を選んだ理由と経験談...' },
];

export default function InterviewDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [interview, setInterview] = useState(null);

  useEffect(() => {
    if (id) {
      const data = mockInterviews.find((item) => item.id === parseInt(id));
      setInterview(data);
    }
  }, [id]);

  if (!interview) {
    return <p className="text-center text-gray-600">記事が見つかりません</p>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-4">{interview.title}</h2>
        <p>{interview.content}</p>
      </div>
    </div>
  );
}