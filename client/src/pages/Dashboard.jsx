import React, { useState, useEffect } from 'react';
import { Package, Users, TrendingUp, Clock, FileText, Upload } from 'lucide-react';
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

  const StatCard = ({ title, value, icon: Icon, color = 'blue' }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 text-${color}-600`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {stats.loading ? '...' : value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sales Quotation Memory System Overview
        </p>
      </div>

      {/* Error Alert */}
      {stats.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {stats.error}
              </div>
              <div className="mt-4">
                <button
                  onClick={loadDashboardData}
                  className="bg-red-100 px-2 py-1 text-xs font-medium text-red-800 rounded hover:bg-red-200"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Total Materials"
          value={stats.materials}
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Total Clients"
          value={stats.clients}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Total Quotes"
          value={stats.quotes || 0}
          icon={FileText}
          color="purple"
        />
        <StatCard
          title="Price Entries"
          value={stats.priceEntries || 0}
          icon={TrendingUp}
          color="orange"
        />
        <StatCard
          title="System Status"
          value={stats.health?.status === 'ok' ? 'Online' : 'Offline'}
          icon={Clock}
          color={stats.health?.status === 'ok' ? 'green' : 'red'}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Quick Actions
          </h3>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/quote-builder"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-300 hover:border-gray-400"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-primary-50 text-primary-600 ring-4 ring-white">
                  <FileText className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" aria-hidden="true" />
                  Create New Quote
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Build a new quotation with price suggestions
                </p>
              </div>
            </a>

            <a
              href="/import"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-300 hover:border-gray-400"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-600 ring-4 ring-white">
                  <Upload className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" aria-hidden="true" />
                  Import Master Data
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Load materials and clients from Memory.xlsx
                </p>
              </div>
            </a>

            <a
              href="/materials"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-300 hover:border-gray-400"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-600 ring-4 ring-white">
                  <Package className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" aria-hidden="true" />
                  Manage Materials
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  View and edit your materials catalog
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* System Info */}
      {stats.health && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              System Information
            </h3>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    stats.health.status === 'ok' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {stats.health.status === 'ok' ? 'Healthy' : 'Error'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Database</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    stats.health.database === 'connected' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {stats.health.database}
                  </span>
                </dd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
