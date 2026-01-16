export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#dfedfb] via-[#7895b3] to-[#435970] p-4">
      <div className="text-center space-y-6 max-w-md">
        {/* 404 Number */}
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-white drop-shadow-lg">404</h1>
          <h2 className="text-3xl font-semibold text-white">Page Not Found</h2>
        </div>

        {/* Message */}
        <p className="text-white/90 text-lg">
          Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
    </div>
  );
}

