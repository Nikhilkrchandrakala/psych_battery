import React from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { LogOut, User, Menu, X, Shield, BookOpen, ClipboardList, Calendar, Users, LayoutDashboard, ArrowLeft, ExternalLink } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { cn } from '../lib/utils';

const Layout: React.FC = () => {
  const { user, profile, isAdminUser, logout, mainSiteUrl, adminPanelUrl } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
  };

  const handleBackToAdmin = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const isAssessorOrAdmin = profile?.role === 'assessor' || profile?.role === 'admin';
    const dest = isAssessorOrAdmin
      ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8080/Profile.html'
        : 'https://api.ssbwithisv.in/admin/Profile.html')
      : `${mainSiteUrl}/ProfileDashboard`;
    window.location.href = dest;
  };

  const navItems = [
    // Student-only: test dashboard
    { label: 'My Dashboard', path: '/', icon: LayoutDashboard, show: profile?.role === 'student' },
    // Assessors + Admins: candidate dossier list
    { label: 'Candidate Dossiers', path: '/assessor', icon: Users, show: profile?.role === 'assessor' || isAdminUser },
    // Admin only: admin hub
    { label: 'Admin Hub', path: '/admin', icon: Shield, show: isAdminUser },
  ];

  const activeItem = navItems.find(item => item.path === location.pathname);

  return (
    <div className="min-h-screen bg-app-bg text-app-text-main flex overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-app-sidebar border-r border-app-border flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <img 
              src="/assets/logo/ISV2.png" 
              alt="Logo" 
              className="w-10 h-10 object-contain rounded-full shadow-lg shadow-app-accent/20"
            />
            <span className="text-app-text-bright font-bold tracking-tight text-lg">SSB with ISV</span>
          </div>

          <nav className="space-y-1">
            {/* Back to Profile / Back to Admin Panel */}
            <a
              href={profile?.role === 'assessor' || profile?.role === 'admin'
                ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8080/Profile.html' : 'https://api.ssbwithisv.in/admin/Profile.html')
                : `${mainSiteUrl}/ProfileDashboard`
              }
              onClick={handleBackToAdmin}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group font-medium text-sm text-app-text-muted hover:text-app-accent hover:bg-app-accent/5 mb-4"
            >
              <ArrowLeft size={18} className="group-hover:text-app-accent transition-colors" />
              <span>{profile?.role === 'assessor' || profile?.role === 'admin' ? 'Back to Admin Panel' : 'Return to Profile'}</span>
              <ExternalLink size={12} className="ml-auto opacity-40" />
            </a>

            <div className="px-3 py-2 text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-3">
              Platform Suite
            </div>
            {navItems.filter(item => item.show).map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group font-medium text-sm",
                    isActive 
                      ? "bg-app-accent/15 text-app-accent shadow-sm" 
                      : "text-app-text-muted hover:text-app-text-bright hover:bg-white/5"
                  )}
                >
                  <Icon size={18} className={cn("transition-colors", isActive ? "text-app-accent" : "group-hover:text-app-text-bright")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-app-border bg-black/20">
          {user && (
            <div className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 rounded-full bg-app-card border border-app-border flex items-center justify-center shrink-0 overflow-hidden">
                {profile?.profileImage ? (
                  <img src={profile.profileImage} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-app-text-muted" />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <div className="text-xs font-bold text-app-text-bright truncate">{profile?.name}</div>
                <div className="text-[10px] text-app-text-muted uppercase font-black tracking-widest truncate">{profile?.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-app-text-muted hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-16 border-b border-app-border flex items-center justify-between px-8 bg-app-header sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 text-app-text-muted hover:bg-white/5 rounded-lg"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-sm font-bold text-app-text-bright flex items-center gap-2 uppercase tracking-widest">
              <span className="opacity-50 font-normal">Section /</span> {activeItem?.label || 'Overview'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-bold text-app-text-muted">
            <span className="hidden sm:inline bg-app-card px-3 py-1 rounded-full border border-app-border shadow-inner">
              SESSION: 2026 Q2
            </span>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-grow overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8 h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-app-sidebar p-6 flex flex-col animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <img 
                  src="/assets/logo/ISV2.png" 
                  alt="Logo" 
                  className="w-8 h-8 object-contain rounded-full"
                />
                <span className="text-app-text-bright font-bold tracking-tight text-lg">SSB with ISV</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 text-app-text-muted">
                <X size={24} />
              </button>
            </div>
            
            <nav className="space-y-4">
              {navItems.filter(item => item.show).map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-4 text-app-text-bright font-medium text-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon size={24} className="text-app-accent" />
                  {item.label}
                </Link>
              ))}
              <div className="pt-4 mt-4 border-t border-app-border space-y-4">
                <a
                  href={profile?.role === 'assessor' || profile?.role === 'admin'
                    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8080/Profile.html' : 'https://api.ssbwithisv.in/admin/Profile.html')
                    : `${mainSiteUrl}/ProfileDashboard`
                  }
                  className="flex items-center gap-4 text-app-accent font-medium text-lg"
                  onClick={handleBackToAdmin}
                >
                  <ArrowLeft size={24} />
                  {profile?.role === 'assessor' || profile?.role === 'admin' ? 'Back to Admin Panel' : 'Return to Profile'}
                </a>
                 <button
                  onClick={handleLogout}
                  className="flex items-center gap-4 text-red-400 font-medium text-lg"
                >
                  <LogOut size={24} />
                  Sign Out
                </button>
              </div>
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Layout;
