create unique index if not exists orders_stripe_payment_intent_id_unique
on public.orders (stripe_payment_intent_id)
where stripe_payment_intent_id is not null;

create unique index if not exists payments_stripe_payment_intent_id_unique
on public.payments (stripe_payment_intent_id)
where stripe_payment_intent_id is not null;

create or replace function public.decrement_stock(p_product_id uuid, p_quantity integer default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock integer;
begin
  select stock_count into current_stock
  from products
  where id = p_product_id
  for update;

  if current_stock >= p_quantity then
    update products
    set stock_count = stock_count - p_quantity,
        updated_at = now()
    where id = p_product_id;
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.finalize_shop_order(
  p_user_id uuid,
  p_items jsonb,
  p_shipping jsonb,
  p_payment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  select role into v_role
  from profiles
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  select id into v_existing_order_id
  from orders
  where stripe_payment_intent_id = v_payment_intent_id
    and user_id = p_user_id;

  if v_existing_order_id is not null then
    return jsonb_build_object(
      'order_id', v_existing_order_id,
      'already_finalized', true
    );
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

  if v_expected_cents <> v_amount_cents then
    raise exception 'Payment amount mismatch';
  end if;

  insert into orders (
    user_id,
    total,
    notes,
    status,
    stripe_payment_intent_id,
    shipping_name,
    shipping_phone,
    shipping_address,
    shipping_city,
    shipping_postal_code,
    shipping_country,
    shipping_cost,
    shipping_status
  ) values (
    p_user_id,
    v_total,
    nullif(p_shipping ->> 'notes', ''),
    'confirmed',
    v_payment_intent_id,
    nullif(p_shipping ->> 'name', ''),
    nullif(p_shipping ->> 'phone', ''),
    nullif(p_shipping ->> 'address', ''),
    nullif(p_shipping ->> 'city', ''),
    nullif(p_shipping ->> 'postal_code', ''),
    nullif(p_shipping ->> 'country', ''),
    v_shipping_cost,
    'pending'
  ) returning id into v_order_id;

  for v_item in
    select product_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by product_id
  loop
    select id, name, retail_price, wholesale_price
    into v_product
    from products
    where id = v_item.product_id
    for update;

    v_price := case when v_role in ('master', 'owner') then v_product.wholesale_price else v_product.retail_price end;

    insert into order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      price
    ) values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_item.quantity,
      v_price
    );

    update products
    set stock_count = stock_count - v_item.quantity,
        updated_at = now()
    where id = v_product.id
      and stock_count >= v_item.quantity;

    if not found then
      raise exception 'Unable to update stock for %', v_product.name;
    end if;
  end loop;

  insert into payments (
    user_id,
    order_id,
    stripe_payment_intent_id,
    amount,
    currency,
    status,
    payment_type,
    description
  ) values (
    p_user_id,
    v_order_id,
    v_payment_intent_id,
    v_amount_cents,
    v_currency,
    'succeeded',
    'shop',
    'Shop Order #' || upper(substr(v_order_id::text, 1, 8))
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'total', v_total,
    'amount_cents', v_amount_cents,
    'currency', v_currency,
    'already_finalized', false
  );
end;
$$;

revoke execute on function public.decrement_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.decrement_stock(uuid, integer) to service_role;

revoke execute on function public.finalize_shop_order(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_shop_order(uuid, jsonb, jsonb, jsonb) to service_role;
