import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { User, Heart, Package, RotateCcw, Wallet, Bell, Circle as HelpCircle, Scale, ChevronRight, LogOut, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import DeleteAccountModal from '@/components/DeleteAccountModal';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  route: string;
  comingSoon?: boolean;
}

const ACCOUNT_ITEMS: MenuItem[] = [
  {
    icon: <User color="#003f2f" size={20} />,
    label: 'Profil',
    route: '/settings/profile',
  },
];

const ACTIVITY_ITEMS: MenuItem[] = [
  {
    icon: <Heart color="#003f2f" size={20} />,
    label: 'Favoris',
    route: '/settings/favorites',
  },
  {
    icon: <Package color="#003f2f" size={20} />,
    label: 'Commandes',
    route: '/settings/orders',
  },
  {
    icon: <RotateCcw color="#003f2f" size={20} />,
    label: 'Remboursements',
    route: '/settings/transactions',
  },
];

const PREFERENCE_ITEMS: MenuItem[] = [
  {
    icon: <Bell color="#003f2f" size={20} />,
    label: 'Notifications',
    route: '/settings/notifications',
  },
  {
    icon: <HelpCircle color="#003f2f" size={20} />,
    label: 'FAQ',
    route: '/settings/faq',
  },
  {
    icon: <Scale color="#003f2f" size={20} />,
    label: 'Mentions légales',
    route: '/settings/legal',
  },
];

const VENDOR_ACCOUNT_ITEMS: MenuItem[] = [
  {
    icon: <User color="#003f2f" size={20} />,
    label: 'Profil',
    route: '/settings/profile',
  },
];

const VENDOR_ACTIVITY_ITEMS: MenuItem[] = [
  {
    icon: <Wallet color="#003f2f" size={20} />,
    label: 'Mes versements',
    route: '/settings/payouts',
  },
  {
    icon: <RotateCcw color="#003f2f" size={20} />,
    label: 'Remboursements',
    route: '/settings/transactions',
  },
];

const VENDOR_PREFERENCE_ITEMS: MenuItem[] = [
  {
    icon: <Bell color="#003f2f" size={20} />,
    label: 'Notifications',
    route: '/settings/notifications',
  },
  {
    icon: <HelpCircle color="#003f2f" size={20} />,
    label: 'FAQ',
    route: '/settings/faq',
  },
  {
    icon: <Scale color="#003f2f" size={20} />,
    label: 'Mentions légales',
    route: '/settings/legal',
  },
];

const DRIVER_ACCOUNT_ITEMS: MenuItem[] = [
  {
    icon: <User color="#003f2f" size={20} />,
    label: 'Profil',
    route: '/settings/profile',
  },
];

const DRIVER_ACTIVITY_ITEMS: MenuItem[] = [
  {
    icon: <Wallet color="#003f2f" size={20} />,
    label: 'Mes versements',
    route: '/settings/payouts',
  },
];

const DRIVER_PREFERENCE_ITEMS: MenuItem[] = [
  {
    icon: <Bell color="#003f2f" size={20} />,
    label: 'Notifications',
    route: '/settings/notifications',
  },
  {
    icon: <HelpCircle color="#003f2f" size={20} />,
    label: 'FAQ',
    route: '/settings/faq',
  },
];

export default function SettingsScreen() {
  const { signOut, userRole } = useAuth();
  const router = useRouter();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isDriver = userRole === 'livreur';
  const isVendor = userRole === 'vendeur' || userRole === 'equipe';

  const handleLogout = async () => {
    setShowLogoutDialog(false);
    await signOut();
    router.replace('/auth/login');
  };

  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity
      key={item.label}
      style={styles.menuItem}
      onPress={() => router.push(item.route as any)}
    >
      <View style={styles.menuItemLeft}>
        <View style={styles.iconContainer}>{item.icon}</View>
        <Text style={styles.menuItemText}>{item.label}</Text>
        {item.comingSoon && (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Bientot</Text>
          </View>
        )}
      </View>
      <ChevronRight color="#999" size={20} />
    </TouchableOpacity>
  );

  if (isVendor) {
    return (
      <View style={styles.container}>
        <AppHeader hideCart />

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mon compte</Text>
            {VENDOR_ACCOUNT_ITEMS.map(renderMenuItem)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mes activites</Text>
            {VENDOR_ACTIVITY_ITEMS.map(renderMenuItem)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Préférences</Text>
            {VENDOR_PREFERENCE_ITEMS.map(renderMenuItem)}
          </View>

          <View style={styles.logoutSection}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => setShowLogoutDialog(true)}
            >
              <LogOut color="#ff4444" size={20} />
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={() => setShowDeleteModal(true)}
            >
              <Trash2 color="#DC2626" size={18} />
              <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <ConfirmDialog
          visible={showLogoutDialog}
          title="Déconnexion"
          message="Etes-vous sur de vouloir vous deconnecter ?"
          confirmText="Déconnexion"
          cancelText="Annuler"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutDialog(false)}
        />
        <DeleteAccountModal
          visible={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
        />
      </View>
    );
  }

  if (isDriver) {
    return (
      <View style={styles.container}>
        <AppHeader hideCart />

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mon compte</Text>
            {DRIVER_ACCOUNT_ITEMS.map(renderMenuItem)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mes activites</Text>
            {DRIVER_ACTIVITY_ITEMS.map(renderMenuItem)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Préférences</Text>
            {DRIVER_PREFERENCE_ITEMS.map(renderMenuItem)}
          </View>

          <View style={styles.logoutSection}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => setShowLogoutDialog(true)}
            >
              <LogOut color="#ff4444" size={20} />
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={() => setShowDeleteModal(true)}
            >
              <Trash2 color="#DC2626" size={18} />
              <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <ConfirmDialog
          visible={showLogoutDialog}
          title="Déconnexion"
          message="Etes-vous sur de vouloir vous deconnecter ?"
          confirmText="Déconnexion"
          cancelText="Annuler"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutDialog(false)}
        />
        <DeleteAccountModal
          visible={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon compte</Text>
          {ACCOUNT_ITEMS.map(renderMenuItem)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes activites</Text>
          {ACTIVITY_ITEMS.map(renderMenuItem)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Préférences</Text>
          {PREFERENCE_ITEMS.map(renderMenuItem)}
        </View>

        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => setShowLogoutDialog(true)}
          >
            <LogOut color="#ff4444" size={20} />
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={() => setShowDeleteModal(true)}
          >
            <Trash2 color="#DC2626" size={18} />
            <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showLogoutDialog}
        title="Déconnexion"
        message="Etes-vous sur de vouloir vous deconnecter ?"
        confirmText="Déconnexion"
        cancelText="Annuler"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutDialog(false)}
      />
      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f3f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  comingSoonBadge: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e65100',
  },
  logoutSection: {
    marginTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff4444',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 12,
  },
  deleteAccountText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
  },
});
