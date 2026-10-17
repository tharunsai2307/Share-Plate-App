'use client';

import React, { useEffect, useState } from 'react';
import { History, Shield, Search, FileJson, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuditItem {
  id: string;
  actor_id?: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  new_data?: any;
  created_at: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setLogs(data);
    } catch (err: any) {
      console.error('Error fetching audit logs from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter(
    (log) =>
      (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entity_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.actor_role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Immutable Platform Audit Trail</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            Append-only logs for all state machine transitions, OTP generations, reservations, and admin interventions.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAuditLogs}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <input
            type="text"
            className="search-input"
            placeholder="Search by action, role, or entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            {filteredLogs.length} verified log entries
          </div>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event Timestamp</th>
                <th>Role</th>
                <th>Operation Action</th>
                <th>Target Entity</th>
                <th>Entity ID</th>
                <th>Payload Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Reading audit trail from database...' : 'No audit records match query.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge-tag info">{(log.actor_role || 'SYSTEM').toUpperCase()}</span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                      {log.action}
                    </td>
                    <td style={{ color: '#cbd5e1' }}>{log.entity_type}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                      {log.entity_id ? log.entity_id.slice(0, 13) + '...' : 'N/A'}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <FileJson size={14} /> View JSON
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Diff Inspector Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Audit Record: {selectedLog.action}</div>
              <button
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setSelectedLog(null)}
              >
                <X size={20} />
              </button>
            </div>

            <pre
              style={{
                background: '#0a0e17',
                padding: '16px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#34d399',
                overflowX: 'auto',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {JSON.stringify(selectedLog, null, 2)}
            </pre>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
