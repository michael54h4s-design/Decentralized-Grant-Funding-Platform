(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PROPOSAL-ID u101)
(define-constant ERR-INVALID-MILESTONE-ID u102)
(define-constant ERR-INVALID-AMOUNT u103)
(define-constant ERR-INVALID-WEIGHT u104)
(define-constant ERR-INVALID-RECIPIENT u105)
(define-constant ERR-PROPOSAL-NOT-FOUND u106)
(define-constant ERR-MILESTONE-NOT-FOUND u107)
(define-constant ERR-MILESTONE-ALREADY-COMPLETED u108)
(define-constant ERR-INSUFFICIENT-ESCROW u109)
(define-constant ERR-VERIFICATION-FAILED u110)
(define-constant ERR-DISBURSEMENT-ALREADY-MADE u111)
(define-constant ERR-INVALID-BATCH-SIZE u112)
(define-constant ERR-BATCH-EMPTY u113)
(define-constant ERR-INVALID-STATUS u114)
(define-constant ERR-ESCROW-NOT-SET u115)
(define-constant ERR-ORACLE-NOT-SET u116)
(define-constant ERR-TRACKER-NOT-SET u117)
(define-constant ERR-INVALID-TIMESTAMP u118)
(define-constant ERR-MAX-DISBURSEMENTS-EXCEEDED u119)
(define-constant ERR-INVALID-PENALTY u120)
(define-constant ERR-INVALID-INTEREST u121)
(define-constant ERR-INVALID-GRACE-PERIOD u122)

(define-data-var next-disbursement-id uint u0)
(define-data-var max-disbursements uint u5000)
(define-data-var disbursement-fee uint u500)
(define-data-var escrow-contract (optional principal) none)
(define-data-var oracle-contract (optional principal) none)
(define-data-var tracker-contract (optional principal) none)
(define-data-var admin-principal principal tx-sender)

(define-map proposals
  uint
  {
    total-funds: uint,
    disbursed-funds: uint,
    milestone-count: uint,
    recipient: principal,
    status: bool,
    timestamp: uint,
    penalty-rate: uint,
    interest-rate: uint,
    grace-period: uint
  }
)

(define-map milestones
  { proposal-id: uint, milestone-id: uint }
  {
    weight: uint,
    amount: uint,
    completed: bool,
    verified: bool,
    timestamp: uint,
    proof-hash: (buff 32)
  }
)

(define-map disbursements
  uint
  {
    proposal-id: uint,
    milestone-id: uint,
    amount: uint,
    recipient: principal,
    timestamp: uint,
    status: bool
  }
)

(define-read-only (get-proposal (id uint))
  (map-get? proposals id)
)

(define-read-only (get-milestone (proposal-id uint) (milestone-id uint))
  (map-get? milestones { proposal-id: proposal-id, milestone-id: milestone-id })
)

(define-read-only (get-disbursement (id uint))
  (map-get? disbursements id)
)

(define-private (validate-proposal-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-PROPOSAL-ID))
)

(define-private (validate-milestone-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-MILESTONE-ID))
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-AMOUNT))
)

(define-private (validate-weight (weight uint))
  (if (and (> weight u0) (<= weight u100))
      (ok true)
      (err ERR-INVALID-WEIGHT))
)

(define-private (validate-recipient (recipient principal))
  (if (not (is-eq recipient tx-sender))
      (ok true)
      (err ERR-INVALID-RECIPIENT))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-penalty-rate (rate uint))
  (if (<= rate u50)
      (ok true)
      (err ERR-INVALID-PENALTY))
)

(define-private (validate-interest-rate (rate uint))
  (if (<= rate u15)
      (ok true)
      (err ERR-INVALID-INTEREST))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u60)
      (ok true)
      (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-batch-size (size uint))
  (if (and (> size u0) (<= size u10))
      (ok true)
      (err ERR-INVALID-BATCH-SIZE))
)

(define-public (set-escrow-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set escrow-contract (some contract))
    (ok true)
  )
)

(define-public (set-oracle-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set oracle-contract (some contract))
    (ok true)
  )
)

(define-public (set-tracker-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set tracker-contract (some contract))
    (ok true)
  )
)

(define-public (set-max-disbursements (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max u0) (err ERR-INVALID-AMOUNT))
    (var-set max-disbursements new-max)
    (ok true)
  )
)

(define-public (set-disbursement-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= new-fee u0) (err ERR-INVALID-AMOUNT))
    (var-set disbursement-fee new-fee)
    (ok true)
  )
)

