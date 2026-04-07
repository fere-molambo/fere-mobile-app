import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ORANGE_MONEY_MERCHANT_KEY = Deno.env.get("ORANGE_MONEY_MERCHANT_KEY") || "";
const ORANGE_MONEY_CLIENT_ID = Deno.env.get("ORANGE_MONEY_CLIENT_ID") || "";
const ORANGE_MONEY_CLIENT_SECRET = Deno.env.get("ORANGE_MONEY_CLIENT_SECRET") || "";
const ORANGE_MONEY_AUTH_HEADER = Deno.env.get("ORANGE_MONEY_AUTH_HEADER") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function getOrangeMoneyAuthHeader(): string {
  if (ORANGE_MONEY_CLIENT_ID && ORANGE_MONEY_CLIENT_SECRET) {
    const encoded = btoa(`${ORANGE_MONEY_CLIENT_ID}:${ORANGE_MONEY_CLIENT_SECRET}`);
    return `Basic ${encoded}`;
  }
  return ORANGE_MONEY_AUTH_HEADER;
}

const OM_TOKEN_URL = "https://api.orange.com/oauth/v3/token";
const OM_WEBPAYMENT_URL = "https://api.orange.com/orange-money-webpay/ml/v1/webpayment";
const OM_TRANSACTION_STATUS_URL = "https://api.orange.com/orange-money-webpay/ml/v1/transactionstatus";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateOrderNumber(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  return `FERE_${ts}_${rand}`;
}

async function getOAuthToken(): Promise<string> {
  const resp = await fetch(OM_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": getOrangeMoneyAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth token error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return data.access_token;
}

async function initializeWebPayment(
  token: string,
  orderId: string,
  amount: number,
  returnUrl: string,
  cancelUrl: string,
  notifUrl: string
) {
  const resp = await fetch(OM_WEBPAYMENT_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      merchant_key: ORANGE_MONEY_MERCHANT_KEY,
      currency: "OUV",
      order_id: orderId,
      amount: amount,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notif_url: notifUrl,
      lang: "fr",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Web payment init error: ${resp.status} ${text}`);
  }

  return resp.json();
}

async function checkTransactionStatus(
  token: string,
  orderId: string,
  amount: number,
  payToken: string
) {
  const resp = await fetch(OM_TRANSACTION_STATUS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: orderId,
      amount: amount,
      pay_token: payToken,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Transaction status error: ${resp.status} ${text}`);
  }

  return resp.json();
}

async function completeBookingAdvance(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  ref: string,
  amount: number
) {
  const { data: booking } = await supabase
    .from("service_bookings")
    .select("id, customer_id, travel_fee_paid")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) throw new Error("Reservation introuvable");
  if (booking.travel_fee_paid) return { already_completed: true };

  await supabase
    .from("service_bookings")
    .update({
      payment_status: "partial",
      travel_fee_paid: true,
      payment_reference: ref,
      advance_paid: amount,
    })
    .eq("id", bookingId);

  await supabase.from("payment_transactions").insert({
    user_id: booking.customer_id,
    reference: ref,
    amount,
    currency: "XOF",
    status: "success",
    payment_type: "service_booking_advance",
    related_id: bookingId,
    paid_at: new Date().toISOString(),
    metadata: { booking_id: bookingId, payment_type: "service_booking_advance" },
  });

  return { booking_id: bookingId };
}

async function completeBookingBalance(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  ref: string,
  amount: number,
  completionType: string
) {
  const { data: booking } = await supabase
    .from("service_bookings")
    .select("id, customer_id, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) throw new Error("Reservation introuvable");
  if (booking.status === "completed" || booking.status === "partial") {
    return { already_completed: true };
  }

  const newStatus = completionType === "partial" ? "partial" : "completed";

  await supabase
    .from("service_bookings")
    .update({
      status: newStatus,
      completion_type: completionType,
      balance_payment_status: "paid",
      balance_payment_reference: ref,
      payment_status: "paid",
      completed_at: new Date().toISOString(),
      partial_payment_amount: completionType === "partial" ? amount : null,
    })
    .eq("id", bookingId);

  await supabase.from("payment_transactions").insert({
    user_id: booking.customer_id,
    reference: ref,
    amount,
    currency: "XOF",
    status: "success",
    payment_type: "service_booking_balance",
    related_id: bookingId,
    paid_at: new Date().toISOString(),
    metadata: { booking_id: bookingId, payment_type: "service_booking_balance", completion_type: completionType },
  });

  return { booking_id: bookingId };
}

async function completeOrderBalance(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  ref: string,
  amount: number
) {
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, balance_amount, advance_paid, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) throw new Error("Commande introuvable");
  if (order.payment_status === "paid") return { already_completed: true };

  await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      advance_paid: (order.advance_paid || 0) + amount,
      balance_amount: 0,
    })
    .eq("id", orderId);

  await supabase
    .from("delivery_requests")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("is_return", false);

  await supabase
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", orderId);

  await supabase.from("payment_transactions").insert({
    user_id: order.user_id,
    reference: ref,
    amount,
    currency: "XOF",
    status: "success",
    payment_type: "order_balance",
    related_id: orderId,
    paid_at: new Date().toISOString(),
    metadata: { order_id: orderId, payment_type: "order_balance" },
  });

  return { order_id: orderId };
}

