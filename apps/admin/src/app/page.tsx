'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Utensils,
  Scale,
  Leaf,
  CheckCircle2,
  Clock,
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FoodListingRow {
  id: string;
  title: string;
  category: string;
  quantity_offered: number;
  quantity_reserved: number;
  quantity_collected: number;
  unit: string;
  status: string;
  pickup_window_end: string;
}

interface VerificationRow {
  id: string;
  name: string;
  org_type: string;
  city: string;
  state: string;
  fssai_number?: string;
  verification_status: string;
  contact_email?: string;
}

interface SafetyReportRow {
  id: string;
  report_type: string;
  description: string;
  status: string;
  created_at: string;
  food_listings?: { title: string } | null;
}

interface AuditLogRow {
  id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  created_at: string;
  new_data?: any;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<FoodListingRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [safetyReports, setSafetyReports] = useState<SafetyReportRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [advisory, setAdvisory] = useState<{ active: boolean; banner_text: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Food Listings
      const { data: listingsData } = await supabase
        .from('food_listings')
        .select('id, title, category, quantity_offered, quantity_reserved, quantity_collected, unit, status, pickup_window_end')
        .order('created_at', { ascending: false });

      if (listingsData) setListings(listingsData);

      // 2. Pending Organizations
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('id, name, org_type, city, state, fssai_number, verification_status, email')
        .in('verification_status', ['pending', 'under_review'])
        .limit(5);

      if (orgsData) {
        setVerifications(
          orgsData.map((o: any) => ({
            ...o,
            contact_email: o.email,
          }))
        );
      }

      // 3. Safety Reports
      const { data: reportsData } = await supabase
        .from('safety_reports')
        .select('id, report_type, description, status, created_at, food_listings(title)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (reportsData) setSafetyReports(reportsData as any);

      // 4. Audit Logs
      const { data: logsData } = await supabase
        .from('audit_logs')
        .select('id, actor_role, action, entity_type, created_at, new_data')
        .order('created_at', { ascending: false })
        .limit(8);

      if (logsData) setAuditLogs(logsData);

      // 5. Remote Advisory
      const { data: configData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'safety_advisory')
        .maybeSingle();

      if (configData?.value) {
        setAdvisory(configData.value as any);
      }
    } catch (err) {
      console.error('Error fetching dashboard records from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Continuous Realtime Synchronization
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_listings' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_reports' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute live aggregates from database rows
  const portionsSaved = listings
    .filter((l) => l.unit === 'portions')
    .reduce((sum, l) => sum + (Number(l.quantity_collected) || Number(l.quantity_reserved) || 0), 0);

  const kgFoodSaved = listings
    .filter((l) => l.unit === 'kg')
    .reduce((sum, l) => sum + (Number(l.quantity_collected) || Number(l.quantity_reserved) || 0), 0);

  const co2AvoidedKg = Math.round(kgFoodSaved * 2.5);

  const activeRescuesCount = listings.filter(
    (l) => l.status === 'partially_reserved' || l.status === 'fully_reserved'
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Safety Alert Banner */}
      {advisory?.active && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '14px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fbbf24',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fef3c7' }}>
                Active Safety Advisory
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                {advisory.banner_text}
              </div>
            </div>
          </div>
          <Link href="/config" className="btn btn-secondary btn-sm">
            Configure
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="metrics-grid">
        <div className="metric-card accent-emerald">
          <div className="metric-header">
            <span className="metric-title">Portions Rescued</span>
            <div className="metric-icon-box" style={{ color: '#34d399' }}>
              <Utensils size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{portionsSaved.toLocaleString()}</span>
            <span className="metric-unit">portions</span>
          </div>
          <div className="metric-footer">
            <span className="badge-tag success">SDG 2.1</span>
            <span>Zero hunger food rescue</span>
          </div>
        </div>

        <div className="metric-card accent-amber">
          <div className="metric-header">
            <span className="metric-title">Food Diverted</span>
            <div className="metric-icon-box" style={{ color: '#fbbf24' }}>
              <Scale size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{kgFoodSaved.toLocaleString()}</span>
            <span className="metric-unit">kg food</span>
          </div>
          <div className="metric-footer">
            <span className="badge-tag warning">SDG 12.3</span>
            <span>Authoritative landfill diversion</span>
          </div>
        </div>

        <div className="metric-card accent-cyan">
          <div className="metric-header">
            <span className="metric-title">Carbon Avoided</span>
            <div className="metric-icon-box" style={{ color: '#67e8f9' }}>
              <Leaf size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{co2AvoidedKg.toLocaleString()}</span>
            <span className="metric-unit">kg CO₂e</span>
          </div>
          <div className="metric-footer">
            <span className="badge-tag info">Climate Action</span>
            <span>Methane prevention ratio</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Rescues</span>
            <div className="metric-icon-box" style={{ color: '#a78bfa' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{activeRescuesCount}</span>
            <span className="metric-unit">in transit</span>
          </div>
          <div className="metric-footer">
            <span className="badge-tag success">Live</span>
            <span>Open reservation windows</span>
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        {/* Verification Queue Summary */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <FileCheck size={20} color="#10b981" />
              <span>Pending Organization Verifications</span>
            </div>
            <Link href="/verifications" className="btn btn-secondary btn-sm">
              View Queue ({verifications.length})
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {verifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No pending verification applications currently awaiting review.
              </div>
            ) : (
              verifications.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                      {item.city}, {item.state} • {item.org_type.toUpperCase()} • FSSAI: {item.fssai_number || 'Exempt / None'}
                    </div>
                  </div>
                  <Link href="/verifications" className="btn btn-primary btn-sm">
                    Review
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Safety Reports Summary */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <ShieldAlert size={20} color="#f43f5e" />
              <span>Safety & Dispute Alerts</span>
            </div>
            <Link href="/safety" className="btn btn-secondary btn-sm">
              Review Reports ({safetyReports.length})
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {safetyReports.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Zero active food safety or cold chain incident reports logged.
              </div>
            ) : (
              safetyReports.map((incident) => (
                <div
                  key={incident.id}
                  style={{
                    background: 'rgba(244, 63, 94, 0.04)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>
                      {incident.food_listings?.title || 'Food Batch'}
                    </span>
                    <span className={`badge-tag ${incident.status === 'resolved' ? 'success' : 'danger'}`}>
                      {incident.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{incident.description}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Authoritative Audit Trail Table */}
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <CheckCircle2 size={20} color="#06b6d4" />
            <span>Authoritative System Audit Trail</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchData}>
              <RefreshCw size={14} /> Refresh
            </button>
            <Link href="/audit" className="btn btn-secondary btn-sm">
              All Logs
            </Link>
          </div>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Context Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td>
                      <span className="badge-tag info">{log.actor_role || 'SYSTEM'}</span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#34d399' }}>{log.action}</td>
                    <td style={{ color: '#94a3b8' }}>{log.entity_type}</td>
                    <td style={{ color: '#cbd5e1', fontSize: '12px' }}>
                      {typeof log.new_data === 'object' ? JSON.stringify(log.new_data).slice(0, 80) : String(log.new_data || '')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
