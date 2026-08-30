-- ============================================================================
-- Vouchers: stop burning them on "Apply", and let a shop order carry one
-- (2026-08-30)
--
-- Two defects this fixes:
--
--   1. `redeem_voucher` is a commit, not a check. Both apps call it from the
--      "Apply" button, so the redemption row is written and `current_uses` is
--      incremented before the customer has paid. Abandon the checkout, remove
--      the voucher, or fail the card, and the voucher is gone for good
--      ("You have already redeemed this voucher").
--
--   2. `finalize_shop_order` recomputes the order total as
--      `subtotal + shipping` and rejects a PaymentIntent that does not match
--      to the cent. Mobile charges the *discounted* total, so **every mobile
--      shop order with a voucher applied takes the customer's money and then
--      fails to create the order.**
--
-- After this migration:
--   * `preview_voucher(code, amount_cents)` — read-only. This is what the
--     Apply button calls. It writes nothing.
--   * `finalize_shop_order(..., p_voucher_code)` — redeems the voucher inside
--     the same transaction that creates the order, subtracts the discount from
--     the expected total, and links the redemption to the order.
--   * `redeem_voucher` is unchanged, so the QR / signup flows that legitimately
--     redeem outside an order keep working.
-- ============================================================================


-- ── 1. Read-only voucher check ─────────────────────────────────────────────
-- Same validation ladder and same response shape as redeem_voucher, minus
-- every write. Safe to call as often as the user retypes a code.

create or replace function public.preview_voucher(
  p_code         text,
  p_amount_cents integer default null
) returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_voucher   public.vouchers%rowtype;
  v_discount  integer := 0;
  v_new_total integer := 0;
  v_uid       uuid := auth.uid();
begin
  if v_uid is null then
    return json_build_object('success', false, 'message', 'Not authenticated.');
  end if;

  select * into v_voucher
  from public.vouchers
  where upper(code) = upper(p_code)
    and is_active = true;

  if not found then
    return json_build_object('success', false, 'message', 'Voucher code not found or inactive.');
  end if;

  if v_voucher.expires_at <= now() then
    return json_build_object('success', false, 'message', 'This voucher has expired.');
  end if;

  if v_voucher.current_uses >= v_voucher.max_uses then
    return json_build_object('success', false, 'message', 'This voucher has reached its usage limit.');
  end if;

  if exists (
    select 1 from public.voucher_redemptions
    where user_id = v_uid and voucher_id = v_voucher.id
  ) then
    return json_build_object('success', false, 'message', 'You have already redeemed this voucher.');
  end if;

  if v_voucher.discount_type in ('free_month', 'free_trial') then
    v_discount  := coalesce(p_amount_cents, 0);
    v_new_total := 0;
  elsif v_voucher.discount_type = 'percentage' then
    v_discount  := round(coalesce(p_amount_cents, 0) * v_voucher.discount_value / 100);
    v_new_total := coalesce(p_amount_cents, 0) - v_discount;
  elsif v_voucher.discount_type in ('fixed_amount', 'fixed') then
    v_discount  := least(v_voucher.discount_value, coalesce(p_amount_cents, 0));
    v_new_total := coalesce(p_amount_cents, 0) - v_discount;
  else
    return json_build_object('success', false, 'message', 'Unknown discount type.');
  end if;

  return json_build_object(
    'success', true,
    'message', 'Voucher applied successfully.',
    'voucher_id', v_voucher.id,
    'code', v_voucher.code,
    'discount_type', v_voucher.discount_type,
    'discount_value', v_voucher.discount_value,
    'discount_amount_cents', v_discount,
    'new_total_cents', v_new_total,
    'benefit_expires_at', null
  );
end;
$$;

revoke execute on function public.preview_voucher(text, integer) from public, anon;
grant execute on function public.preview_voucher(text, integer) to authenticated, service_role;

comment on function public.preview_voucher(text, integer) is
  'Read-only voucher validation for the checkout "Apply" button. Writes nothing — the redemption happens inside finalize_shop_order.';


-- ── 2. finalize_shop_order gains an optional voucher ───────────────────────
-- The old 4-argument signature is dropped and replaced by a 5-argument one
-- with a default, so existing callers (the finalize-shop-order edge function
-- before it is redeployed) keep resolving to the same function.

