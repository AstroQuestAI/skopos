/**
 * SubscriptionModal — v8.6 Razorpay-only payments with simulate fallback.
 *
 * Flow:
 *   1) fetchPlans → list plans
 *   2) user picks plan, optionally applies coupon
 *   3) Pay → createRazorpayOrder (backend creates a real or simulated order)
 *   4a) REAL mode: Razorpay Checkout.js opens; on handler() success we call
 *       /payments/razorpay/verify with the HMAC-signed payload.
 *   4b) SIMULATE mode (keys not set yet): show "Simulate Success / Failure"
 *       buttons that call /payments/razorpay/simulate directly.
 *   5) On success → onPurchased(fresh init result) + close modal.
 *
 * Webhook runs async on Razorpay's side and acts as the authoritative
 * second confirmation; client-side verify is for instant UI feedback.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchPlans, validateCoupon, fetchMe,
  createRazorpayOrder, verifyRazorpayPayment, simulateRazorpayOutcome, loadRazorpayScript,
  type PlanInfo, type CouponInfo, type InitResult, type RazorpayOrderInfo,
} from '../utils/profile';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful payment OR restore with the fresh init result. */
  onPurchased?: (result: InitResult) => void;
  /** Optional preselected plan; defaults to the higher-tier (Full Access). */
  preferredPlanId?: string;
  /** Friendly reason displayed above the plan list. */
  reason?: string;
}

