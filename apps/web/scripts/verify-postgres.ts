import postgres from "postgres"

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://prastuti:prastuti-local@127.0.0.1:54329/prastuti"

const sql = postgres(databaseUrl, { max: 4 })
const runId = crypto.randomUUID()
const paymentOrganizationId = crypto.randomUUID()
const reservationOrganizationId = crypto.randomUUID()
const paidOrderId = `order_paid_${runId}`
const mismatchOrderId = `order_mismatch_${runId}`
const paidEventId = `event_paid_${runId}`
const mismatchEventId = `event_mismatch_${runId}`
const paymentId = `payment_${runId}`
const sessionIds = [crypto.randomUUID(), crypto.randomUUID()]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function verifyPaymentReconciliation() {
  await sql`
    insert into organizations (id, external_id, name)
    values (
      ${paymentOrganizationId}::uuid,
      ${`verification:payment:${runId}`},
      'Payment verification'
    )
  `
  await sql`
    insert into payment_orders (
      organization_id,
      provider,
      provider_order_id,
      receipt,
      credits,
      amount_minor,
      currency
    )
    values (
      ${paymentOrganizationId}::uuid,
      'razorpay',
      ${paidOrderId},
      ${`receipt_paid_${runId}`},
      250,
      2500,
      'INR'
    ), (
      ${paymentOrganizationId}::uuid,
      'razorpay',
      ${mismatchOrderId},
      ${`receipt_mismatch_${runId}`},
      100,
      1000,
      'INR'
    )
  `

  const [first] = await sql<{ processed: boolean }[]>`
    select process_razorpay_order_paid(
      ${paidEventId},
      'order.paid',
      'verification-payload-hash',
      ${paidOrderId},
      ${paymentId},
      2500,
      'INR'
    ) as processed
  `
  const [duplicate] = await sql<{ processed: boolean }[]>`
    select process_razorpay_order_paid(
      ${paidEventId},
      'order.paid',
      'verification-payload-hash',
      ${paidOrderId},
      ${paymentId},
      2500,
      'INR'
    ) as processed
  `
  assert(first?.processed === true, "The first paid event was not processed.")
  assert(
    duplicate?.processed === false,
    "A duplicate paid event was processed twice.",
  )

  const [paymentState] = await sql<
    {
      lots: number
      ledger_entries: number
      provider_events: number
      expiry_seconds: number
      status: string
    }[]
  >`
    select
      (select count(*)::int from credit_lots
        where payment_reference = ${`razorpay:${paymentId}`}) as lots,
      (select count(*)::int from credit_ledger_entries
        where provider_event_id = ${paidEventId}) as ledger_entries,
      (select count(*)::int from provider_events
        where provider = 'razorpay' and provider_event_id = ${paidEventId})
        as provider_events,
      (select extract(epoch from (expires_at - loaded_at))::int
        from credit_lots
        where payment_reference = ${`razorpay:${paymentId}`})
        as expiry_seconds,
      (select status from payment_orders
        where provider = 'razorpay' and provider_order_id = ${paidOrderId})
        as status
  `
  assert(paymentState?.lots === 1, "Payment created more than one credit lot.")
  assert(
    paymentState.ledger_entries === 1,
    "Payment created more than one ledger entry.",
  )
  assert(
    paymentState.provider_events === 1,
    "Payment created more than one provider event.",
  )
  assert(
    paymentState.expiry_seconds === 365 * 24 * 60 * 60,
    "Loaded credits do not expire exactly 365 days after loading.",
  )
  assert(paymentState.status === "paid", "The payment order was not marked paid.")

  let mismatchRejected = false
  try {
    await sql`
      select process_razorpay_order_paid(
        ${mismatchEventId},
        'order.paid',
        'verification-mismatch-hash',
        ${mismatchOrderId},
        ${`payment_mismatch_${runId}`},
        999,
        'INR'
      )
    `
  } catch (error) {
    mismatchRejected =
      error instanceof Error &&
      error.message.includes("Payment amount or currency mismatch")
  }
  assert(mismatchRejected, "A mismatched payment amount was accepted.")

  const [mismatchState] = await sql<
    { status: string; provider_events: number }[]
  >`
    select
      (select status from payment_orders
        where provider_order_id = ${mismatchOrderId}) as status,
      (select count(*)::int from provider_events
        where provider_event_id = ${mismatchEventId}) as provider_events
  `
  assert(
    mismatchState?.status === "created" &&
      mismatchState.provider_events === 0,
    "A rejected payment changed durable payment state.",
  )
}