create or replace function public.finalize_shop_order(
  p_user_id      uuid,
  p_items        jsonb,
  p_shipping     jsonb,
  p_payment      jsonb,
  p_voucher_code text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role public.user_role;
  v_order_id uuid;
  v_existing_order_id uuid;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_shipping_cost numeric := coalesce(nullif(p_shipping ->> 'cost', '')::numeric, 0);
  v_amount_cents integer := (p_payment ->> 'amount_cents')::integer;
  v_expected_cents integer;
  v_currency text := lower(coalesce(p_payment ->> 'currency', ''));
  v_payment_intent_id text := nullif(p_payment ->> 'stripe_payment_intent_id', '');
  v_item record;
  v_product record;
  v_price numeric;
  -- voucher
  v_voucher public.vouchers%rowtype;
  v_discount_cents integer := 0;
  v_benefit_exp timestamptz;
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  if v_payment_intent_id is null then
    raise exception 'Missing payment intent id';
  end if;

  if v_amount_cents is null or v_amount_cents <= 0 then
    raise exception 'Invalid payment amount';
  end if;

  if v_currency = '' then
    raise exception 'Missing payment currency';
  end if;

  select role into v_role from profiles where id = p_user_id;
  if not found then
    raise exception 'Profile not found';
  end if;

  select id into v_existing_order_id
  from orders
  where stripe_payment_intent_id = v_payment_intent_id
    and user_id = p_user_id;

  if v_existing_order_id is not null then
    return jsonb_build_object('order_id', v_existing_order_id, 'already_finalized', true);
  end if;

  for v_item in
    select product_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by product_id
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Invalid cart item';
    end if;

    select id, name, retail_price, wholesale_price, stock_count, coalesce(is_active, true) as is_active
    into v_product
    from products
    where id = v_item.product_id
    for update;

    if not found then
      raise exception 'Product not found: %', v_item.product_id;
    end if;

    if not v_product.is_active then
      raise exception 'Product is not active: %', v_product.name;
    end if;

    if coalesce(v_product.stock_count, 0) < v_item.quantity then
      raise exception 'Insufficient stock for %. Only % available.', v_product.name, coalesce(v_product.stock_count, 0);
    end if;

    v_price := case when v_role in ('master', 'owner') then v_product.wholesale_price else v_product.retail_price end;
    v_subtotal := v_subtotal + (v_price * v_item.quantity);
  end loop;

  v_total := v_subtotal + v_shipping_cost;
  v_expected_cents := round(v_total * 100)::integer;

  -- ── Voucher, redeemed atomically with the order ──────────────────────────
  if nullif(p_voucher_code, '') is not null then
    select * into v_voucher
    from public.vouchers
    where upper(code) = upper(p_voucher_code)
      and is_active = true
    for update;

    if not found then
      raise exception 'Voucher code not found or inactive.';
    end if;

    if v_voucher.expires_at <= now() then
      raise exception 'This voucher has expired.';
    end if;

    if v_voucher.current_uses >= v_voucher.max_uses then
      raise exception 'This voucher has reached its usage limit.';
    end if;

    if exists (
      select 1 from public.voucher_redemptions
      where user_id = p_user_id and voucher_id = v_voucher.id
    ) then
      raise exception 'You have already redeemed this voucher.';
    end if;

    if v_voucher.discount_type in ('free_month', 'free_trial') then
      v_discount_cents := v_expected_cents;
      v_benefit_exp := now() + (v_voucher.benefit_expires_days || ' days')::interval;
    elsif v_voucher.discount_type = 'percentage' then
      v_discount_cents := round(v_expected_cents * v_voucher.discount_value / 100.0);
    elsif v_voucher.discount_type in ('fixed_amount', 'fixed') then
      v_discount_cents := least(v_voucher.discount_value, v_expected_cents);
    else
      raise exception 'Unknown discount type.';
    end if;

    v_expected_cents := greatest(0, v_expected_cents - v_discount_cents);
    v_total := v_expected_cents / 100.0;
  end if;

  if v_expected_cents <> v_amount_cents then
    raise exception 'Payment amount mismatch';
  end if;

  insert into orders (
    user_id, total, notes, status, stripe_payment_intent_id,
    shipping_name, shipping_phone, shipping_address, shipping_city,
    shipping_postal_code, shipping_country, shipping_cost, shipping_status
  ) values (
    p_user_id, v_total, nullif(p_shipping ->> 'notes', ''), 'confirmed', v_payment_intent_id,
    nullif(p_shipping ->> 'name', ''), nullif(p_shipping ->> 'phone', ''),
    nullif(p_shipping ->> 'address', ''), nullif(p_shipping ->> 'city', ''),
    nullif(p_shipping ->> 'postal_code', ''), nullif(p_shipping ->> 'country', ''),
    v_shipping_cost, 'pending'
  ) returning id into v_order_id;

  if v_voucher.id is not null then
    insert into public.voucher_redemptions (
      voucher_id, user_id, redeemed_at, benefit_expires_at, status, discount_applied, order_id
    ) values (
      v_voucher.id, p_user_id, now(), v_benefit_exp,
      case when v_benefit_exp is not null then 'active' else 'used' end,
      v_discount_cents, v_order_id
    );

    update public.vouchers
      set current_uses = current_uses + 1
      where id = v_voucher.id;

    if v_voucher.current_uses + 1 >= v_voucher.max_uses then
      update public.vouchers set is_active = false where id = v_voucher.id;
    end if;
  end if;

  for v_item in
    select product_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by product_id
  loop
    select id, name, retail_price, wholesale_price
    into v_product
    from products where id = v_item.product_id for update;

    v_price := case when v_role in ('master', 'owner') then v_product.wholesale_price else v_product.retail_price end;

    insert into order_items (order_id, product_id, product_name, quantity, price)
    values (v_order_id, v_product.id, v_product.name, v_item.quantity, v_price);

    update products
    set stock_count = stock_count - v_item.quantity, updated_at = now()
    where id = v_product.id and stock_count >= v_item.quantity;

    if not found then
      raise exception 'Unable to update stock for %', v_product.name;
    end if;
  end loop;

  insert into payments (
    user_id, order_id, stripe_payment_intent_id, amount, currency, status, payment_type, description
  ) values (
    p_user_id, v_order_id, v_payment_intent_id, v_amount_cents, v_currency,
    'succeeded', 'shop', 'Shop Order #' || upper(substr(v_order_id::text, 1, 8))
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'total', v_total,
    'amount_cents', v_amount_cents,
    'discount_cents', v_discount_cents,
    'currency', v_currency,
    'already_finalized', false
  );
end;
$function$;

revoke execute on function public.finalize_shop_order(uuid, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.finalize_shop_order(uuid, jsonb, jsonb, jsonb, text) to service_role;

-- The old 4-argument overload would still be resolvable and would silently
-- skip the voucher, so remove it once the 5-argument version is in place.
drop function if exists public.finalize_shop_order(uuid, jsonb, jsonb, jsonb);
