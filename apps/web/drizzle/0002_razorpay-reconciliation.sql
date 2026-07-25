CREATE OR REPLACE FUNCTION process_razorpay_order_paid(
  p_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_order_id text,
  p_payment_id text,
  p_amount_minor integer,
  p_currency text
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_order payment_orders%ROWTYPE;
  v_lot_id uuid;
BEGIN
  INSERT INTO provider_events (
    provider,
    provider_event_id,
    event_type,
    payload_hash,
    status
  ) VALUES (
    'razorpay',
    p_event_id,
    p_event_type,
    p_payload_hash,
    'received'
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT * INTO v_order
  FROM payment_orders
  WHERE provider = 'razorpay' AND provider_order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;
  IF v_order.amount_minor <> p_amount_minor OR v_order.currency <> p_currency THEN
    RAISE EXCEPTION 'Payment amount or currency mismatch';
  END IF;
  IF v_order.status = 'paid' THEN
    UPDATE provider_events
    SET status = 'processed', processed_at = now()
    WHERE provider = 'razorpay' AND provider_event_id = p_event_id;
    RETURN true;
  END IF;

  UPDATE payment_orders
  SET status = 'paid',
      provider_payment_id = p_payment_id,
      paid_at = now()
  WHERE id = v_order.id;

  INSERT INTO credit_lots (
    organization_id,
    payment_reference,
    original_credits,
    remaining_credits,
    loaded_at,
    expires_at
  ) VALUES (
    v_order.organization_id,
    'razorpay:' || p_payment_id,
    v_order.credits,
    v_order.credits,
    now(),
    now() + interval '365 days'
  )
  RETURNING id INTO v_lot_id;

  INSERT INTO credit_ledger_entries (
    organization_id,
    lot_id,
    provider_event_id,
    type,
    credits,
    reason,
    metadata
  ) VALUES (
    v_order.organization_id,
    v_lot_id,
    p_event_id,
    'load',
    v_order.credits,
    'Razorpay payment confirmed',
    jsonb_build_object(
      'provider_order_id', p_order_id,
      'provider_payment_id', p_payment_id
    )
  );

  UPDATE provider_events
  SET status = 'processed', processed_at = now()
  WHERE provider = 'razorpay' AND provider_event_id = p_event_id;

  RETURN true;
END;
$$;
