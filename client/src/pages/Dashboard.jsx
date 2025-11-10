import React, { useState, useEffect } from 'react';
import { Package, Users, TrendingUp, Clock, FileText, Upload, Sparkles, ArrowRight, Zap, BarChart3 } from 'lucide-react';
import { analyticsAPI, healthAPI } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    materials: 0,
    clients: 0,
    loading: true,
    error: null
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));
      
      const [analyticsRes, healthRes] = await Promise.all([
        analyticsAPI.getDashboard(),
        healthAPI.check()
      ]);

      const analytics = analyticsRes.data;
      
      setStats({
        materials: analytics.materials?.total || 0,
        clients: analytics.clients?.total || 0,
        quotes: analytics.quotes?.total_quotes || 0,
        priceEntries: analytics.prices?.total_entries || 0,
        loading: false,
        error: null,
        health: healthRes.data,
        analytics: analytics
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dashboard data'
      }));
    }
  };

  const StatCard = ({ title, value, icon: Icon, color = 'blue', gradient, index = 0 }) => (
    <div 
      className="stat-card animate-slide-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <dt className="text-sm font-medium text-gray-600 mb-2">
            {title}
          </dt>
          <dd className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            {stats.loading ? (
              <div className="shimmer h-8 w-20 rounded"></div>
            ) : (
              <span className="animate-scale-in">{value}</span>
            )}
          </dd>
        </div>
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg`}>
          <Icon className="h-7 w-7 text-white" />
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm">
        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
        <span className="text-green-600 font-medium">Active</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden glass-card p-8 lg:p-12 animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 animate-gradient-x"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg animate-glow">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <span className="px-4 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              Welcome Back
            </span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-3 font-display">
            <span className="gradient-text">Sales Dashboard</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mb-6">
            Your intelligent quotation memory system. Track materials, manage clients, and build quotes with AI-powered price suggestions.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/quote-builder"
              className="btn-gradient inline-flex items-center group"
            >
              <Zap className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
              Create Quote
              <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="/import"
              className="glass-card px-6 py-3 rounded-xl font-medium text-gray-700 hover:text-blue-600 transition-all duration-300 hover:scale-105 active:scale-95 inline-flex items-center"
            >
              <Upload className="h-5 w-5 mr-2" />
              Import Data
            </a>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {stats.error && (
        <div className="glass-card border-l-4 border-red-500 p-4 animate-slide-down">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-1">
                Error Loading Data
              </h3>
              <div className="text-sm text-red-700">
                {stats.error}
              </div>
              <button
                onClick={loadDashboardData}
                className="mt-3 px-4 py-2 bg-red-100 text-red-800 text-xs font-medium rounded-lg hover:bg-red-200 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 font-display flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-blue-600" />
            Overview
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Total Materials"
            value={stats.materials}
            icon={Package}
            gradient="from-blue-500 to-blue-600"
            index={0}
          />
          <StatCard
            title="Total Clients"
            value={stats.clients}
            icon={Users}
            gradient="from-green-500 to-emerald-600"
            index={1}
          />
          <StatCard
            title="Total Quotes"
            value={stats.quotes || 0}
            icon={FileText}
            gradient="from-purple-500 to-purple-600"
            index={2}
          />
          <StatCard
            title="Price Entries"
            value={stats.priceEntries || 0}
            icon={TrendingUp}
            gradient="from-orange-500 to-orange-600"
            index={3}
          />
          <StatCard
            title="System Status"
            value={stats.health?.status === 'ok' ? 'Online' : 'Offline'}
            icon={Clock}
            gradient={stats.health?.status === 'ok' ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'}
            index={4}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-6 lg:p-8 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <h3 className="text-2xl font-bold text-gray-900 mb-6 font-display">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <a
            href="/quote-builder"
            className="group relative glass-card p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="inline-flex p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl shadow-lg mb-4 group-hover:scale-110 transition-transform">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                Create New Quote
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Build a new quotation with AI-powered price suggestions
              </p>
              <div className="flex items-center text-blue-600 font-medium text-sm group-hover:translate-x-2 transition-transform">
                Get Started
                <ArrowRight className="h-4 w-4 ml-1" />
              </div>
            </div>
          </a>

          <a
            href="/import"
            className="group relative glass-card p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="inline-flex p-4 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl shadow-lg mb-4 group-hover:scale-110 transition-transform">
                <Upload className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
                Import Master Data
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Load materials and clients from Memory.xlsx
              </p>
              <div className="flex items-center text-green-600 font-medium text-sm group-hover:translate-x-2 transition-transform">
                Import Now
                <ArrowRight className="h-4 w-4 ml-1" />
              </div>
            </div>
          </a>

          <a
            href="/materials"
            className="group relative glass-card p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="inline-flex p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl shadow-lg mb-4 group-hover:scale-110 transition-transform">
                <Package className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                Manage Materials
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                View and edit your materials catalog
              </p>
              <div className="flex items-center text-purple-600 font-medium text-sm group-hover:translate-x-2 transition-transform">
                View Catalog
                <ArrowRight className="h-4 w-4 ml-1" />
              </div>
            </div>
          </a>
        </div>
      </div>

      {/* System Info */}
      {stats.health && (
        <div className="glass-card p-6 lg:p-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <h3 className="text-xl font-bold text-gray-900 mb-6 font-display">
            System Information
          </h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl">
              <dt className="text-sm font-medium text-gray-600 mb-2">Status</dt>
              <dd className="flex items-center">
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                  stats.health.status === 'ok' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <span className={`h-2 w-2 rounded-full mr-2 ${
                    stats.health.status === 'ok' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></span>
                  {stats.health.status === 'ok' ? 'Healthy' : 'Error'}
                </span>
              </dd>
            </div>
            <div className="p-4 bg-gradient-to-br from-gray-50 to-purple-50/30 rounded-xl">
              <dt className="text-sm font-medium text-gray-600 mb-2">Database</dt>
              <dd className="flex items-center">
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                  stats.health.database === 'connected' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <span className={`h-2 w-2 rounded-full mr-2 ${
                    stats.health.database === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></span>
                  {stats.health.database}
                </span>
              </dd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}