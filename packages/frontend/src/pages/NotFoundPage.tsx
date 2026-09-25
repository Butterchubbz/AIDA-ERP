export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-slate-100">
      <h1 className="text-6xl font-black text-cyan-400 mb-4">404</h1>
      <p className="text-xl text-slate-400 mb-8">Page not found</p>
      <a
        href="/"
        className="px-6 py-3 bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors font-medium"
      >
        Back to Dashboard
      </a>
    </div>
  );
}
