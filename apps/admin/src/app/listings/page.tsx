'use client';

import React, { useEffect, useState } from 'react';
import {
  Utensils,
  Search,
  ShieldAlert,
  Clock,
  RefreshCw,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ListingItem {
  id: string;
  title: string;
  category: string;
  quantity_offered: number;
  quantity_reserved: number;
  unit: string;
  status: string;
  pickup_window_end: string;
  pickup_address: string;
  created_at: string;
  organizations?: { name: string } | null;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suspendModalItem, setSuspendModalItem] = useState<ListingItem | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('food_listings')
        .select('id, title, category, quantity_offered, quantity_reserved, unit, status, pickup_window_end, pickup_address, created_at, organizations(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setListings(data as any);
    } catch (err: any) {
      console.error('Error fetching food listings from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();

    const channel = supabase
      .channel('admin-listings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_listings' }, () => fetchListings())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredListings = listings.filter((item) => {
    const matchesCat = filterCategory === 'all' || item.category === filterCategory;
    const donorName = item.organizations?.name || '';
    const matchesQuery =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      donorName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const handleSuspendConfirm = async () => {
    if (!suspendModalItem) return;
    try {
      const { error } = await supabase
        .from('food_listings')
        .update({
          status: 'suspended',
          suspension_reason: suspendReason,
          suspended_at: new Date().toISOString(),
        })
        .eq('id', suspendModalItem.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_role: 'admin',
        action: 'LISTING_SUSPENDED',
        entity_type: 'food_listing',
        entity_id: suspendModalItem.id,
        new_data: { status: 'suspended', reason: suspendReason },
      });

      setNotice(`Listing "${suspendModalItem.title}" suspended for safety audit in PostgreSQL.`);
      setSuspendModalItem(null);
      setSuspendReason('');
      fetchListings();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert(`Suspension error: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Food Listings Oversight</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            Monitor active surpluses, reservation consumption, pickup deadlines, and enforce immediate safety takedowns.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchListings}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {notice && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '10px',
            padding: '12px 18px',
            color: '#fb7185',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ⚠ {notice}
        </div>
      )}

      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-actions" style={{ width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Search food, dishes, donors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="search-input"
                style={{ width: 'auto' }}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="cooked_meal">Cooked Meals</option>
                <option value="bakery">Bakery</option>
                <option value="produce">Produce</option>
                <option value="dairy">Dairy</option>
              </select>
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              Showing {filteredListings.length} of {listings.length} listings
            </div>
          </div>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Food Title & Donor</th>
                <th>Category</th>
                <th>Offered</th>
                <th>Reserved</th>
                <th>Pickup Window End</th>
                <th>Status</th>
                <th>Safety Controls</th>
              </tr>
            </thead>
            <tbody>
              {filteredListings.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Querying listings from database...' : 'No food listings matching query.'}
                  </td>
                </tr>
              ) : (
                filteredListings.map((item) => {
                  const isSuspended = item.status === 'suspended';
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: isSuspended ? '#94a3b8' : '#fff' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {item.organizations?.name || 'Unassigned Donor'}
                        </div>
                      </td>
                      <td>
                        <span className="badge-tag info">{item.category.replace('_', ' ')}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {item.quantity_offered} {item.unit}
                      </td>
                      <td style={{ color: '#38bdf8' }}>
                        {item.quantity_reserved} {item.unit}
                      </td>
                      <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {new Date(item.pickup_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <span
                          className={`badge-tag ${
                            item.status === 'published'
                              ? 'success'
                              : item.status === 'suspended'
                              ? 'danger'
                              : item.status === 'completed'
                              ? 'info'
                              : 'warning'
                          }`}
                        >
                          {item.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {isSuspended ? (
                          <span style={{ fontSize: '12px', color: '#f43f5e', fontWeight: 600 }}>
                            Suspended by Admin
                          </span>
                        ) : (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setSuspendModalItem(item)}
                          >
                            <ShieldAlert size={14} /> Suspend Listing
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspend Confirmation Modal */}
      {suspendModalItem && (
        <div className="modal-overlay" onClick={() => setSuspendModalItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ color: '#f43f5e' }}>
              Suspend Food Listing
            </div>
            <p style={{ fontSize: '13px', color: '#cbd5e1' }}>
              You are taking down <strong>{suspendModalItem.title}</strong> from public discovery and preventing further reservations.
            </p>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Reason for safety takedown (Required for Audit Log):
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
                placeholder="e.g. Temperature control violation reported or donor food hygiene complaint..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setSuspendModalItem(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleSuspendConfirm}
                disabled={!suspendReason.trim()}
              >
                Confirm Safety Takedown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