function isValidUUID(val: unknown): boolean {
  if (typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

async function completeCheckout(
  supabase: ReturnType<typeof createClient>,
  checkoutData: any,
  ref: string,
  paidAmount: number
) {
  const data = checkoutData;
  const orderIds: string[] = [];
  const safeGroupId = isValidUUID(data.paymentGroupId) ? data.paymentGroupId : null;

  for (const shopOrder of data.summary.shopOrders) {
    const orderNumber = generateOrderNumber();
    const advanceAmount = Math.round(
      shopOrder.deliveryFee +
      shopOrder.deliveryCommission +
      shopOrder.productCommission +
      (shopOrder.deliveryFee + shopOrder.deliveryCommission + shopOrder.productCommission) *
        (data.summary.transactionFeeRate / 100)
    );
    const balanceAmount = Math.round(
      shopOrder.subtotal + shopOrder.subtotal * (data.summary.transactionFeeRate / 100)
    );

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: data.userId,
        shop_id: shopOrder.shop.id,
        status: "pending",
        delivery_type: "standard",
        delivery_address_id: data.selectedAddressId,
        delivery_fee: shopOrder.deliveryFee,
        delivery_distance_meters: shopOrder.deliveryDistanceMeters,
        subtotal: shopOrder.subtotal,
        tva_amount: 0,
        commission_amount: shopOrder.productCommission + shopOrder.deliveryCommission,
        total_amount: shopOrder.subtotal + shopOrder.deliveryFee,
        advance_amount: advanceAmount,
        balance_amount: balanceAmount,
        advance_paid: paidAmount,
        payment_status: "advance_paid",
        payment_reference: ref,
        payment_method: "orange_money",
        is_multi_vendor: data.isMultiVendor,
        payment_group_id: safeGroupId,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;
    orderIds.push(order.id);

    const itemsToInsert = shopOrder.items.map((item: any) => ({
      order_id: order.id,
      product_id: item.product.id,
      shop_id: item.shopId,
      quantity: item.quantity,
      unit_price: item.proposedPrice || item.unitPrice,
      total_price: (item.proposedPrice || item.unitPrice) * item.quantity,
      commission_rate: shopOrder.productCommissionRate,
      commission_amount: Math.round(
        (item.proposedPrice || item.unitPrice) * item.quantity * (shopOrder.productCommissionRate / 100)
      ),
      selected_color: item.selectedColor?.hex || null,
      selected_size: item.selectedSize || null,
      proposed_price: item.proposedPrice || null,
    }));

    await supabase.from("order_items").insert(itemsToInsert);

    const driverEarnings = Math.round(
      shopOrder.deliveryFee * ((data.platformFees?.delivery_commission_driver || 80) / 100)
    );

    const pickupPoint = {
      shop_id: shopOrder.shop.id,
      name: shopOrder.shop.name,
      shop_name: shopOrder.shop.name,
      address: shopOrder.shop.address || "",
      lat: shopOrder.shop.geolocation_lat || null,
      lng: shopOrder.shop.geolocation_lng || null,
    };

    const deliveryPoint = data.deliveryAddress
      ? {
          address_id: data.selectedAddressId,
          recipient_name: data.deliveryAddress.recipient_name,
          recipient_phone: data.deliveryAddress.recipient_phone,
          address: data.deliveryAddress.address,
          city: data.deliveryAddress.city,
          lat: data.deliveryAddress.geolocation_lat,
          lng: data.deliveryAddress.geolocation_lng,
        }
      : null;

    await supabase.from("delivery_requests").insert({
      order_id: order.id,
      zone_id: shopOrder.shop.delivery_zone_id || null,
      status: "pending",
      pickup_point: pickupPoint,
      delivery_point: deliveryPoint,
      total_distance_meters: shopOrder.deliveryDistanceMeters,
      delivery_fee: shopOrder.deliveryFee,
      driver_earnings: driverEarnings,
    });
  }

  await supabase.from("payment_transactions").insert({
    user_id: data.userId,
    reference: ref,
    amount: paidAmount,
    currency: "XOF",
    status: "success",
    payment_type: "order",
    related_id: orderIds[0],
    paid_at: new Date().toISOString(),
    metadata: { order_ids: orderIds, payment_group_id: safeGroupId },
  });

  for (const shopOrder of data.summary.shopOrders) {
    try {
      const { data: shopData } = await supabase
        .from("shops")
        .select("owner_id")
        .eq("id", shopOrder.shop.id)
        .maybeSingle();
      if (shopData?.owner_id) {
        await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: shopData.owner_id,
            title: "Nouvelle commande",
            body: `Vous avez recu une nouvelle commande de ${shopOrder.items.length} article(s).`,
            data: { order_id: orderIds[0] },
          }),
        });
      }
    } catch {}
  }

  return { order_ids: orderIds };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "initialize") {
      const { amount, reference, metadata, return_url, cancel_url } = body;

      if (!amount || !reference) {
        return jsonResponse({ error: "amount and reference are required" }, 400);
      }

      let verifiedAmount = amount;

      if (metadata?.payment_type === "order_balance" && metadata?.order_id) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: order, error: orderErr } = await supabase
          .from("orders")
          .select("balance_amount, payment_status")
          .eq("id", metadata.order_id)
          .maybeSingle();

        if (orderErr || !order) {
          return jsonResponse({ error: "Order not found" }, 404);
        }

        if (order.payment_status === "paid") {
          return jsonResponse({ error: "Order already paid" }, 400);
        }

        verifiedAmount = order.balance_amount;
      }

      const token = await getOAuthToken();

      const defaultReturnUrl = `${SUPABASE_URL}/functions/v1/orange-money-payment?action=return&reference=${encodeURIComponent(reference)}`;
      const defaultCancelUrl = `${SUPABASE_URL}/functions/v1/orange-money-payment?action=cancelled&reference=${encodeURIComponent(reference)}`;
      const notifUrl = `${SUPABASE_URL}/functions/v1/orange-money-payment?action=notify&reference=${encodeURIComponent(reference)}`;

      const omResult = await initializeWebPayment(
        token,
        reference,
        verifiedAmount,
        return_url || defaultReturnUrl,
        cancel_url || defaultCancelUrl,
        notifUrl
      );

      return jsonResponse({
        payment_url: omResult.payment_url,
        pay_token: omResult.pay_token,
        notif_token: omResult.notif_token,
        order_id: reference,
        reference: reference,
      });
    }

    if (action === "verify") {
      const { order_id, pay_token, amount } = body;

      if (!order_id || !pay_token) {
        return jsonResponse({ error: "order_id and pay_token are required" }, 400);
      }

      const token = await getOAuthToken();
      const result = await checkTransactionStatus(token, order_id, amount || 0, pay_token);

      return jsonResponse({
        status: result.status || "UNKNOWN",
        order_id: result.order_id,
        txnid: result.txnid,
        data: result,
      });
    }

    if (action === "complete_payment") {
      const { reference, pay_token } = body;

      if (!reference) {
        return jsonResponse({ error: "reference is required" }, 400);
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: pending } = await supabase
        .from("pending_payments")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (!pending) {
        return jsonResponse({
          error: "Session de paiement introuvable. Contactez le support avec la reference : " + reference,
        }, 404);
      }

      const storedPayToken = pay_token || pending.checkout_data?.pay_token;
      const storedAmount = Number(pending.amount);

      let isSuccess = false;
      let lastStatus = "UNKNOWN";

      if (storedPayToken) {
        const retryDelays = [0, 2000, 4000];
        const token = await getOAuthToken();

        for (let i = 0; i < retryDelays.length; i++) {
          if (retryDelays[i] > 0) {
            await new Promise((r) => setTimeout(r, retryDelays[i]));
          }
          try {
            const statusResult = await checkTransactionStatus(token, reference, storedAmount, storedPayToken);
            lastStatus = statusResult.status || "UNKNOWN";
            if (lastStatus === "SUCCESS") {
              isSuccess = true;
              break;
            }
            if (lastStatus === "FAILED" || lastStatus === "EXPIRED") {
              break;
            }
          } catch {
            lastStatus = "ERROR";
          }
        }
      } else {
        isSuccess = true;
      }

      if (!isSuccess) {
        return jsonResponse({
          success: false,
          status: lastStatus === "FAILED" || lastStatus === "EXPIRED" ? "failed" : "pending",
          payment_mode: pending.payment_mode,
          booking_id: pending.booking_id,
          order_id: pending.order_id,
        });
      }

      const mode = pending.payment_mode;
      const amount = storedAmount;
      const ref = pending.reference;
      let result: any = {};

      if (mode === "service_booking_advance" && pending.booking_id) {
        result = await completeBookingAdvance(supabase, pending.booking_id, ref, amount);
      } else if (mode === "service_booking_balance" && pending.booking_id) {
        result = await completeBookingBalance(
          supabase, pending.booking_id, ref, amount, pending.completion_type || "full"
        );
      } else if (mode === "balance" && pending.order_id) {
        result = await completeOrderBalance(supabase, pending.order_id, ref, amount);
      } else if (mode === "checkout" && pending.checkout_data) {
        result = await completeCheckout(supabase, pending.checkout_data, ref, amount);
      } else {
        return jsonResponse({ error: "Mode de paiement non reconnu" }, 400);
      }

      await supabase.from("pending_payments").delete().eq("id", pending.id);

      return jsonResponse({
        success: true,
        status: "success",
        payment_mode: mode,
        booking_id: pending.booking_id,
        order_id: pending.order_id,
        ...result,
      });
    }

    return jsonResponse({ error: "Invalid action. Use 'initialize', 'verify', or 'complete_payment'" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
