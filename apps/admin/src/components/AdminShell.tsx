'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShieldCheck,
  UtensilsCrossed,
  AlertTriangle,
  History,
  Sliders,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/verifications', label: 'Verification Queue', icon: ShieldCheck, badge: '1' },
    { href: '/listings', label: 'Food Listings', icon: UtensilsCrossed },
    { href: '/safety', label: 'Safety & Disputes', icon: AlertTriangle, alertBadge: '1' },
    { href: '/audit', label: 'Audit Trail', icon: History },
    { href: '/config', label: 'Platform Config', icon: Sliders },
  ];

  return (
    <div className="admin-layout">
      {/* Navigation Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="brand-icon">
            <HeartHandshake size={20} />
          </div>
          <div>
            <div className="brand-text">SharePlate</div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>OPERATIONS CONSOLE</div>
          </div>
          <span className="brand-badge">PROD</span>
        </div>

        <ul className="nav-links">
          <div className="nav-section-title">Core Operations</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
                <Link href={item.href}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-counter">{item.badge}</span>}
                  {item.alertBadge && <span className="nav-counter alert">{item.alertBadge}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="sidebar-footer">
          <div className="user-avatar">PS</div>
          <div className="user-info">
            <span className="user-name">Priya Sharma</span>
            <span className="user-role">Lead Platform Admin</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="admin-main">
        <header className="admin-header">
          <div className="header-title-block">
            <h1>Food Rescue Management Console</h1>
            <p>SDG 2 (Zero Hunger) & SDG 12 (Responsible Consumption) Operations</p>
          </div>

          <div className="header-actions">
            <div className="status-pill">
              <div className="pulsing-dot" />
              <span>PostgreSQL RLS Active</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '5px 12px',
                borderRadius: '9999px',
              }}
            >
              <Sparkles size={14} />
              <span>Delhi NCR Pilot Mode</span>
            </div>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
