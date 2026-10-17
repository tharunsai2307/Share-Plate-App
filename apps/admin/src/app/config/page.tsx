'use client';

import React, { useEffect, useState } from 'react';
import { Sliders, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ConfigPage() {
  const [maxWindowHours, setMaxWindowHours] = useState('12');
  const [otpTtlMinutes, setOtpTtlMinutes] = useState('30');
  const [maxOtpAttempts, setMaxOtpAttempts] = useState('5');
  const [requireFssai, setRequireFssai] = useState(true);
  const [advisoryActive, setAdvisoryActive] = useState(true);
  const [advisoryText, setAdvisoryText] = useState(
    'High temperature alert in Delhi NCR: Please ensure insulated carriers for all cooked food transfers.'
  );
  const [loading, setLoading] = useState(true);
  const [savedNotice, setSavedNotice] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data: platformData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'platform_settings')
        .maybeSingle();

      if (platformData?.value) {
        const val = platformData.value as any;
        if (val.max_reservation_window_hours) setMaxWindowHours(String(val.max_reservation_window_hours));
        if (val.otp_ttl_minutes) setOtpTtlMinutes(String(val.otp_ttl_minutes));
        if (val.max_otp_attempts) setMaxOtpAttempts(String(val.max_otp_attempts));
        if (val.require_fssai_for_cooked_meals !== undefined) setRequireFssai(val.require_fssai_for_cooked_meals);
      }

      const { data: advisoryData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'safety_advisory')
        .maybeSingle();

      if (advisoryData?.value) {
        const adv = advisoryData.value as any;
        if (adv.active !== undefined) setAdvisoryActive(adv.active);
        if (adv.banner_text) setAdvisoryText(adv.banner_text);
      }
    } catch (err: any) {
      console.error('Error fetching config from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const platformPayload = {
        max_reservation_window_hours: Number(maxWindowHours),
        otp_ttl_minutes: Number(otpTtlMinutes),
        max_otp_attempts: Number(maxOtpAttempts),
        require_fssai_for_cooked_meals: requireFssai,
      };

      const advisoryPayload = {
        active: advisoryActive,
        banner_text: advisoryText,
        severity: 'info',
      };

      await supabase.from('app_config').upsert([
        { key: 'platform_settings', value: platformPayload, updated_at: new Date().toISOString() },
        { key: 'safety_advisory', value: advisoryPayload, updated_at: new Date().toISOString() },
      ]);

      await supabase.from('audit_logs').insert({
        actor_role: 'admin',
        action: 'PLATFORM_CONFIG_UPDATED',
        entity_type: 'app_config',
        new_data: { platform: platformPayload, advisory: advisoryPayload },
      });

      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 4000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Platform Remote Configuration</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            Operational parameters and global safety advisories stored in PostgreSQL app_config table.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchConfig}>
          <RefreshCw size={14} /> Reload
        </button>
      </div>

      {savedNotice && (
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
          ✓ Configuration persisted to PostgreSQL app_config table with audit record.
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="panel-card">
          <div className="panel-title">
            <Sliders size={20} color="#10b981" />
            <span>Operational Life-cycle Invariants</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'block', marginBottom: '8px' }}>
                Maximum Reservation Window (Hours)
              </label>
              <input
                type="number"
                className="search-input"
                style={{ width: '100%' }}
                value={maxWindowHours}
                onChange={(e) => setMaxWindowHours(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                Prevents reservations scheduled beyond acceptable freshness horizons.
              </span>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'block', marginBottom: '8px' }}>
                Handover OTP Time-To-Live (Minutes)
              </label>
              <input
                type="number"
                className="search-input"
                style={{ width: '100%' }}
                value={otpTtlMinutes}
                onChange={(e) => setOtpTtlMinutes(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                6-digit OTP expiration time for verification before re-generation is required.
              </span>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'block', marginBottom: '8px' }}>
                Max Verification OTP Failed Attempts
              </label>
              <input
                type="number"
                className="search-input"
                style={{ width: '100%' }}
                value={maxOtpAttempts}
                onChange={(e) => setMaxOtpAttempts(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                Locks verification handoff if code attempts exceed limit.
              </span>
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={requireFssai}
                onChange={(e) => setRequireFssai(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                Strict Enforcement: Require Verified FSSAI License for Commercial Cooked Meals
              </span>
            </label>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-title">
            <AlertTriangle size={20} color="#fbbf24" />
            <span>Mobile Safety Broadcast Banner</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={advisoryActive}
                onChange={(e) => setAdvisoryActive(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                Broadcast Safety Advisory on All Mobile Apps
              </span>
            </label>

            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Advisory Banner Message:
              </label>
              <textarea
                style={{
                  width: '100%',
                  height: '80px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fff',
                  outline: 'none',
                }}
                value={advisoryText}
                onChange={(e) => setAdvisoryText(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }}>
            <Save size={18} /> Persist Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
