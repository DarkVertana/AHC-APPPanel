'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Auto-expand Medicines menu if we're on the medicines or category page
  useEffect(() => {
    if ((pathname === '/dashboard/medicines' || pathname === '/dashboard/medicines/category') && !expandedMenus.includes('medicines')) {
      setExpandedMenus([...expandedMenus, 'medicines']);
    }
  }, [pathname, expandedMenus]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      const currentPath = pathname;
      router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
    }
  }, [status, pathname, router]);

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970] mx-auto"></div>
          <p className="mt-4 text-[#7895b3]">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (status === 'unauthenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970] mx-auto"></div>
          <p className="mt-4 text-[#7895b3]">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Don't render if no session (still loading or error)
  if (!session && status !== 'loading') {
    return null;
  }

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuKey)
        ? prev.filter(key => key !== menuKey)
        : [...prev, menuKey]
    );
  };

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', hasSubmenu: false },
    { name: 'Users', href: '/dashboard/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', hasSubmenu: false },
    { name: 'Log Data', href: '/dashboard/log-data', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', hasSubmenu: false },
    { name: 'Medicines', href: '/dashboard/medicines', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', hasSubmenu: true, submenuKey: 'medicines' },
    { name: 'Blogs', href: '/dashboard/blogs', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', hasSubmenu: false },
    { name: 'Notifications', href: '/dashboard/notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', hasSubmenu: false },
    { name: 'FAQ', href: '/dashboard/faq', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', hasSubmenu: false },
    { name: 'Settings', href: '/dashboard/settings', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4', hasSubmenu: false },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-[#435970] text-white transition-all duration-300 flex flex-col shadow-lg`}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-[#7895b3]/30">
          {isSidebarOpen ? (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">MY AHC</h1>
                <div className="mt-0.5 mb-0.5 border-t border-[#ffffff]/30" />
                <span className="text-xs font-medium text-[#dfedfb] mt-0 block">control panel</span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-[#7895b3]/20 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#7895b3]/20 rounded-lg transition-colors w-full flex justify-center"
              aria-label="Toggle sidebar"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/dashboard/medicines' && pathname.startsWith('/dashboard/medicines')) || (item.href === '/dashboard/faq' && pathname.startsWith('/dashboard/faq'));
            const isExpanded = item.hasSubmenu && expandedMenus.includes(item.submenuKey || '');
            const currentCategory = searchParams.get('category');

            if (item.hasSubmenu && item.submenuKey === 'medicines') {
              return (
                <div key={item.href} className="space-y-1">
                  <button
                    onClick={() => toggleMenu('medicines')}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                      isActive
                        ? 'bg-gradient-to-r from-[#7895b3] to-[#6c7a89] text-white shadow-lg shadow-[#7895b3]/30'
                        : 'text-white/90 hover:bg-[#7895b3]/25 hover:text-white hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex-shrink-0 w-5 h-5 flex items-center justify-center transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={item.icon}
                          />
                        </svg>
                      </div>
                      {isSidebarOpen && (
                        <span className="font-semibold text-sm truncate">{item.name}</span>
                      )}
                    </div>
                    {isSidebarOpen && (
                      <svg
                        className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${isExpanded ? 'rotate-90' : ''} ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </button>
                  {isExpanded && isSidebarOpen && (
                    <div className="relative ml-6 mt-2 space-y-1.5 pl-2">
                      {/* Visual connector line */}
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#7895b3]/50 via-[#7895b3]/30 to-transparent rounded-full"></div>
                      
                      {/* Category Management Link */}
                      <Link
                        href="/dashboard/medicines/category"
                        className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-300 group ${
                          pathname === '/dashboard/medicines/category'
                            ? 'bg-gradient-to-r from-[#7895b3] to-[#6c7a89] text-white shadow-md shadow-[#7895b3]/20'
                            : 'text-white/75 hover:bg-[#7895b3]/20 hover:text-white hover:translate-x-1'
                        }`}
                      >
                        {/* Active indicator dot */}
                        {pathname === '/dashboard/medicines/category' && (
                          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-sm border-2 border-[#7895b3]"></div>
                        )}
                        <div className={`flex-shrink-0 w-4 h-4 flex items-center justify-center transition-transform duration-300 ${pathname === '/dashboard/medicines/category' ? 'scale-110' : 'group-hover:scale-110'}`}>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 6h16M4 10h16M4 14h16M4 18h16"
                            />
                          </svg>
                        </div>
                        <span className="font-medium truncate">Category</span>
                      </Link>
                      
                      {/* All Medicines Link */}
                      <Link
                        href="/dashboard/medicines"
                        className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-300 group ${
                          !currentCategory && pathname === '/dashboard/medicines'
                            ? 'bg-gradient-to-r from-[#7895b3] to-[#6c7a89] text-white shadow-md shadow-[#7895b3]/20'
                            : 'text-white/75 hover:bg-[#7895b3]/20 hover:text-white hover:translate-x-1'
                        }`}
                      >
                        {/* Active indicator dot */}
                        {!currentCategory && pathname === '/dashboard/medicines' && (
                          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-sm border-2 border-[#7895b3]"></div>
                        )}
                        <div className={`flex-shrink-0 w-4 h-4 flex items-center justify-center transition-transform duration-300 ${!currentCategory && pathname === '/dashboard/medicines' ? 'scale-110' : 'group-hover:scale-110'}`}>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                            />
                          </svg>
                        </div>
                        <span className="font-medium truncate">All</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7895b3] to-[#6c7a89] text-white shadow-lg shadow-[#7895b3]/30'
                    : 'text-white/90 hover:bg-[#7895b3]/25 hover:text-white hover:shadow-md'
                }`}
              >
                <div className={`flex-shrink-0 w-5 h-5 flex items-center justify-center transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={item.icon}
                    />
                  </svg>
                </div>
                {isSidebarOpen && (
                  <span className="font-semibold text-sm truncate">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#7895b3]/30">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="group flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 hover:bg-red-600/30 hover:text-white transition-all duration-300 w-full text-left hover:shadow-md"
          >
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>
            {isSidebarOpen && (
              <span className="font-semibold text-sm">Logout</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end">
          <div className="flex items-center gap-4">
            {/* User Profile */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="w-10 h-10 bg-[#435970] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {session?.user?.name
                  ? session.user.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : session?.user?.email
                  ? session.user.email[0].toUpperCase()
                  : 'U'}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-[#435970]">
                  {session?.user?.name || session?.user?.email || 'User'}
                </p>
                <p className="text-xs text-[#7895b3]">
                  {session?.user?.role === 'ADMIN' ? 'Administrator' : session?.user?.role || 'User'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970] mx-auto"></div>
          <p className="mt-4 text-[#7895b3]">Loading...</p>
        </div>
      </div>
    }>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}

