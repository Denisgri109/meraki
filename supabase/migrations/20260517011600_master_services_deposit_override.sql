ALTER TABLE public.master_services
  ADD COLUMN deposit_override_type text DEFAULT NULL
    CONSTRAINT master_services_deposit_override_type_check
      CHECK (deposit_override_type IS NULL OR deposit_override_type IN ('percentage', 'fixed')),
  ADD COLUMN deposit_override_value numeric DEFAULT NULL
    CONSTRAINT master_services_deposit_override_value_check
      CHECK (deposit_override_value IS NULL OR deposit_override_value >= 0);
