export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8 relative overflow-hidden">
      {/* Background Image dengan Overlay */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d')`,
            backgroundAttachment: 'fixed'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/85 via-teal-800/75 to-blue-900/85" />
        <div className="absolute inset-0 backdrop-blur-md md:backdrop-blur-sm" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 space-y-6 md:space-y-8 border border-white/20">
          {/* Logo Skeleton */}
          <div className="flex justify-center">
            <div className="w-48 h-16 md:w-56 md:h-20 bg-slate-200 rounded-lg animate-pulse" />
          </div>

          {/* Title Skeleton */}
          <div className="text-center space-y-3">
            <div className="h-8 md:h-9 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 bg-slate-200 rounded-lg animate-pulse w-3/4 mx-auto" />
          </div>

          {/* Button Skeleton */}
          <div className="h-12 md:h-14 bg-slate-200 rounded-xl animate-pulse" />

          {/* Legal Text Skeleton */}
          <div className="space-y-2">
            <div className="h-3 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 bg-slate-200 rounded animate-pulse w-5/6 mx-auto" />
          </div>
        </div>

        {/* Footer Text - Mobile Only */}
        <div className="h-4 bg-white/30 rounded-lg animate-pulse mt-6 lg:hidden w-3/4 mx-auto" />
      </div>
    </div>
  )
}
