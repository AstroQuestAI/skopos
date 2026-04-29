/**
 * ProfileScreen — v7.0 THIN WRAPPER.
 *
 * Mounts ProfileScreenV2 inside a full-screen Modal with the AstroQuest
 * AppHeader pinned at the top. All business logic now lives in the
 * Zustand `useProfileStore()`, so this file is glue only.
 */
import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { ProfileScreenV2 } from '../screens/ProfileScreenV2';
import { SubscriptionModal } from './SubscriptionModal';
import { useProfileStore } from '../state/profileStore';

// ---- Compatibility types (exported for the rest of the app) ----
export type { ProfileInfo, AccessMatrix, InitResult } from '../state/profileStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Retained for backwards-compat with old callsites — ignored
   *  (the Zustand store is the single source of truth). */
  profile?: any;
  access?: any;
  /** Retained — called after save with `{profile, access}` from the store. */
  onRefresh?: (res: { profile: any; access: any }) => void;
  authUser?: { name?: string; email?: string; picture?: string } | null;
  onLogout?: () => void;
  /** AstroQuest AppHeader injected by the parent. */
  header?: React.ReactNode;
}

export const ProfileScreen: React.FC<Props> = ({
  visible, onClose, onRefresh, authUser, header,
}) => {
  const { profile, access, init } = useProfileStore();
  const [paywallOpen, setPaywallOpen] = useState(false);

  // On first open, refresh from backend to ensure we show the current user.
  useEffect(() => {
    if (!visible) return;
    init({ email: authUser?.email, name: authUser?.name }).then((res) => {
      if (res) onRefresh?.(res);
    });
  }, [visible, authUser?.email]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        {header}
        <View style={{ flex: 1 }}>
          <ProfileScreenV2
            authUser={authUser}
            onUpgrade={() => setPaywallOpen(true)}
            onSaved={() => {
              if (profile || access) onRefresh?.({ profile, access });
              onClose();
            }}
            deviceId={profile?.device_id}
          />
        </View>
      </View>

      <SubscriptionModal
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onPurchased={(res) => {
          onRefresh?.(res);
          setPaywallOpen(false);
        }}
        preferredPlanId="full"
      />
    </Modal>
  );
};

export default ProfileScreen;
