import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ReceiptData {
  orderNumber: string;
  date: string;
  shopName: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  customerName?: string | null;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentStatus: string;
}

const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

function buildReceiptHtml(r: ReceiptData): string {
  const rows = r.items
    .map(
      (i) => `<tr>
        <td>${i.name}</td>
        <td style="text-align:center">${i.quantity}</td>
        <td style="text-align:right">${fmt(i.unit_price)}</td>
        <td style="text-align:right">${fmt(i.total_price)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Roboto, Arial, sans-serif; color: #1a1a1a; padding: 24px; }
    .brand { color: #003f2f; font-size: 26px; font-weight: 800; letter-spacing: 2px; }
    .sub { color: #888; font-size: 12px; margin-top: 2px; }
    .box { border: 1px solid #e5e5e5; border-radius: 10px; padding: 14px 16px; margin-top: 16px; }
    .row { display: flex; justify-content: space-between; font-size: 13px; margin: 3px 0; }
    .muted { color: #777; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th { text-align: left; color: #777; font-weight: 600; border-bottom: 2px solid #003f2f; padding: 6px 4px; }
    td { padding: 8px 4px; border-bottom: 1px solid #f0f0f0; }
    .totals { margin-top: 14px; font-size: 13px; }
    .totals .row.total { font-size: 16px; font-weight: 800; color: #003f2f; border-top: 2px solid #003f2f; padding-top: 8px; margin-top: 8px; }
    .paid { display: inline-block; margin-top: 14px; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #e8f3ef; color: #003f2f; }
    .footer { margin-top: 28px; text-align: center; color: #999; font-size: 11px; }
  </style></head><body>
  <div class="brand">FERE</div>
  <div class="sub">Reçu de commande</div>

  <div class="box">
    <div class="row"><span class="muted">Commande</span><span><b>${r.orderNumber}</b></span></div>
    <div class="row"><span class="muted">Date</span><span>${r.date}</span></div>
    <div class="row"><span class="muted">Boutique</span><span>${r.shopName}</span></div>
    ${r.shopAddress ? `<div class="row"><span class="muted">Adresse</span><span>${r.shopAddress}</span></div>` : ''}
    ${r.shopPhone ? `<div class="row"><span class="muted">Téléphone</span><span>${r.shopPhone}</span></div>` : ''}
    ${r.customerName ? `<div class="row"><span class="muted">Client</span><span>${r.customerName}</span></div>` : ''}
  </div>

  <table>
    <thead><tr><th>Article</th><th style="text-align:center">Qté</th><th style="text-align:right">P.U.</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span class="muted">Sous-total</span><span>${fmt(r.subtotal)}</span></div>
    <div class="row"><span class="muted">Livraison</span><span>${fmt(r.deliveryFee)}</span></div>
    <div class="row total"><span>TOTAL</span><span>${fmt(r.total)}</span></div>
  </div>

  <div class="paid">${r.paymentStatus === 'paid' ? 'PAYÉ' : 'Paiement : ' + r.paymentStatus}</div>
  <div class="footer">Merci pour votre confiance — FERE</div>
  </body></html>`;
}

export async function printReceipt(data: ReceiptData): Promise<void> {
  try {
    const html = buildReceiptHtml(data);
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return;
    }
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Reçu ${data.orderNumber}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      await Print.printAsync({ uri });
    }
  } catch (err) {
    console.error('Receipt error:', err);
    Alert.alert('Erreur', 'Impossible de générer le reçu.');
  }
}
