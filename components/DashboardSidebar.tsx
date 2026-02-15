'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getLiveStats } from '@/app/actions/stats';

function UsageMiniStats() {
  const [stats, setStats] = useState({ cpu: 0, ram: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getLiveStats();
      if (data && data.length > 0) {
        setStats({
          cpu: data[0].cpu_percent,
          ram: data[0].ram_percent
        });
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const getBarColor = (percent: number) => {
    if (percent > 90) return 'bg-red-500';
    if (percent > 70) return 'bg-amber-500';
    return 'bg-sky-600';
  };

  const getTextColor = (percent: number) => {
    if (percent > 90) return 'text-red-600 font-bold';
    return 'text-sky-700';
  };

  return (
    <div className="space-y-4 mb-5">
      <div className="group">
        <div className="flex justify-between mb-1.5 font-mono">
          <span className="text-gray-400">CPU</span>
          <span className={getTextColor(stats.cpu)}>{stats.cpu}%</span>
        </div>
        <div className="w-full bg-sky-100 h-1.5 overflow-hidden">
          <div 
            className={`${getBarColor(stats.cpu)} h-full transition-all duration-1000 ease-out`} 
            style={{ width: `${stats.cpu}%` }}
          ></div>
        </div>
      </div>
      
      <div className="group">
        <div className="flex justify-between mb-1.5 font-mono">
          <span className="text-gray-400">RAM</span>
          <span className={getTextColor(stats.ram)}>{stats.ram}%</span>
        </div>
        <div className="w-full bg-sky-100 h-1.5 overflow-hidden">
          <div 
            className={`${getBarColor(stats.ram)} h-full transition-all duration-1000 ease-out`} 
            style={{ width: `${stats.ram}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'fa-chart-line' },
    { name: 'Projects', path: '/projects', icon: 'fa-network-wired' },
    { name: 'Deployments', path: '/deployments', icon: 'fa-rocket' },
    { name: 'Maintenance', path: '/maintenance', icon: 'fa-screwdriver-wrench' },
    { name: 'Settings', path: '/settings', icon: 'fa-cogs' },
  ];

  return (
    <nav className="h-full bg-white flex flex-col py-6 border-r border-gray-100">
      <div className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`
                px-6 py-3 text-sm flex items-center gap-4 transition-all duration-300
                ${isActive 
                  ? 'bg-sky-50 text-sky-900 font-bold border-r-4 border-sky-600' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-sky-700'}
              `}
            >
              <i className={`fa-solid ${item.icon} w-5 text-center ${isActive ? 'text-sky-600' : 'text-gray-400'}`}></i>
              <span className="tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </div>
      
      <div className="mt-auto px-6 py-6">
        <div className="bg-white border border-gray-100 p-5 shadow-sm rounded-sm">
          <div className="text-[10px] font-black mb-4 uppercase tracking-[0.2em] text-gray-400 border-b border-gray-50 pb-2">
            Node Resources
          </div>
          
          <UsageMiniStats />

          <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </div>
            <span className="text-[10px] font-mono font-bold text-sky-900 uppercase tracking-widest">
              Nydus Online
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}