'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SafetyIncidentItem {
  id: string;
  report_type: string;
  description: string;
  status: string;
  created_at: string;
  action_taken?: string;
  food_listings?: { title: string } | null;
}

export default function SafetyPage() {
  const [incidents, setIncidents] = useState<SafetyIncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncidentItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('safety_reports')
        .select('id, report_type, description, status, created_at, action_taken, food_listings(title)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setIncidents(data as any);
    } catch (err: any) {
      console.error('Error fetching safety reports from Supabase:', err?.message || err?.error_description || JSON.stringify(err) || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleResolve = async (id: string, status: 'investigating' | 'resolved' | 'dismissed') => {
    try {
      const note = resolutionNote || (status === 'resolved' ? 'Resolved by Platform Lead after investigation.' : 'Case flagged for internal inspection.');
      const { error } = await supabase
        .from('safety_reports')
        .update({
          status,
          action_taken: note,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_role: 'admin',
        action: status === 'resolved' ? 'SAFETY_REPORT_RESOLVED' : status === 'investigating' ? 'SAFETY_REPORT_INVESTIGATING' : 'SAFETY_REPORT_DISMISSED',
        entity_type: 'safety_report',
        entity_id: id,
        new_data: { status, action_taken: note },
      });

      setNotice(`Incident status successfully updated to "${status.toUpperCase()}".`);
      setSelectedIncident(null);
      setResolutionNote('');
      fetchIncidents();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert(`Update error: ${err.message || JSON.stringify(err)}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Safety Reports & Incident Triage</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            Triage food hygiene reports, cold-chain temperature violations, quantity discrepancies, and recipient disputes.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchIncidents}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {notice && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            padding: '12px 18px',
            color: '#34d399',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ✓ {notice}
        </div>
      )}

      <div className="panel-card">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Food Listing & Batch</th>
                <th>Incident Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Fetching incidents from database...' : 'Zero incident reports logged. Platform running safely.'}
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inc.food_listings?.title || 'General Food Safety'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {new Date(inc.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge-tag ${
                          inc.report_type === 'quality' || inc.report_type === 'temperature' ? 'danger' : 'warning'
                        }`}
                      >
                        {inc.report_type.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ maxWidth: '300px', fontSize: '12px', color: '#94a3b8' }}>
                      <div>{inc.description}</div>
                      {inc.action_taken && (
                        <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>
                          Action: {inc.action_taken}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge-tag ${
                          inc.status === 'resolved'
                            ? 'success'
                            : inc.status === 'investigating'
                            ? 'danger'
                            : 'warning'
                        }`}
                      >
                        {inc.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedIncident(inc);
                          setResolutionNote(inc.action_taken || '');
                        }}
                      >
                        Triage Case
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incident Review Modal */}
      {selectedIncident && (
        <div className="modal-overlay" onClick={() => setSelectedIncident(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                Triage Incident: {selectedIncident.food_listings?.title || 'Safety Report'}
              </div>
              <button
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setSelectedIncident(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Original Report Statement:</div>
                <div style={{ color: '#fff', fontStyle: 'italic' }}>&ldquo;{selectedIncident.description}&rdquo;</div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Inspector Investigation & Resolution Action Taken:
                </label>
                <textarea
                  style={{
                    width: '100%',
                    height: '90px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#fff',
                    outline: 'none',
                  }}
                  placeholder="Record verification of temperature logger, laboratory test, disposal protocol, or NGO confirmation..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleResolve(selectedIncident.id, 'investigating')}
              >
                Flag Investigating
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleResolve(selectedIncident.id, 'dismissed')}
              >
                Dismiss
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleResolve(selectedIncident.id, 'resolved')}
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
