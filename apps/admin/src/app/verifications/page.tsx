'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  FileText,
  Building,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface OrgItem {
  id: string;
  name: string;
  org_type: string;
  city: string;
  state: string;
  fssai_number?: string;
  verification_status: string;
  created_at: string;
  email?: string;
  phone?: string;
  description?: string;
}

export default function VerificationsPage() {
  const [items, setItems] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<OrgItem | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, org_type, city, state, fssai_number, verification_status, created_at, email, phone, description')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setItems(data);
    } catch (err: any) {
      console.error('Error fetching organizations from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();

    const channel = supabase
      .channel('admin-verifications-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => fetchVerifications())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Write audit log
      await supabase.from('audit_logs').insert({
        actor_role: 'admin',
        action: 'ORG_VERIFIED',
        entity_type: 'organization',
        entity_id: id,
        new_data: { verification_status: 'verified' },
      });

      setActionNotice('Organization verified successfully in PostgreSQL database.');
      setSelectedItem(null);
      fetchVerifications();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedItem) return;
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          verification_status: 'rejected',
          suspension_reason: rejectReason,
        })
        .eq('id', selectedItem.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_role: 'admin',
        action: 'ORG_REJECTED',
        entity_type: 'organization',
        entity_id: selectedItem.id,
        new_data: { verification_status: 'rejected', reason: rejectReason },
      });

      setActionNotice('Organization application rejected and recorded in audit trail.');
      setRejectModalOpen(false);
      setSelectedItem(null);
      setRejectReason('');
      fetchVerifications();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Organization Verification Queue</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            Review food donor and NGO credentials, verify FSSAI certifications, and manage platform participation.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchVerifications}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {actionNotice && (
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
          ✓ {actionNotice}
        </div>
      )}

      <div className="panel-card">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Type</th>
                <th>Location</th>
                <th>FSSAI License</th>
                <th>Registered</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading organizations from database...' : 'No organizations found in database.'}
                  </td>
                </tr>
              ) : (
                items.map((org) => (
                  <tr key={org.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{org.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{org.email || 'No email provided'}</div>
                    </td>
                    <td>
                      <span className="badge-tag info">{org.org_type.toUpperCase()}</span>
                    </td>
                    <td>
                      {org.city}, {org.state}
                    </td>
                    <td>
                      {org.fssai_number ? (
                        <span style={{ fontFamily: 'monospace', color: '#34d399' }}>{org.fssai_number}</span>
                      ) : (
                        <span style={{ color: '#64748b' }}>Non-FSSAI (NGO)</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {new Date(org.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <span
                        className={`badge-tag ${
                          org.verification_status === 'verified'
                            ? 'success'
                            : org.verification_status === 'rejected'
                            ? 'danger'
                            : 'warning'
                        }`}
                      >
                        {org.verification_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedItem(org)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Detail Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{selectedItem.name}</div>
              <button
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setSelectedItem(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>Description:</div>
                <div style={{ color: '#cbd5e1' }}>{selectedItem.description || 'No description provided.'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Contact Phone:</span>
                  <div style={{ fontWeight: 600, color: '#fff' }}>{selectedItem.phone || 'N/A'}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>FSSAI Registration:</span>
                  <div style={{ fontWeight: 600, color: selectedItem.fssai_number ? '#34d399' : '#94a3b8' }}>
                    {selectedItem.fssai_number || 'Exempt / Not provided'}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setRejectModalOpen(true)}
                disabled={selectedItem.verification_status === 'rejected'}
              >
                <X size={16} /> Reject Application
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleApprove(selectedItem.id)}
                disabled={selectedItem.verification_status === 'verified'}
              >
                <Check size={16} /> Approve & Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Confirmation Modal */}
      {rejectModalOpen && selectedItem && (
        <div className="modal-overlay" onClick={() => setRejectModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Reject Application Reason</div>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>
              Specify the audit reason for rejecting {selectedItem.name}.
            </p>
            <textarea
              style={{
                width: '100%',
                height: '100px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px',
                color: '#fff',
                outline: 'none',
              }}
              placeholder="e.g. Incomplete FSSAI license certificate or unverified physical kitchen address..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setRejectModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleRejectConfirm}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
