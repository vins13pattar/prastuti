CREATE OR REPLACE FUNCTION record_prastuti_usage_and_settle(
  p_session_id uuid,
  p_organization_id uuid,
  p_meters jsonb,
  p_total_credits integer
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_meter record;
  v_meter_total integer;
BEGIN
  IF jsonb_typeof(p_meters) <> 'array' OR jsonb_array_length(p_meters) = 0 THEN
    RAISE EXCEPTION 'At least one usage meter is required';
  END IF;

  SELECT coalesce(sum((item ->> 'billed_credits')::integer), 0)
  INTO v_meter_total
  FROM jsonb_array_elements(p_meters) AS item;

  IF v_meter_total <> p_total_credits THEN
    RAISE EXCEPTION 'Usage meter total does not match settlement total';
  END IF;

  FOR v_meter IN
    SELECT *
    FROM jsonb_to_recordset(p_meters) AS meter_row(
      meter text,
      language text,
      quantity numeric,
      unit_credits numeric,
      billed_credits integer,
      provider_cost_minor integer
    )
  LOOP
    IF v_meter.meter IS NULL
      OR length(v_meter.meter) > 80
      OR v_meter.quantity <= 0
      OR v_meter.unit_credits < 0
      OR v_meter.billed_credits < 0
    THEN
      RAISE EXCEPTION 'Usage meter is invalid';
    END IF;

    INSERT INTO usage_meters (
      session_id,
      meter,
      language,
      quantity,
      unit_credits,
      billed_credits,
      provider_cost_minor
    ) VALUES (
      p_session_id,
      v_meter.meter,
      v_meter.language,
      v_meter.quantity,
      v_meter.unit_credits,
      v_meter.billed_credits,
      v_meter.provider_cost_minor
    );
  END LOOP;

  PERFORM settle_prastuti_credits(
    p_session_id,
    p_organization_id,
    p_total_credits
  );
END;
$$;
