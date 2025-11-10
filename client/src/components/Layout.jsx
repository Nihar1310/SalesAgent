import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Package, 
  Users, 
  FileText, 
  Upload,
  Mail,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronDown,
  Shield,
  UserCog
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Materials', href: '/materials', icon: Package },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Quote Builder', href: '/quote-builder', icon: FileText },
  { name: 'Import Data', href: '/import', icon: Upload },
  { name: 'Gmail Review', href: '/gmail-review', icon: Mail },
];

const adminNavigation = [
  { name: 'User Management', href: '/users', icon: UserCog, adminOnly: true },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, dbUser, role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Top Navigation Bar */}
      <nav className={classNames(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "glass-card shadow-lg" : "bg-white/80 backdrop-blur-md"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 sm:space-x-3 animate-slide-up group">
              <img 
                src="/assets/logo.png" 
                alt="Sales Memory Logo" 
                className="h-11 w-11 sm:h-12 sm:w-12 object-contain transition-transform duration-300 group-hover:scale-105"
              />
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-bold gradient-text font-display tracking-tight group-hover:text-blue-600 transition-colors">
                  Sales Memory
                </h1>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={classNames(
                      'flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300',
                      isActive
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                    )}
                  >
                    <item.icon className={classNames(
                      'h-5 w-5 mr-2',
                      isActive ? 'text-white' : 'text-gray-500'
                    )} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              {isAdmin && adminNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={classNames(
                      'flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300',
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                        : 'text-purple-700 hover:bg-purple-50 hover:text-purple-800'
                    )}
                  >
                    <item.icon className={classNames(
                      'h-5 w-5 mr-2',
                      isActive ? 'text-white' : 'text-purple-500'
                    )} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* User Menu */}
            <div className="hidden lg:flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition-all duration-300 group"
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">
                      {user?.phoneNumber?.slice(-2) || 'U'}
                    </span>
                  </div>
                  <div className="text-left hidden xl:block">
                    <p className="text-sm font-semibold text-gray-900">
                      {dbUser?.displayName || user?.phoneNumber || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center">
                      {role === 'super_admin' && <Shield className="h-3 w-3 mr-1 text-purple-600" />}
                      {role === 'super_admin' ? 'Admin' : role === 'staff' ? 'Staff' : 'Pending'}
                    </p>
                  </div>
                  <ChevronDown className={classNames(
                    'h-4 w-4 text-gray-500 transition-transform duration-300',
                    userMenuOpen ? 'rotate-180' : ''
                  )} />
                </button>

                {/* User Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 glass-card rounded-xl shadow-xl py-2 animate-slide-down">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors group"
                    >
                      <LogOut className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-gray-700 hover:bg-blue-50 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200/50 animate-slide-down">
            <div className="px-4 py-4 space-y-2 bg-white/95 backdrop-blur-md">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={classNames(
                      'flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300',
                      isActive
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-blue-50'
                    )}
                  >
                    <item.icon className={classNames(
                      'h-5 w-5 mr-3',
                      isActive ? 'text-white' : 'text-gray-500'
                    )} />
                    {item.name}
                  </Link>
                );
              })}
              
              {isAdmin && adminNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={classNames(
                      'flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300',
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                        : 'text-purple-700 hover:bg-purple-50'
                    )}
                  >
                    <item.icon className={classNames(
                      'h-5 w-5 mr-3',
                      isActive ? 'text-white' : 'text-purple-500'
                    )} />
                    {item.name}
                  </Link>
                );
              })}
              
              {/* Mobile User Section */}
              <div className="pt-4 border-t border-gray-200/50">
                <div className="flex items-center px-4 py-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">
                      {user?.phoneNumber?.slice(-2) || 'U'}
                    </span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {dbUser?.displayName || user?.phoneNumber || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center">
                      {role === 'super_admin' && <Shield className="h-3 w-3 mr-1 text-purple-600" />}
                      {role === 'super_admin' ? 'Admin' : role === 'staff' ? 'Staff' : 'Pending'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center px-4 py-3 glass-card rounded-xl text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50/50 transition-all duration-300 group"
                >
                  <LogOut className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="pt-20 px-4 lg:px-8 pb-8 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 px-4 lg:px-8 border-t border-gray-200/50 bg-white/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-600">
          <p className="flex items-center justify-center space-x-2">
            <span>Made with</span>
            <span className="text-red-500 animate-pulse">❤️</span>
            <span>by Sales Memory Team</span>
          </p>
        </div>
      </footer>
    </div>
  );
}