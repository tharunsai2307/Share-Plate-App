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
import { supabase } from '../../src/lib/supabase';

interface SurplusItem {
  id: string;
  title: string;
  category: string;
  quantity_offered: number;
  quantity_reserved: number;
  unit: string;
  pickup_window_end: string;
  allergens?: string;
  organizations?: { name: string; fssai_number?: string } | null;
}

interface ReservationItem {
  id: string;
  quantity_requested: number;
  unit: string;
  status: string;
  food_listings?: { title: string; pickup_address: string } | null;
}

export default function NgoScreen() {
  const [activeTab, setActiveTab] = useState<'discover' | 'reservations'>('discover');
  const [listings, setListings] = useState<SurplusItem[]>([]);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Reservation Modal State
  const [reserveModalVisible, setReserveModalVisible] = useState(false);
  const [selectedListing, setSelectedListing] = useState<SurplusItem | null>(null);
  const [reserveQuantity, setReserveQuantity] = useState('10');
  const [safetyAgreed, setSafetyAgreed] = useState(false);
  const [isReserving, setIsReserving] = useState(false);

  // Distribution Modal State
  const [distributeModalVisible, setDistributeModalVisible] = useState(false);
  const [distributeRes, setDistributeRes] = useState<ReservationItem | null>(null);
  const [distributeCount, setDistributeCount] = useState('50');
  const [distributeNotes, setDistributeNotes] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);

  const fetchNgoData = async () => {
    setLoading(true);
    try {
      // 1. Available surplus listings
      const { data: listingsData, error: listingsError } = await supabase
        .from('food_listings')
        .select('id, title, category, quantity_offered, quantity_reserved, unit, pickup_window_end, allergens, organizations(name, fssai_number)')
        .in('status', ['published', 'partially_reserved'])
        .order('created_at', { ascending: false });

      if (listingsError) throw listingsError;
      if (listingsData) setListings(listingsData as any);

      // 2. NGO reservations
      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select('id, quantity_requested, unit, status, food_listings(title, pickup_address)')
        .order('created_at', { ascending: false });

      if (resError) throw resError;
      if (resData) setReservations(resData as any);
    } catch (err: any) {
      console.error('Error fetching NGO data from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNgoData();

    const channel = supabase
      .channel('mobile-ngo-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_listings' }, () => fetchNgoData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchNgoData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenReserve = (item: SurplusItem) => {
    const available = item.quantity_offered - item.quantity_reserved;
    setSelectedListing(item);
    setReserveQuantity(Math.min(10, available).toString());
    setSafetyAgreed(false);
    setReserveModalVisible(true);
  };

  const handleConfirmReservation = async () => {
    if (!selectedListing) return;
    const qty = Number(reserveQuantity);
    const available = selectedListing.quantity_offered - selectedListing.quantity_reserved;

    if (qty <= 0 || qty > available) {
      Alert.alert('Error', `Please choose between 1 and ${available} ${selectedListing.unit}.`);
      return;
    }

    if (!safetyAgreed) {
      Alert.alert('Safety Required', 'You must agree to the FSSAI food hygiene handling terms.');
      return;
    }

    setIsReserving(true);
    try {
      const idempotencyKey = `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Invoke atomic reservation edge function
      const { data, error } = await supabase.functions.invoke('create-reservation', {
        body: {
          listing_id: selectedListing.id,
          quantity_requested: qty,
          unit: selectedListing.unit,
          idempotency_key: idempotencyKey,
        },
      });

      if (error || (data && !data.ok)) {
        // Fallback direct DB atomic reservation transaction if Edge function endpoint is local/offline
        const { error: dbError } = await supabase.rpc('create_reservation_atomic', {
          p_listing_id: selectedListing.id,
          p_recipient_org_id: '44444444-4444-4444-4444-444444444444',
          p_reserved_by: '00000000-0000-0000-0000-000000000004',
          p_quantity_requested: qty,
          p_unit: selectedListing.unit,
          p_idempotency_key: idempotencyKey,
        });

        if (dbError) throw dbError;
      }

      setReserveModalVisible(false);
      fetchNgoData();
      Alert.alert('Atomic Reservation Confirmed', `Successfully reserved ${qty} ${selectedListing.unit} in database.`);
    } catch (err: any) {
      Alert.alert('Reservation Failed', err.message || 'Error executing atomic reservation.');
    } finally {
      setIsReserving(false);
    }
  };

  const handleConfirmDistribution = async () => {
    if (!distributeRes || !distributeNotes.trim()) {
      Alert.alert('Required', 'Please add distribution center or community notes.');
      return;
    }

    setIsDistributing(true);
    try {
      const { error } = await supabase.from('distribution_records').insert({
        reservation_id: distributeRes.id,
        recipient_org_id: '44444444-4444-4444-4444-444444444444',
        recorded_by: '00000000-0000-0000-0000-000000000004',
        quantity_distributed: distributeRes.quantity_requested,
        unit: distributeRes.unit,
        beneficiary_count: Number(distributeCount) || null,
        distribution_notes: distributeNotes.trim(),
      });

      if (error) throw error;

      setDistributeModalVisible(false);
      setDistributeNotes('');
      Alert.alert(
        'Distribution Recorded',
        `Logged ${distributeRes.quantity_requested} ${distributeRes.unit} served to ${distributeCount} beneficiaries in Supabase.`
      );
    } catch (err: any) {
      Alert.alert('Database Error', err.message);
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'discover' && styles.tabButtonActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Available Food Feed ({listings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'reservations' && styles.tabButtonActive]}
          onPress={() => setActiveTab('reservations')}
        >
          <Text style={[styles.tabText, activeTab === 'reservations' && styles.tabTextActive]}>
            My Rescues ({reservations.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'discover' ? (
        <View style={styles.cardList}>
          {loading ? (
            <ActivityIndicator size="large" color="#10b981" style={{ marginVertical: 32 }} />
          ) : listings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No available surplus food currently.</Text>
              <Text style={styles.emptySubtitle}>All registered donor surplus is currently reserved or collected.</Text>
            </View>
          ) : (
            listings.map((item) => {
              const available = item.quantity_offered - item.quantity_reserved;
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.organizations?.fssai_number && (
                      <View style={styles.fssaiBadge}>
                        <Text style={styles.fssaiText}>FSSAI Verified</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.donorName}>
                    Donor: {item.organizations?.name || 'Commercial Kitchen'}
                  </Text>

                  <View style={styles.infoRow}>
                    <View>
                      <Text style={styles.label}>Available to Rescue:</Text>
                      <Text style={styles.qtyHighlight}>
                        {available} {item.unit}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.label}>Pickup Window End:</Text>
                      <Text style={styles.deadline}>
                        {new Date(item.pickup_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>

                  {item.allergens && (
                    <View style={styles.allergensBox}>
                      <Text style={styles.allergensText}>Allergens: {item.allergens}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.reserveBtn,
                      available <= 0 && { backgroundColor: '#334155' },
                    ]}
                    disabled={available <= 0}
                    onPress={() => handleOpenReserve(item)}
                  >
                    <Text style={styles.reserveBtnText}>
                      {available > 0 ? 'Reserve Food for Distribution' : 'Fully Reserved'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      ) : (
        <View style={styles.cardList}>
          {loading ? (
            <ActivityIndicator size="large" color="#10b981" style={{ marginVertical: 32 }} />
          ) : reservations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No reservations yet.</Text>
              <Text style={styles.emptySubtitle}>Explore the available food feed to claim surplus meals for distribution.</Text>
            </View>
          ) : (
            reservations.map((res) => (
              <View key={res.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{res.food_listings?.title || 'Food Reservation'}</Text>
                  <View style={styles.fssaiBadge}>
                    <Text style={styles.fssaiText}>{res.status.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={styles.donorName}>
                  Reserved: {res.quantity_requested} {res.unit}
                </Text>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                  {res.food_listings?.pickup_address || 'Pickup address coordinated'}
                </Text>

                <TouchableOpacity
                  style={styles.distributeBtn}
                  onPress={() => {
                    setDistributeRes(res);
                    setDistributeModalVisible(true);
                  }}
                >
                  <Text style={styles.distributeBtnText}>Record Distribution to Beneficiaries</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {/* Atomic Reservation Modal */}
      <Modal visible={reserveModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>Atomic Food Reservation</Text>
            {selectedListing && (
              <Text style={styles.modalSub}>{selectedListing.title}</Text>
            )}

            <View style={{ gap: 6, marginVertical: 10 }}>
              <Text style={styles.label}>
                Quantity to Reserve (Max: {selectedListing ? selectedListing.quantity_offered - selectedListing.quantity_reserved : 0} {selectedListing?.unit})
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={reserveQuantity}
                onChangeText={setReserveQuantity}
              />
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setSafetyAgreed(!safetyAgreed)}
            >
              <View style={[styles.checkbox, safetyAgreed && styles.checkboxActive]} />
              <Text style={styles.disclaimerText}>
                I confirm our NGO has clean, insulated carrier boxes and will adhere to food safety handling guidelines upon collection.
              </Text>
            </TouchableOpacity>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setReserveModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, isReserving && { opacity: 0.6 }]}
                onPress={handleConfirmReservation}
                disabled={isReserving}
              >
                <Text style={styles.confirmBtnText}>
                  {isReserving ? 'Reserving...' : 'Confirm Reservation'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Record Distribution Modal */}
      <Modal visible={distributeModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>Record Food Distribution</Text>
            <Text style={styles.modalSub}>
              Ensure accurate SDG 2 impact tracking by recording end beneficiaries in Supabase.
            </Text>

            <View style={{ gap: 6, marginVertical: 8 }}>
              <Text style={styles.label}>Estimated Number of Beneficiaries Served *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={distributeCount}
                onChangeText={setDistributeCount}
              />
            </View>

            <View style={{ gap: 6, marginVertical: 8 }}>
              <Text style={styles.label}>Distribution Center / Shelter Notes *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Distributed at Karol Bagh night shelter kitchen..."
                placeholderTextColor="#64748b"
                value={distributeNotes}
                onChangeText={setDistributeNotes}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDistributeModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, isDistributing && { opacity: 0.6 }]}
                onPress={handleConfirmDistribution}
                disabled={isDistributing}
              >
                <Text style={styles.confirmBtnText}>
                  {isDistributing ? 'Saving...' : 'Save Distribution'}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#10b981',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  cardList: {
    gap: 14,
  },
  emptyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  fssaiBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  fssaiText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
  donorName: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    color: '#94a3b8',
  },
  qtyHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34d399',
  },
  deadline: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fbbf24',
  },
  allergensBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 8,
    borderRadius: 6,
  },
  allergensText: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  reserveBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  reserveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  distributeBtn: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  distributeBtnText: {
    color: '#67e8f9',
    fontSize: 12,
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
  modalSub: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#151d2d',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748b',
  },
  checkboxActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
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
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
