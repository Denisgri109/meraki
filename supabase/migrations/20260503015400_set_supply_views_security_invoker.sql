alter view public.owner_low_stock_supplies set (security_invoker = true);
alter view public.supply_usage_summary set (security_invoker = true);
alter view public.low_stock_supplies set (security_invoker = true);
