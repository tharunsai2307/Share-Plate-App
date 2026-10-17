import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function RoleSelectScreen() {
  const router = useRouter();
  const [advisoryText, setAdvisoryText] = useState<string | null>(null);

  useEffect(() => {
    async function loadRemoteAdvisory() {
      try {
        const { data } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'safety_advisory')
          .maybeSingle();

        if (data?.value && (data.value as any).active) {
          setAdvisoryText((data.value as any).banner_text);
        }
      } catch (err) {
        // Fallback quiet
      }
    }
    loadRemoteAdvisory();
  }, []);

  const roles = [
    {
      id: 'ngo',
      title: 'Recipient NGO',
      subtitle: 'Discover food, create atomic reservations & distribute to shelters',
      route: '/(ngo)',
      color: '#10b981',
      badge: 'SDG 2 — Zero Hunger',
    },
    {
      id: 'donor',
      title: 'Food Donor Kitchen',
      subtitle: 'Publish surplus meals, track pickups & generate handover OTPs',
      route: '/(donor)',
      color: '#f59e0b',
      badge: 'FSSAI Compliant',
    },
    {
      id: 'volunteer',
      title: 'Volunteer Courier',
      subtitle: 'Navigate pickup routes, verify cold chain & confirm 6-digit OTP',
      route: '/(volunteer)',
      color: '#06b6d4',
      badge: 'Active Dispatch',
    },
    {
      id: 'impact',
      title: 'SDG Impact & Safety Hub',
      subtitle: 'Live portions saved, avoided emissions & file safety reports',
      route: '/impact',
      color: '#8b5cf6',
      badge: 'Authoritative Metrics',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Brand Banner */}
        <View style={styles.brandBox}>
          <View style={styles.logoPill}>
            <Text style={styles.logoText}>SP</Text>
          </View>
          <Text style={styles.appTitle}>SharePlate</Text>
          <Text style={styles.tagline}>"Good food deserves another destination."</Text>

          <View style={styles.badgeRow}>
            <View style={[styles.sdgChip, { borderColor: '#10b981' }]}>
              <Text style={[styles.sdgText, { color: '#34d399' }]}>SDG 2: Zero Hunger</Text>
            </View>
            <View style={[styles.sdgChip, { borderColor: '#f59e0b' }]}>
              <Text style={[styles.sdgText, { color: '#fbbf24' }]}>SDG 12: Responsible Consumption</Text>
            </View>
          </View>
        </View>

        {/* Remote Advisory Banner */}
        {advisoryText && (
          <View style={styles.advisoryBox}>
            <Text style={styles.advisoryTitle}>⚠ Live Operational Safety Advisory</Text>
            <Text style={styles.advisoryBody}>{advisoryText}</Text>
          </View>
        )}

        {/* Role Portal Cards */}
        <Text style={styles.sectionHeader}>Select Your Operational Role</Text>

        <View style={styles.cardsContainer}>
          {roles.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.card, { borderLeftColor: r.color, borderLeftWidth: 4 }]}
              onPress={() => router.push(r.route as any)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{r.title}</Text>
                <View style={[styles.badge, { backgroundColor: `${r.color}20` }]}>
                  <Text style={[styles.badgeText, { color: r.color }]}>{r.badge}</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>{r.subtitle}</Text>
              <View style={styles.enterRow}>
                <Text style={[styles.enterText, { color: r.color }]}>Enter Portal →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    padding: 24,
    gap: 20,
  },
  brandBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  logoPill: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  sdgChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  sdgText: {
    fontSize: 11,
    fontWeight: '700',
  },
  advisoryBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  advisoryTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
  },
  advisoryBody: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 4,
  },
  cardsContainer: {
    gap: 14,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  enterRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  enterText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