(define-public (register-proposal
  (total-funds uint)
  (milestone-count uint)
  (recipient principal)
  (penalty-rate uint)
  (interest-rate uint)
  (grace-period uint)
)
  (let ((next-id (+ (var-get next-disbursement-id) u1)))
    (asserts! (< next-id (var-get max-disbursements)) (err ERR-MAX-DISBURSEMENTS-EXCEEDED))
    (try! (validate-amount total-funds))
    (try! (validate-recipient recipient))
    (try! (validate-penalty-rate penalty-rate))
    (try! (validate-interest-rate interest-rate))
    (try! (validate-grace-period grace-period))
    (map-set proposals next-id
      {
        total-funds: total-funds,
        disbursed-funds: u0,
        milestone-count: milestone-count,
        recipient: recipient,
        status: true,
        timestamp: block-height,
        penalty-rate: penalty-rate,
        interest-rate: interest-rate,
        grace-period: grace-period
      }
    )
    (var-set next-disbursement-id next-id)
    (print { event: "proposal-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (add-milestone
  (proposal-id uint)
  (milestone-id uint)
  (weight uint)
  (amount uint)
  (proof-hash (buff 32))
)
  (let ((proposal (unwrap! (map-get? proposals proposal-id) (err ERR-PROPOSAL-NOT-FOUND))))
    (asserts! (is-eq tx-sender (get recipient proposal)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-proposal-id proposal-id))
    (try! (validate-milestone-id milestone-id))
    (try! (validate-weight weight))
    (try! (validate-amount amount))
    (asserts! (is-none (map-get? milestones { proposal-id: proposal-id, milestone-id: milestone-id })) (err ERR-MILESTONE-ALREADY-COMPLETED))
    (map-set milestones { proposal-id: proposal-id, milestone-id: milestone-id }
      {
        weight: weight,
        amount: amount,
        completed: false,
        verified: false,
        timestamp: block-height,
        proof-hash: proof-hash
      }
    )
    (print { event: "milestone-added", proposal-id: proposal-id, milestone-id: milestone-id })
    (ok true)
  )
)

(define-public (verify-milestone
  (proposal-id uint)
  (milestone-id uint)
)
  (let (
    (proposal (unwrap! (map-get? proposals proposal-id) (err ERR-PROPOSAL-NOT-FOUND)))
    (milestone (unwrap! (map-get? milestones { proposal-id: proposal-id, milestone-id: milestone-id }) (err ERR-MILESTONE-NOT-FOUND)))
    (oracle (unwrap! (var-get oracle-contract) (err ERR-ORACLE-NOT-SET)))
  )
    (asserts! (not (get completed milestone)) (err ERR-MILESTONE-ALREADY-COMPLETED))
    (asserts! (contract-call? oracle verify-proof (get proof-hash milestone)) (err ERR-VERIFICATION-FAILED))
    (map-set milestones { proposal-id: proposal-id, milestone-id: milestone-id }
      (merge milestone { verified: true, timestamp: block-height })
    )
    (print { event: "milestone-verified", proposal-id: proposal-id, milestone-id: milestone-id })
    (ok true)
  )
)

(define-public (disburse-funds
  (proposal-id uint)
  (milestone-id uint)
)
  (let (
    (proposal (unwrap! (map-get? proposals proposal-id) (err ERR-PROPOSAL-NOT-FOUND)))
    (milestone (unwrap! (map-get? milestones { proposal-id: proposal-id, milestone-id: milestone-id }) (err ERR-MILESTONE-NOT-FOUND)))
    (escrow (unwrap! (var-get escrow-contract) (err ERR-ESCROW-NOT-SET)))
    (next-id (var-get next-disbursement-id))
    (amount (get amount milestone))
    (fee (var-get disbursement-fee))
    (net-amount (- amount fee))
  )
    (asserts! (get verified milestone) (err ERR-VERIFICATION-FAILED))
    (asserts! (not (get completed milestone)) (err ERR-MILESTONE-ALREADY-COMPLETED))
    (asserts! (>= (contract-call? escrow get-balance proposal-id) amount) (err ERR-INSUFFICIENT-ESCROW))
    (try! (as-contract (contract-call? escrow transfer net-amount (get recipient proposal) proposal-id)))
    (try! (stx-transfer? fee tx-sender (var-get admin-principal)))
    (map-set milestones { proposal-id: proposal-id, milestone-id: milestone-id }
      (merge milestone { completed: true, timestamp: block-height })
    )
    (map-set proposals proposal-id
      (merge proposal { disbursed-funds: (+ (get disbursed-funds proposal) amount) })
    )
    (map-set disbursements next-id
      {
        proposal-id: proposal-id,
        milestone-id: milestone-id,
        amount: amount,
        recipient: (get recipient proposal),
        timestamp: block-height,
        status: true
      }
    )
    (var-set next-disbursement-id (+ next-id u1))
    (print { event: "funds-disbursed", id: next-id, amount: amount })
    (ok next-id)
  )
)

(define-public (batch-disburse (proposal-id uint) (milestone-ids (list 10 uint)))
  (let ((size (len milestone-ids)))
    (try! (validate-batch-size size))
    (fold batch-disburse-inner milestone-ids (ok u0))
  )
)

(define-private (batch-disburse-inner (milestone-id uint) (acc (response uint uint)))
  (match acc
    count
      (begin
        (try! (disburse-funds tx-sender milestone-id))
        (ok (+ count u1))
      )
    err
      (err err)
  )
)