async function verifyCreditConcurrency() {
  await sql`
    insert into organizations (id, external_id, name)
    values (
      ${reservationOrganizationId}::uuid,
      ${`verification:reservation:${runId}`},
      'Reservation verification'
    )
  `
  await sql`
    insert into credit_lots (
      organization_id,
      payment_reference,
      original_credits,
      remaining_credits,
      loaded_at,
      expires_at
    )
    values (
      ${reservationOrganizationId}::uuid,
      ${`verification:${runId}`},
      100,
      100,
      now(),
      now() + interval '365 days'
    )
  `
  for (const [index, sessionId] of sessionIds.entries()) {
    await sql`
      insert into sessions (
        id,
        organization_id,
        organizer_external_id,
        name,
        source_language,
        target_languages,
        expected_minutes,
        translated_audio,
        join_code
      )
      values (
        ${sessionId}::uuid,
        ${reservationOrganizationId}::uuid,
        'verification-user',
        ${`Concurrent reservation ${index + 1}`},
        'Kannada',
        '["English"]'::jsonb,
        30,
        false,
        ${`V${runId.replaceAll("-", "").slice(index, index + 7)}`.toUpperCase()}
      )
    `
  }

  const reservationResults = await Promise.allSettled(
    sessionIds.map((sessionId) =>
      sql`
        select reserve_prastuti_credits(
          ${sessionId}::uuid,
          ${reservationOrganizationId}::uuid,
          80
        )
      `,
    ),
  )
  assert(
    reservationResults.filter(({ status }) => status === "fulfilled").length ===
      1,
    "Concurrent reservations did not serialize to exactly one success.",
  )
  assert(
    reservationResults.filter(({ status }) => status === "rejected").length ===
      1,
    "Insufficient credits did not reject the competing reservation.",
  )

  const [reservationState] = await sql<
    {
      reservations: number
      reserved_credits: number
      remaining_credits: number
      live_sessions: number
    }[]
  >`
    select
      (select count(*)::int
        from credit_reservations cr
        join sessions s on s.id = cr.session_id
        where s.organization_id = ${reservationOrganizationId}::uuid)
        as reservations,
      (select coalesce(sum(cr.reserved_credits), 0)::int
        from credit_reservations cr
        join sessions s on s.id = cr.session_id
        where s.organization_id = ${reservationOrganizationId}::uuid)
        as reserved_credits,
      (select sum(remaining_credits)::int from credit_lots
        where organization_id = ${reservationOrganizationId}::uuid)
        as remaining_credits,
      (select count(*)::int from sessions
        where organization_id = ${reservationOrganizationId}::uuid
          and status = 'live') as live_sessions
  `
  assert(
    reservationState?.reservations === 1 &&
      reservationState.reserved_credits === 80 &&
      reservationState.remaining_credits === 20 &&
      reservationState.live_sessions === 1,
    "Concurrent reservation state is inconsistent.",
  )

  const [liveSession] = await sql<{ id: string }[]>`
    select id from sessions
    where organization_id = ${reservationOrganizationId}::uuid
      and status = 'live'
  `
  assert(liveSession, "The successful reservation session was not found.")
  const verificationMeters = [
    {
      meter: "verification_usage",
      quantity: 1,
      unit_credits: 35,
      billed_credits: 35,
    },
  ]
  await sql`
    select record_prastuti_usage_and_settle(
      ${liveSession.id}::uuid,
      ${reservationOrganizationId}::uuid,
      ${sql.json(verificationMeters)},
      35
    )
  `
  const [settlementState] = await sql<
    {
      remaining_credits: number
      consumed_credits: number
      released_credits: number
      status: string
      usage_meters: number
      metered_credits: number
    }[]
  >`
    select
      (select sum(remaining_credits)::int from credit_lots
        where organization_id = ${reservationOrganizationId}::uuid)
        as remaining_credits,
      (select sum(cr.consumed_credits)::int from credit_reservations cr
        join sessions s on s.id = cr.session_id
        where s.organization_id = ${reservationOrganizationId}::uuid)
        as consumed_credits,
      (select sum(cr.released_credits)::int from credit_reservations cr
        join sessions s on s.id = cr.session_id
        where s.organization_id = ${reservationOrganizationId}::uuid)
        as released_credits,
      (select status from sessions where id = ${liveSession.id}::uuid) as status,
      (select count(*)::int from usage_meters
        where session_id = ${liveSession.id}::uuid) as usage_meters,
      (select sum(billed_credits)::int from usage_meters
        where session_id = ${liveSession.id}::uuid) as metered_credits
  `
  assert(
    settlementState?.remaining_credits === 65 &&
      settlementState.consumed_credits === 35 &&
      settlementState.released_credits === 45 &&
      settlementState.status === "completed" &&
      settlementState.usage_meters === 1 &&
      settlementState.metered_credits === 35,
    "Credit settlement did not consume and release the expected amounts.",
  )
}

async function cleanup() {
  await sql.begin(async (transaction) => {
    await transaction`
      delete from provider_events
      where provider_event_id in (${paidEventId}, ${mismatchEventId})
    `
    await transaction`
      delete from credit_ledger_entries
      where organization_id in (
        ${paymentOrganizationId}::uuid,
        ${reservationOrganizationId}::uuid
      )
    `
    await transaction`
      delete from credit_reservations
      where session_id in (
        select id from sessions
        where organization_id = ${reservationOrganizationId}::uuid
      )
    `
    await transaction`
      delete from sessions
      where organization_id = ${reservationOrganizationId}::uuid
    `
    await transaction`
      delete from credit_lots
      where organization_id in (
        ${paymentOrganizationId}::uuid,
        ${reservationOrganizationId}::uuid
      )
    `
    await transaction`
      delete from payment_orders
      where organization_id = ${paymentOrganizationId}::uuid
    `
    await transaction`
      delete from organizations
      where id in (
        ${paymentOrganizationId}::uuid,
        ${reservationOrganizationId}::uuid
      )
    `
  })
}

async function main() {
  try {
    await verifyPaymentReconciliation()
    await verifyCreditConcurrency()
    console.log(
      "Postgres verification passed: webhook idempotency, payment mismatch rejection, 365-day expiry, concurrent reservation, insufficient-credit rejection, and settlement.",
    )
  } finally {
    await cleanup().catch((error: unknown) => {
      console.error("Postgres verification cleanup failed.", error)
    })
    await sql.end()
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
