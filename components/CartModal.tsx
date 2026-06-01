import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Pressable,
} from 'react-native';
import { ShoppingCart, Minus, Plus, Trash2, X } from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';
import { useRouter } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatPrice(n: number) {
  return n.toLocaleString('fr-FR').replace(/\s/g, ' ');
}

export default function CartModal() {
  const {
    items,
    removeFromCart,
    updateQuantity,
    updateProposedPrice,
    clearCart,
    getCartCount,
    getSubtotal,
    isCartOpen,
    closeCart,
  } = useCart();
  const router = useRouter();

  const handleContinue = () => {
    closeCart();
    router.push('/checkout');
  };

  return (
    <Modal visible={isCartOpen} transparent animationType="slide" onRequestClose={closeCart}>
      <Pressable style={styles.overlay} onPress={closeCart} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ShoppingCart color="#333" size={22} />
            <Text style={styles.headerTitle}>Mon Panier ({getCartCount()} article{getCartCount() > 1 ? 's' : ''})</Text>
          </View>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ShoppingCart color="#d0d0d0" size={60} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Votre panier est vide</Text>
            <Text style={styles.emptyText}>Ajoutez des produits pour commencer</Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <Image
                    source={{ uri: item.product.main_media_url || 'https://via.placeholder.com/80' }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                  <View style={styles.itemDetails}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemTitleArea}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
                        <Text style={styles.shopName}>{item.shop.name}</Text>
                        {(item.selectedColor || item.selectedSize) && (
                          <Text style={styles.itemVariant}>
                            {item.selectedColor ? `Couleur: ${item.selectedColor.hex}` : ''}
                            {item.selectedColor && item.selectedSize ? ' \u2022 ' : ''}
                            {item.selectedSize ? `Taille: ${item.selectedSize}` : ''}
                          </Text>
                        )}
                        <Text style={styles.itemUnitPrice}>{formatPrice(item.unitPrice)} FCFA / unité</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.removeBtn}>
                        <Trash2 color="#ef4444" size={18} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.itemFooter}>
                      <View style={styles.quantityRow}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus color="#333" size={16} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus color="#333" size={16} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.itemTotal}>{formatPrice((item.proposedPrice || item.unitPrice) * item.quantity)} FCFA</Text>
                    </View>

                    {item.product.min_quantity && item.product.min_quantity > 1 && (
                      <Text style={styles.minQtyText}>Min: {item.product.min_quantity}</Text>
                    )}

                    {item.product.is_negotiable && (
                      <View style={styles.proposedPriceRow}>
                        <Text style={styles.proposedPriceLabel}>Prix proposé (FCFA)</Text>
                        <TextInput
                          style={[
                            styles.proposedPriceInput,
                            item.proposedPrice !== null &&
                              item.proposedPrice > 0 &&
                              item.proposedPrice < (item.product.min_auto_price ?? item.unitPrice) &&
                              styles.proposedPriceInputError,
                          ]}
                          value={item.proposedPrice?.toString() || ''}
                          onChangeText={(val) => updateProposedPrice(item.id, Number(val) || 0)}
                          keyboardType="numeric"
                          placeholder={`Min: ${(item.product.min_auto_price ?? item.unitPrice).toLocaleString()} FCFA`}
                          placeholderTextColor="#999"
                        />
                        {item.proposedPrice !== null &&
                          item.proposedPrice > 0 &&
                          item.proposedPrice < (item.product.min_auto_price ?? item.unitPrice) && (
                            <Text style={styles.proposedPriceHint}>
                              Prix minimum : {(item.product.min_auto_price ?? item.unitPrice).toLocaleString()} FCFA
                            </Text>
                          )}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Sous-total</Text>
                <Text style={styles.subtotalValue}>{formatPrice(getSubtotal())} FCFA</Text>
              </View>

              <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
                <Text style={styles.continueBtnText}>Continuer</Text>
              </TouchableOpacity>

              <View style={styles.footerActions}>
                <TouchableOpacity style={styles.closeBtn} onPress={closeCart}>
                  <Text style={styles.closeBtnText}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearCart}>
                  <Text style={styles.clearBtnText}>Vider</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
  },
  itemsList: {
    maxHeight: SCREEN_HEIGHT * 0.45,
    paddingHorizontal: 16,
  },
  cartItem: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitleArea: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  shopName: {
    fontSize: 13,
    color: '#666',
    marginTop: 1,
  },
  itemVariant: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  itemUnitPrice: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  removeBtn: {
    padding: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    minWidth: 28,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  minQtyText: {
    fontSize: 11,
    color: '#888',
    textAlign: 'right',
    marginTop: 2,
  },
  proposedPriceRow: {
    marginTop: 8,
  },
  proposedPriceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  proposedPriceInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#333',
  },
  proposedPriceInputError: {
    borderColor: '#e53935',
  },
  proposedPriceHint: {
    fontSize: 11,
    color: '#e53935',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subtotalLabel: {
    fontSize: 16,
    color: '#666',
  },
  subtotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  continueBtn: {
    backgroundColor: '#003f2f',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 12,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
