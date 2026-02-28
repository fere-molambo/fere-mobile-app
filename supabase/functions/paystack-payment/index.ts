import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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

async function verifyPaystackReference(reference: string) {
  const resp = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
  );
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

async function completeCheckout(
  supabase: ReturnType<typeof createClient>,
  checkoutData: any,
  ref: string,
  paidAmount: number
) {
  const data = checkoutData;
  const orderIds: string[] = [];

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
        payment_method: "paystack",
        is_multi_vendor: data.isMultiVendor,
        payment_group_id: data.paymentGroupId,
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
    metadata: { order_ids: orderIds, payment_group_id: data.paymentGroupId },
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
      const { email, amount, reference, currency, metadata, callback_url } = body;

      if (!email || !amount || !reference) {
        return jsonResponse({ error: "email, amount, and reference are required" }, 400);
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

      const amountInKobo = Math.round(verifiedAmount * 100);

      const resp = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInKobo,
          reference,
          currency: currency || "XOF",
          metadata: metadata || {},
          ...(callback_url ? { callback_url } : {}),
        }),
      });

      const result = await resp.json();

      if (!result.status) {
        return jsonResponse({ error: result.message || "Payment initialization failed" }, 400);
      }

      return jsonResponse({
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code,
        reference: result.data.reference,
      });
    }

    if (action === "verify") {
      const { reference } = body;

      if (!reference) {
        return jsonResponse({ error: "reference is required" }, 400);
      }

      const result = await verifyPaystackReference(reference);

      return jsonResponse({
        status: result.data?.status || "unknown",
        data: result.data || null,
        message: result.message,
      });
    }

    if (action === "complete_payment") {
      const { reference } = body;

      if (!reference) {
        return jsonResponse({ error: "reference is required" }, 400);
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: pending } = await supabase
        .from("pending_payments")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      const verifyResult = await verifyPaystackReference(reference);
      const paystackStatus = verifyResult.data?.status || "unknown";
      const isSuccess = paystackStatus === "success";

      if (pending) {
        if (!isSuccess) {
          return jsonResponse({
            success: false,
            status: paystackStatus,
            payment_mode: pending.payment_mode,
            booking_id: pending.booking_id,
            order_id: pending.order_id,
          });
        }

        const mode = pending.payment_mode;
        const amount = Number(pending.amount);
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

      if (!isSuccess) {
        return jsonResponse({
          success: false,
          status: paystackStatus,
          error: "Paiement non abouti",
        });
      }

      const meta = verifyResult.data?.metadata || {};
      const paymentType = meta.payment_type || "";
      const paystackAmount = Math.round((verifyResult.data?.amount || 0) / 100);
      let fallbackResult: any = {};

      if (paymentType === "service_booking_advance" && meta.booking_id) {
        fallbackResult = await completeBookingAdvance(supabase, meta.booking_id, reference, paystackAmount);
        return jsonResponse({
          success: true,
          status: "success",
          payment_mode: "service_booking_advance",
          booking_id: meta.booking_id,
          ...fallbackResult,
        });
      }

      if (paymentType === "service_booking_balance" && meta.booking_id) {
        fallbackResult = await completeBookingBalance(
          supabase, meta.booking_id, reference, paystackAmount, meta.completion_type || "full"
        );
        return jsonResponse({
          success: true,
          status: "success",
          payment_mode: "service_booking_balance",
          booking_id: meta.booking_id,
          ...fallbackResult,
        });
      }

      if (paymentType === "order_balance" && meta.order_id) {
        fallbackResult = await completeOrderBalance(supabase, meta.order_id, reference, paystackAmount);
        return jsonResponse({
          success: true,
          status: "success",
          payment_mode: "balance",
          order_id: meta.order_id,
          ...fallbackResult,
        });
      }

      return jsonResponse({
        error: "Paiement confirme par Paystack mais session locale introuvable. Contactez le support avec la reference : " + reference,
      }, 404);
    }

    return jsonResponse({ error: "Invalid action. Use 'initialize', 'verify', or 'complete_payment'" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