export const SubscriptionModal: React.FC<Props> = ({
  visible, onClose, onPurchased, preferredPlanId, reason,
}) => {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponInfo, setCouponInfo] = useState<CouponInfo | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [order, setOrder] = useState<RazorpayOrderInfo | null>(null);
  const [paying, setPaying] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const resetOnClose = useCallback(() => {
    setCouponCode(''); setCouponInfo(null); setCouponErr(null);
    setOrder(null); setPaying(false); setRestoring(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    setPlansLoading(true);
    fetchPlans()
      .then((list) => {
        setPlans(list);
        if (!selected) {
          const pref = list.find(p => p.plan_id === preferredPlanId) || list[list.length - 1];
          if (pref) setSelected(pref.plan_id);
        }
      })
      .catch(() => Alert.alert('Error', 'Could not load plans. Please try again.'))
      .finally(() => setPlansLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const selectedPlan = plans.find(p => p.plan_id === selected) || null;

  const applyCoupon = useCallback(async () => {
    if (!selectedPlan || !couponCode.trim()) return;
    setCouponLoading(true); setCouponErr(null);
    try {
      const info = await validateCoupon(couponCode.trim().toUpperCase(), selectedPlan.plan_id);
      setCouponInfo(info);
    } catch (e: any) {
      setCouponInfo(null);
      setCouponErr(e?.response?.data?.detail || 'Invalid coupon');
    } finally { setCouponLoading(false); }
  }, [couponCode, selectedPlan]);

  const removeCoupon = () => { setCouponInfo(null); setCouponCode(''); setCouponErr(null); };

  const onPaidOK = useCallback(async () => {
    try {
      const fresh = await fetchMe();
      onPurchased?.(fresh);
      Alert.alert(
        'Payment Successful',
        `${fresh.profile?.plan_id === 'full' ? 'Full Access' : 'Basic'} activated until ${fresh.access.plan_expires_at ? new Date(fresh.access.plan_expires_at).toLocaleDateString() : '—'}.`,
      );
    } catch { /* ignore */ }
    resetOnClose();
  }, [onPurchased, resetOnClose]);

  // ── Start payment: Razorpay Checkout (real) OR simulate panel ───────────
  const startPayment = useCallback(async () => {
    if (!selectedPlan) return;
    setPaying(true);
    try {
      // v8.1 — pass the signed-in email so the backend can resolve the
      // user_profile by email (stable) instead of just device_id (can
      // rotate across browsers/re-installs).
      const authEmail =
        (typeof window !== 'undefined' &&
          window.localStorage?.getItem('@astroquest.authEmail.v2')) ||
        undefined;
      const ord = await createRazorpayOrder(
        selectedPlan.plan_id,
        couponInfo?.code,
        authEmail || undefined,
      );
      setOrder(ord);
      // If real mode, open Razorpay Checkout immediately.
      if (!ord.simulate && typeof window !== 'undefined') {
        const ok = await loadRazorpayScript();
        if (!ok) {
          Alert.alert('Error', 'Could not load Razorpay. Check your connection.');
          setOrder(null); return;
        }
        const rzp = new (window as any).Razorpay({
          key: ord.key_id,
          amount: ord.amount_paise,
          currency: ord.currency,
          order_id: ord.order_id,
          name: 'AstroQuest',
          description: `${ord.plan.name} (₹${ord.amount})`,
          theme: { color: '#4338CA' },
          handler: async function (response: any) {
            // Razorpay hands us signed payload; backend verifies HMAC + activates plan.
            try {
              await verifyRazorpayPayment(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature,
              );
              onPaidOK();
            } catch (e: any) {
              Alert.alert('Verification failed',
                e?.response?.data?.detail || 'Please contact support with your payment ID.');
            }
          },
          modal: {
            ondismiss: () => { setOrder(null); setPaying(false); },
          },
        });
        rzp.on('payment.failed', (resp: any) => {
          Alert.alert('Payment Failed', resp?.error?.description || 'Please try again.');
          setOrder(null);
        });
        rzp.open();
      }
      // In simulate mode, the inline <SimulateBox> renders below; user clicks
      // "Success" or "Failure" and we call /simulate.
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not start payment.');
    } finally { setPaying(false); }
  }, [selectedPlan, couponInfo, onPaidOK]);

  const doSimulate = useCallback(async (outcome: 'success' | 'failure') => {
    if (!order) return;
    setPaying(true);
    try {
      await simulateRazorpayOutcome(order.order_id, outcome);
      if (outcome === 'success') {
        onPaidOK();
      } else {
        Alert.alert('Simulated Failure', 'Payment was marked as failed.');
        setOrder(null);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Simulate failed');
    } finally { setPaying(false); }
  }, [order, onPaidOK]);

  const restorePurchases = useCallback(async () => {
    setRestoring(true);
    try {
      const res = await fetchMe();
      onPurchased?.(res);
      if (res.access.plan_active) {
        Alert.alert('Restored', `Your ${res.profile.plan_id === 'full' ? 'Full Access' : 'Basic'} subscription is active.`);
        resetOnClose();
      } else {
        Alert.alert('No active subscription', 'We could not find an active paid plan for this device.');
      }
    } catch {
      Alert.alert('Restore failed', 'Please try again in a moment.');
    } finally { setRestoring(false); }
  }, [onPurchased, resetOnClose]);

  const basePrice  = selectedPlan?.price_inr ?? 0;
  const discount   = couponInfo?.discount ?? 0;
  const finalPrice = Math.max(0, basePrice - discount);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetOnClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Upgrade AstroQuest</Text>
            <TouchableOpacity onPress={resetOnClose} style={styles.closeBtn} hitSlop={10} testID="sub-close">
              <Ionicons name="close" size={22} color="#475569" />
            </TouchableOpacity>
          </View>

          {reason ? (
            <View style={styles.reasonBox}>
              <Ionicons name="information-circle" size={18} color="#6D28D9" />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ) : null}

          <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false}>
            {plansLoading ? (
              <ActivityIndicator color="#6D28D9" style={{ marginVertical: 20 }} />
            ) : (
              plans.map(p => (
                <TouchableOpacity
                  key={p.plan_id}
                  style={[styles.planCard, selected === p.plan_id && styles.planCardActive]}
                  onPress={() => setSelected(p.plan_id)}
                  testID={`plan-${p.plan_id}`}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{p.name}</Text>
                      <Text style={styles.planDesc}>{p.description}</Text>
                      <View style={styles.featureList}>
                        {(p.features || []).slice(0, 6).map(f => (
                          <View key={f} style={styles.featurePill}>
                            <Ionicons name="checkmark" size={11} color="#065F46" />
                            <Text style={styles.featurePillText}>{featureLabel(f)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.planPrice}>₹{p.price_inr}</Text>
                      <Text style={styles.planCycle}>/{p.duration_days >= 300 ? 'year' : 'month'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Coupon */}
            {!order && selectedPlan ? (
              <View style={styles.couponBox}>
                <Text style={styles.couponLabel}>Have a coupon?</Text>
                {couponInfo ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="pricetag" size={16} color="#047857" />
                    <Text style={[styles.couponOk, { flex: 1, marginLeft: 6, marginTop: 0 }]}>
                      {couponInfo.code} applied — ₹{couponInfo.discount} off
                    </Text>
                    <TouchableOpacity onPress={removeCoupon} hitSlop={10}>
                      <Ionicons name="close-circle" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row' }}>
                    <TextInput
                      style={styles.couponInput}
                      value={couponCode}
                      onChangeText={setCouponCode}
                      placeholder="Enter code"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={40}
                      testID="coupon-input"
                    />
                    <TouchableOpacity
                      style={[styles.couponBtn, (!couponCode.trim() || couponLoading) && { opacity: 0.6 }]}
                      onPress={applyCoupon}
                      disabled={!couponCode.trim() || couponLoading}
                      testID="coupon-apply"
                    >
                      {couponLoading
                        ? <ActivityIndicator color="#FFFFFF" />
                        : <Text style={styles.couponBtnText}>Apply</Text>}
                    </TouchableOpacity>
                  </View>
                )}
                {couponErr ? <Text style={styles.couponErr}>{couponErr}</Text> : null}
              </View>
            ) : null}

            {/* Summary */}
            {selectedPlan ? (
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Plan</Text>
                  <Text style={styles.summaryValue}>{selectedPlan.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Base</Text>
                  <Text style={styles.summaryValue}>₹{basePrice}</Text>
                </View>
                {discount > 0 ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Discount</Text>
                    <Text style={[styles.summaryValue, { color: '#047857' }]}>− ₹{discount}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Total</Text>
                  <Text style={[styles.summaryValue, { fontSize: 16, color: '#4338CA' }]}>₹{finalPrice}</Text>
                </View>
              </View>
            ) : null}

            {/* Pay buttons OR Razorpay / Simulate state */}
            {order && order.simulate ? (
              <View style={styles.simBox}>
                <Text style={styles.simTitle}>🛠  Simulate Mode</Text>
                <Text style={styles.simSub}>
                  Razorpay keys are not configured on the server. Use the buttons below to
                  exercise the full payment lifecycle without making a real payment.
                  {'\n'}Order <Text style={styles.mono}>{order.order_id.slice(0, 22)}…</Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.payBtnGhost, { flex: 1, backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1 }]}
                    onPress={() => doSimulate('failure')}
                    disabled={paying}
                    testID="sim-fail"
                  >
                    <Text style={[styles.payBtnGhostText, { color: '#991B1B' }]}>Simulate Fail</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.payBtn, { flex: 1 }]}
                    onPress={() => doSimulate('success')}
                    disabled={paying}
                    testID="sim-success"
                  >
                    {paying
                      ? <ActivityIndicator color="#FFFFFF" />
                      : <Text style={styles.payBtnText}>Simulate Success</Text>}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setOrder(null)} style={{ paddingVertical: 8 }}>
                  <Text style={{ textAlign: 'center', color: '#64748B' }}>Cancel order</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.payBtn, (paying || !selectedPlan) && { opacity: 0.6 }]}
                  onPress={startPayment}
                  disabled={paying || !selectedPlan}
                  testID="pay-btn"
                >
                  {paying
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.payBtnText}>Pay ₹{finalPrice} — Razorpay</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.restoreBtn}
                  onPress={restorePurchases}
                  disabled={restoring}
                  testID="restore-btn"
                >
                  {restoring
                    ? <ActivityIndicator color="#4338CA" size="small" />
                    : <>
                        <Ionicons name="refresh" size={14} color="#4338CA" />
                        <Text style={styles.restoreBtnText}>Restore Purchases</Text>
                      </>}
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.legal}>
              Payments are processed by Razorpay. UPI transactions are free (0% MDR). Cards/netbanking may incur gateway fees.
              {'\n'}For refunds, contact support@astroquest.app within 7 days.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

function featureLabel(key: string): string {
  switch (key) {
    case 'overview': return 'Overview';
    case 'today':    return 'Today\'s Muhurtas';
    case 'charts':   return 'Charts';
    // v8.4 — 'similar' feature key removed with Similar Charts tab hard-delete.
    case 'vidhata':  return 'Vidhaata Chat';
    default: return key;
  }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, paddingBottom: 28, maxHeight: '92%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  closeBtn: { padding: 4 },
  reasonBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 10,
  },
  reasonText: { flex: 1, color: '#4338CA', fontSize: 13, lineHeight: 18 },
  planCard: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14,
    padding: 14, marginBottom: 10, backgroundColor: '#F8FAFC',
  },
  planCardActive: { borderColor: '#4338CA', backgroundColor: '#EEF2FF' },
  planName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  planDesc: { fontSize: 12.5, color: '#475569', marginTop: 3, lineHeight: 17 },
  planPrice: { fontSize: 22, fontWeight: '800', color: '#4338CA' },
  planCycle: { fontSize: 11, color: '#64748B' },
  featureList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  featurePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  featurePillText: { fontSize: 11, color: '#065F46', fontWeight: '600' },
  couponBox: { marginTop: 4, marginBottom: 10, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  couponLabel: { fontSize: 12.5, color: '#475569', marginBottom: 6, fontWeight: '600' },
  couponInput: {
    flex: 1, borderWidth: 1, borderColor: '#CBD5E1',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13.5, color: '#0F172A', backgroundColor: '#FFFFFF', marginRight: 8,
  },
  couponBtn: { backgroundColor: '#4338CA', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  couponBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  couponErr: { color: '#DC2626', fontSize: 12, marginTop: 6 },
  couponOk: { color: '#047857', fontSize: 12.5, marginTop: 6, fontWeight: '600' },
  summary: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 13, color: '#475569' },
  summaryValue: { fontSize: 13.5, color: '#0F172A', fontWeight: '600' },
  payBtn: {
    backgroundColor: '#4338CA', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  payBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  payBtnGhost: {
    backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  payBtnGhostText: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, marginTop: 4,
  },
  restoreBtnText: { color: '#4338CA', fontSize: 13, fontWeight: '600' },
  simBox: {
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FCD34D', marginTop: 8,
  },
  simTitle: { fontSize: 15, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  simSub: { fontSize: 12.5, color: '#78350F', marginBottom: 10, lineHeight: 17 },
  mono: { fontFamily: 'monospace' },
  legal: { fontSize: 10.5, color: '#94A3B8', textAlign: 'center', marginTop: 10, lineHeight: 14 },
});

export default SubscriptionModal;
