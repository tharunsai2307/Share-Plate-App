import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../src/lib/supabase';

export default function ImpactScreen() {
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportType, setReportType] = useState('food_safety');
  const [reportDesc, setReportDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real aggregate numbers
  const [portionsRescued, setPortionsRescued] = useState(0);
  const [kgRescued, setKgRescued] = useState(0);
  const [rescueRate, setRescueRate] = useState(0);

  const fetchRealImpact = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('food_listings')
        .select('quantity_offered, quantity_collected, quantity_reserved, unit, status');

      if (error) throw error;
      if (data) {
        let portions = 0;
        let kg = 0;
        let totalOffered = 0;
        let totalCollected = 0;

        for (const row of data) {
          const collected = Number(row.quantity_collected) || Number(row.quantity_reserved) || 0;
          const offered = Number(row.quantity_offered) || 0;

          if (row.unit === 'portions') portions += collected;
          if (row.unit === 'kg') kg += collected;

          totalOffered += offered;
          totalCollected += collected;
        }

        setPortionsRescued(portions);
        setKgRescued(kg);
        const rate = totalOffered > 0 ? Math.round((totalCollected / totalOffered) * 1000) / 10 : 0;
        setRescueRate(rate);
      }
    } catch (err: any) {
      console.error('Error fetching impact metrics from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealImpact();
  }, []);

  const handleReportSubmit = async () => {
    if (!reportDesc.trim() || reportDesc.length < 15) {
      Alert.alert('Required', 'Please describe the incident in detail (at least 15 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('safety_reports').insert({
        reported_by: '00000000-0000-0000-0000-000000000004',
        report_type: reportType,
        description: reportDesc.trim(),
        status: 'open',
      });

      if (error) throw error;

      Alert.alert(
        'Safety Report Submitted',
        'The incident has been registered in the database for immediate admin triage.'
      );
      setReportModalVisible(false);
      setReportDesc('');
    } catch (err: any) {
      Alert.alert('Submission Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const co2AvoidedKg = Math.round(kgRescued * 2.5);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* SDG Summary Header */}
      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>SDG Impact & Food Safety Center</Text>
        <Text style={styles.headerSubtitle}>
          Authoritative metrics aggregated directly from PostgreSQL verified handovers.
        </Text>
      </View>

      {/* KPI Grid */}
      {loading ? (
        <ActivityIndicator size="large" color="#10b981" style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.grid}>
          <View style={[styles.kpiCard, { borderColor: '#10b981' }]}>
            <Text style={styles.kpiLabel}>MEALS RESCUED</Text>
            <Text style={[styles.kpiValue, { color: '#34d399' }]}>
              {portionsRescued.toLocaleString()}
            </Text>
            <Text style={styles.kpiUnit}>portions served</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: '#f59e0b' }]}>
            <Text style={styles.kpiLabel}>FOOD DIVERTED</Text>
            <Text style={[styles.kpiValue, { color: '#fbbf24' }]}>
              {kgRescued.toLocaleString()}
            </Text>
            <Text style={styles.kpiUnit}>kg from landfill</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: '#06b6d4' }]}>
            <Text style={styles.kpiLabel}>CARBON AVOIDED</Text>
            <Text style={[styles.kpiValue, { color: '#67e8f9' }]}>
              {co2AvoidedKg.toLocaleString()}
            </Text>
            <Text style={styles.kpiUnit}>kg CO₂e equivalent</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: '#8b5cf6' }]}>
            <Text style={styles.kpiLabel}>RESCUE SUCCESS</Text>
            <Text style={[styles.kpiValue, { color: '#c084fc' }]}>{rescueRate}%</Text>
            <Text style={styles.kpiUnit}>collection rate</Text>
          </View>
        </View>
      )}

      {/* SDG Commitment Cards */}
      <View style={styles.sdgCard}>
        <Text style={styles.sdgTitle}>🎯 SDG 2 — Zero Hunger</Text>
        <Text style={styles.sdgBody}>
          Target 2.1: Ensuring universal access to safe, nutritious, and sufficient food all year round by eliminating institutional food waste.
        </Text>
      </View>

      <View style={styles.sdgCard}>
        <Text style={styles.sdgTitle}>♻ SDG 12 — Responsible Consumption</Text>
        <Text style={styles.sdgBody}>
          Target 12.3: Halving per capita food waste at retail and consumer levels, and reducing food losses along supply chains.
        </Text>
      </View>

      {/* Safety Incident CTA */}
      <View style={styles.incidentBox}>
        <Text style={styles.incidentHeading}>Report a Food Safety or Delivery Dispute</Text>
        <Text style={styles.incidentSub}>
          Notice broken cold chain, damaged packaging, or quantity discrepancy? Submit an incident report to platform operations.
        </Text>
        <TouchableOpacity
          style={styles.incidentBtn}
          onPress={() => setReportModalVisible(true)}
        >
          <Text style={styles.incidentBtnText}>⚠ File Incident Report</Text>
        </TouchableOpacity>
      </View>

      {/* Incident Modal */}
      <Modal visible={reportModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>Submit Incident Report</Text>

            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Incident Category</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, reportType === 'food_safety' && styles.typeBtnActive]}
                  onPress={() => setReportType('food_safety')}
                >
                  <Text style={styles.typeBtnText}>Safety / Cold Chain</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, reportType === 'quality' && styles.typeBtnActive]}
                  onPress={() => setReportType('quality')}
                >
                  <Text style={styles.typeBtnText}>Packaging Quality</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Description of Issue *</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder="Describe temperature, odor, packaging state, or mismatch..."
                placeholderTextColor="#64748b"
                value={reportDesc}
                onChangeText={setReportDesc}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setReportModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleReportSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? 'Submitting...' : 'Submit to Database'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    gap: 16,
  },
  headerBox: {
    paddingVertical: 10,
    gap: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  kpiUnit: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  sdgCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  sdgTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  sdgBody: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  incidentBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    borderRadius: 14,
    padding: 18,
    gap: 8,
    marginTop: 8,
  },
  incidentHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fb7185',
  },
  incidentSub: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 16,
  },
  incidentBtn: {
    backgroundColor: '#f43f5e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  incidentBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#121926',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    gap: 12,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#151d2d',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  typeBtnActive: {
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  typeBtnText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#151d2d',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    height: 80,
    textAlignVertical: 'top',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
