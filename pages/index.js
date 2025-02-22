import Head from 'next/head';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Head>
        <title>KNIT Link MVP</title>
        <meta name="description" content="KNIT Link Web版 MVP" />
      </Head>
      <h1 className="text-3xl font-bold text-blue-600">KNIT Link Web版 MVP</h1>
    </div>
  );
}
