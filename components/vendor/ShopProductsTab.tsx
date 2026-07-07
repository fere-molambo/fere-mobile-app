import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Switch, ActivityIndicator, Alert,
} from 'react-native';
import { Package, Calendar, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ProductItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  price_type: string;
  main_media_url?: string | null;
  media_urls?: string[] | null;
  is_active: boolean;
  quantity_available?: number | null;
  condition?: string | null;
  discount_percent?: number | null;
}

interface ServiceItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  main_media_url?: string | null;
  media_urls?: string[] | null;
  is_active: boolean;
  requires_booking: boolean;
  discount_percent?: number | null;
}

interface Props {
  products: ProductItem[];
  services: ServiceItem[];
  onRefresh: () => void;
  onEditProduct: (product: ProductItem) => void;
  onEditService: (service: ServiceItem) => void;
  onCreateProduct: () => void;
  onCreateService: () => void;
}

function formatPrice(n: number) {
  return Math.round(n).toLocaleString('fr-FR').replace(/\s/g, '\u00a0');
}

const CONDITION_LABELS: Record<string, string> = {
  neuf: 'Neuf',
  occasion: 'Occasion',
  reconditionne: 'Reconditionné',
};

export default function ShopProductsTab({
  products, services, onRefresh, onEditProduct, onEditService, onCreateProduct, onCreateService,
}: Props) {
  const [subTab, setSubTab] = useState<'products' | 'services'>('products');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'product' | 'service'; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleToggleActive = async (id: string, type: 'product' | 'service', current: boolean) => {
    setTogglingId(id);
    const table = type === 'product' ? 'products' : 'services';
    await supabase.from(table).update({ is_active: !current, updated_at: new Date().toISOString() }).eq('id', id);
    onRefresh();
    setTogglingId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'product') {
        // Bloquer si une commande de ce produit est en cours (ni livrée ni annulée)
        const { data: activeItems } = await supabase
          .from('order_items')
          .select('id, order:orders!inner(status)')
          .eq('product_id', deleteTarget.id)
          .not('order.status', 'in', '("delivered","cancelled")')
          .limit(1);
        if (activeItems && activeItems.length > 0) {
          Alert.alert(
            'Suppression impossible',
            "Une commande de ce produit est en cours. Attendez qu'elle soit livrée ou annulée avant de le supprimer."
          );
          return;
        }
        const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
        if (error) {
          // Référencé par des commandes passées : on retire de la vente au lieu de supprimer
          const { error: softErr } = await supabase
            .from('products')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', deleteTarget.id);
          if (softErr) throw softErr;
          Alert.alert('Produit retiré', "Ce produit a un historique de commandes : il a été retiré de la vente au lieu d'être supprimé définitivement.");
        }
      } else {
        // Bloquer si une réservation de ce service est en cours
        const { data: activeBookings } = await supabase
          .from('service_bookings')
          .select('id')
          .eq('service_id', deleteTarget.id)
          .not('status', 'in', '("completed","cancelled","expired")')
          .limit(1);
        if (activeBookings && activeBookings.length > 0) {
          Alert.alert(
            'Suppression impossible',
            "Une réservation de ce service est en cours. Attendez qu'elle soit terminée ou annulée avant de le supprimer."
          );
          return;
        }
        // Supprimer un service efface ses réservations passées (cascade DB) : on le retire de la vente s'il a un historique
        const { data: anyBooking } = await supabase
          .from('service_bookings')
          .select('id')
          .eq('service_id', deleteTarget.id)
          .limit(1);
        if (anyBooking && anyBooking.length > 0) {
          const { error: softErr } = await supabase
            .from('services')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', deleteTarget.id);
          if (softErr) throw softErr;
          Alert.alert('Service retiré', "Ce service a un historique de réservations : il a été retiré de la vente au lieu d'être supprimé définitivement.");
        } else {
          const { error } = await supabase.from('services').delete().eq('id', deleteTarget.id);
          if (error) throw error;
        }
      }
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'La suppression a échoué. Veuillez réessayer.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.subTabs}>
        <TouchableOpacity style={[styles.subTab, subTab === 'products' && styles.subTabActive]} onPress={() => setSubTab('products')}>
          <Text style={[styles.subTabText, subTab === 'products' && styles.subTabTextActive]}>Produits ({products.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, subTab === 'services' && styles.subTabActive]} onPress={() => setSubTab('services')}>
          <Text style={[styles.subTabText, subTab === 'services' && styles.subTabTextActive]}>Prestations ({services.length})</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.viewToggle}>
          <TouchableOpacity style={[styles.viewBtn, viewMode === 'cards' && styles.viewBtnActive]} onPress={() => setViewMode('cards')}>
            <Text style={[styles.viewBtnText, viewMode === 'cards' && styles.viewBtnTextActive]}>Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]} onPress={() => setViewMode('list')}>
            <Text style={[styles.viewBtnText, viewMode === 'list' && styles.viewBtnTextActive]}>Liste</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={subTab === 'products' ? onCreateProduct : onCreateService}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>{subTab === 'products' ? 'Ajouter un produit' : 'Ajouter un service'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {subTab === 'products' && (
          products.length === 0 ? (
            <View style={styles.empty}>
              <Package color="#ccc" size={40} />
              <Text style={styles.emptyText}>Aucun produit</Text>
              <Text style={styles.emptyHint}>Ajoutez votre premier produit</Text>
            </View>
          ) : (
            products.map((p) => (
              viewMode === 'cards'
                ? <ProductCard key={p.id} product={p} togglingId={togglingId} onToggle={handleToggleActive} onEdit={onEditProduct} onDelete={(id, name) => setDeleteTarget({ id, type: 'product', name })} />
                : <ProductListItem key={p.id} product={p} togglingId={togglingId} onToggle={handleToggleActive} onEdit={onEditProduct} onDelete={(id, name) => setDeleteTarget({ id, type: 'product', name })} />
            ))
          )
        )}

        {subTab === 'services' && (
          services.length === 0 ? (
            <View style={styles.empty}>
              <Calendar color="#ccc" size={40} />
              <Text style={styles.emptyText}>Aucune prestation</Text>
              <Text style={styles.emptyHint}>Ajoutez votre premiere prestation</Text>
            </View>
          ) : (
            services.map((s) => (
              viewMode === 'cards'
                ? <ServiceCard key={s.id} service={s} togglingId={togglingId} onToggle={handleToggleActive} onEdit={onEditService} onDelete={(id, name) => setDeleteTarget({ id, type: 'service', name })} />
                : <ServiceListItem key={s.id} service={s} togglingId={togglingId} onToggle={handleToggleActive} onEdit={onEditService} onDelete={(id, name) => setDeleteTarget({ id, type: 'service', name })} />
            ))
          )
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {deleteTarget && (
        <ConfirmDialog
          visible
          title="Supprimer"
          message={`Voulez-vous vraiment supprimer "${deleteTarget.name}" ?`}
          confirmText="Supprimer"
          cancelText="Annuler"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
          destructive
        />
      )}
    </View>
  );
}

function ImageCarousel({ mainUrl, mediaUrls }: { mainUrl?: string | null; mediaUrls?: string[] | null }) {
  const images: string[] = [];
  if (mainUrl) images.push(mainUrl);
  if (mediaUrls) {
    for (const u of mediaUrls) {
      if (u && !images.includes(u)) images.push(u);
    }
  }

  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <View style={[cardStyles.image, cardStyles.imagePlaceholder]}>
        <Package color="#ccc" size={32} />
      </View>
    );
  }

  return (
    <View style={cardStyles.imageContainer}>
      <Image source={{ uri: images[idx] }} style={cardStyles.image} />
      {images.length > 1 && (
        <>
          <TouchableOpacity style={[cardStyles.navBtn, cardStyles.navBtnLeft]} onPress={() => setIdx((i) => (i - 1 + images.length) % images.length)}>
            <ChevronLeft size={18} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={[cardStyles.navBtn, cardStyles.navBtnRight]} onPress={() => setIdx((i) => (i + 1) % images.length)}>
            <ChevronRight size={18} color="#333" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function ProductCard({ product, togglingId, onToggle, onEdit, onDelete }: {
  product: ProductItem; togglingId: string | null;
  onToggle: (id: string, type: 'product' | 'service', current: boolean) => void;
  onEdit: (p: ProductItem) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <View style={cardStyles.card}>
      <ImageCarousel mainUrl={product.main_media_url} mediaUrls={product.media_urls} />
      <View style={cardStyles.cardBody}>
        <Text style={cardStyles.name} numberOfLines={1}>{product.name}</Text>
        {product.description ? <Text style={cardStyles.desc} numberOfLines={1}>{product.description}</Text> : null}
        <View style={cardStyles.priceRow}>
          <Text style={cardStyles.price}>{formatPrice(product.price)} FCFA</Text>
          {product.condition && (
            <View style={cardStyles.conditionBadge}>
              <Text style={cardStyles.conditionText}>{CONDITION_LABELS[product.condition] || product.condition}</Text>
            </View>
          )}
        </View>
        {product.quantity_available != null && (
          <Text style={cardStyles.stock}>Stock: {product.quantity_available}</Text>
        )}
        <View style={cardStyles.actions}>
          <View style={cardStyles.toggleRow}>
            {togglingId === product.id ? (
              <ActivityIndicator size="small" color="#003f2f" />
            ) : (
              <Switch
                value={product.is_active}
                onValueChange={() => onToggle(product.id, 'product', product.is_active)}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={product.is_active ? '#003f2f' : '#9ca3af'}
              />
            )}
            <Text style={cardStyles.toggleLabel}>{product.is_active ? 'Actif' : 'Inactif'}</Text>
          </View>
          <View style={cardStyles.iconBtns}>
            <TouchableOpacity style={cardStyles.iconBtn} onPress={() => onEdit(product)}>
              <Pencil size={18} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={cardStyles.iconBtn} onPress={() => onDelete(product.id, product.name)}>
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

function ProductListItem({ product, togglingId, onToggle, onEdit, onDelete }: {
  product: ProductItem; togglingId: string | null;
  onToggle: (id: string, type: 'product' | 'service', current: boolean) => void;
  onEdit: (p: ProductItem) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <View style={listStyles.row}>
      {product.main_media_url ? (
        <Image source={{ uri: product.main_media_url }} style={listStyles.thumb} />
      ) : (
        <View style={[listStyles.thumb, listStyles.thumbPlaceholder]}>
          <Package color="#ccc" size={16} />
        </View>
      )}
      <View style={listStyles.info}>
        <Text style={listStyles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={listStyles.price}>{formatPrice(product.price)} FCFA</Text>
      </View>
      {togglingId === product.id ? (
        <ActivityIndicator size="small" color="#003f2f" />
      ) : (
        <Switch
          value={product.is_active}
          onValueChange={() => onToggle(product.id, 'product', product.is_active)}
          trackColor={{ false: '#d1d5db', true: '#86efac' }}
          thumbColor={product.is_active ? '#003f2f' : '#9ca3af'}
        />
      )}
      <TouchableOpacity onPress={() => onEdit(product)}>
        <Pencil size={16} color="#666" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDelete(product.id, product.name)}>
        <Trash2 size={16} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

function ServiceCard({ service, togglingId, onToggle, onEdit, onDelete }: {
  service: ServiceItem; togglingId: string | null;
  onToggle: (id: string, type: 'product' | 'service', current: boolean) => void;
  onEdit: (s: ServiceItem) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <View style={cardStyles.card}>
      <ImageCarousel mainUrl={service.main_media_url} mediaUrls={service.media_urls} />
      <View style={cardStyles.cardBody}>
        <Text style={cardStyles.name} numberOfLines={1}>{service.name}</Text>
        {service.description ? <Text style={cardStyles.desc} numberOfLines={1}>{service.description}</Text> : null}
        <View style={cardStyles.priceRow}>
          <Text style={cardStyles.price}>{formatPrice(service.price)} FCFA</Text>
          {service.requires_booking && (
            <View style={[cardStyles.conditionBadge, { backgroundColor: '#dbeafe' }]}>
              <Text style={[cardStyles.conditionText, { color: '#2563eb' }]}>Réservation</Text>
            </View>
          )}
        </View>
        <View style={cardStyles.actions}>
          <View style={cardStyles.toggleRow}>
            {togglingId === service.id ? (
              <ActivityIndicator size="small" color="#003f2f" />
            ) : (
              <Switch
                value={service.is_active}
                onValueChange={() => onToggle(service.id, 'service', service.is_active)}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={service.is_active ? '#003f2f' : '#9ca3af'}
              />
            )}
            <Text style={cardStyles.toggleLabel}>{service.is_active ? 'Actif' : 'Inactif'}</Text>
          </View>
          <View style={cardStyles.iconBtns}>
            <TouchableOpacity style={cardStyles.iconBtn} onPress={() => onEdit(service)}>
              <Pencil size={18} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={cardStyles.iconBtn} onPress={() => onDelete(service.id, service.name)}>
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

function ServiceListItem({ service, togglingId, onToggle, onEdit, onDelete }: {
  service: ServiceItem; togglingId: string | null;
  onToggle: (id: string, type: 'product' | 'service', current: boolean) => void;
  onEdit: (s: ServiceItem) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <View style={listStyles.row}>
      {service.main_media_url ? (
        <Image source={{ uri: service.main_media_url }} style={listStyles.thumb} />
      ) : (
        <View style={[listStyles.thumb, listStyles.thumbPlaceholder]}>
          <Calendar color="#ccc" size={16} />
        </View>
      )}
      <View style={listStyles.info}>
        <Text style={listStyles.name} numberOfLines={1}>{service.name}</Text>
        <Text style={listStyles.price}>{formatPrice(service.price)} FCFA</Text>
      </View>
      {togglingId === service.id ? (
        <ActivityIndicator size="small" color="#003f2f" />
      ) : (
        <Switch
          value={service.is_active}
          onValueChange={() => onToggle(service.id, 'service', service.is_active)}
          trackColor={{ false: '#d1d5db', true: '#86efac' }}
          thumbColor={service.is_active ? '#003f2f' : '#9ca3af'}
        />
      )}
      <TouchableOpacity onPress={() => onEdit(service)}>
        <Pencil size={16} color="#666" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDelete(service.id, service.name)}>
        <Trash2 size={16} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subTabs: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8,
    backgroundColor: '#fff',
  },
  subTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  subTabActive: { backgroundColor: '#f0fdf4', borderColor: '#003f2f' },
  subTabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  subTabTextActive: { color: '#003f2f' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  viewToggle: { flexDirection: 'row', gap: 4 },
  viewBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f5f5f5',
  },
  viewBtnActive: { backgroundColor: '#003f2f' },
  viewBtnText: { fontSize: 12, fontWeight: '600', color: '#666' },
  viewBtnTextActive: { color: '#fff' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#003f2f', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: 16 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#999' },
  emptyHint: { fontSize: 13, color: '#aaa' },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  imageContainer: { position: 'relative' },
  image: { width: '100%', height: 220, backgroundColor: '#f5f5f5' },
  imagePlaceholder: {
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0',
  },
  navBtn: {
    position: 'absolute', top: '50%', marginTop: -16,
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  navBtnLeft: { left: 8 },
  navBtnRight: { right: 8 },
  cardBody: { padding: 16 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  desc: { fontSize: 13, color: '#666', marginTop: 2 },
  priceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8,
  },
  price: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  conditionBadge: {
    backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  conditionText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  stock: { fontSize: 13, color: '#16a34a', marginTop: 4 },
  actions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#666' },
  iconBtns: { flexDirection: 'row', gap: 12 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f5f5',
    justifyContent: 'center', alignItems: 'center',
  },
});

const listStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  thumbPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  price: { fontSize: 13, fontWeight: '700', color: '#003f2f', marginTop: 2 },
});
