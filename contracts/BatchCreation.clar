;; BatchCreation.clar
;; This contract manages the creation and updating of produce batches in the organic tracking system.
;; It links batches to registered farms, generates unique IDs, and ensures immutable tracking via hashes.

;; Constants
(define-constant ERR-UNAUTHORIZED u200)
(define-constant ERR-INVALID-INPUT u201)
(define-constant ERR-FARM-NOT-FOUND u202)
(define-constant ERR-INACTIVE-FARM u203)
(define-constant ERR-PAUSED u204)
(define-constant ERR-ALREADY-REGISTERED u205)
(define-constant ERR-INVALID-HASH u206)
(define-constant ERR-BATCH-NOT-FOUND u207)
(define-constant ERR-INVALID-VERSION u208)
(define-constant MAX_METADATA_LEN u500)
(define-constant MAX_PRODUCE_TYPE_LEN u50)
(define-constant MAX_PRACTICES u10)
(define-constant MAX_VERSION_NOTES_LEN u200)

;; Data Variables
(define-data-var contract-owner principal tx-sender)
(define-data-var paused bool false)
(define-data-var batch-counter uint u0)

;; Data Maps
(define-map batches
  { batch-id: uint }
  {
    farm-id: uint,
    owner: principal,
    produce-type: (string-utf8 50),
    harvest-date: uint,
    batch-hash: (buff 32),  ;; SHA-256 hash of batch data
    metadata: (string-utf8 500),
    organic-practices: (list 10 (string-utf8 100)),
    creation-timestamp: uint,
    last-updated: uint,
    active: bool
  }
)

(define-map batch-versions
  { batch-id: uint, version: uint }
  {
    updated-hash: (buff 32),
    version-notes: (string-utf8 200),
    timestamp: uint
  }
)

(define-map batch-ownership-history
  { batch-id: uint, transfer-id: uint }
  {
    old-owner: principal,
    new-owner: principal,
    timestamp: uint
  }
)

;; Read-Only Functions
(define-read-only (get-batch-details (batch-id uint))
  (map-get? batches { batch-id: batch-id })
)

(define-read-only (get-batch-version (batch-id uint) (version uint))
  (map-get? batch-versions { batch-id: batch-id, version: version })
)

(define-read-only (get-batch-ownership-transfer (batch-id uint) (transfer-id uint))
  (map-get? batch-ownership-history { batch-id: batch-id, transfer-id: transfer-id })
)

(define-read-only (is-batch-active (batch-id uint))
  (match (map-get? batches { batch-id: batch-id })
    batch (get active batch)
    false
  )
)

(define-read-only (get-contract-owner)
  (var-get contract-owner)
)

(define-read-only (is-paused)
  (var-get paused)
)

;; Private Functions
(define-private (validate-string-len (str (string-utf8 1024)) (max-len uint))
  (<= (len str) max-len)
)

(define-private (validate-practices (practices (list 10 (string-utf8 100))))
  (and
    (<= (len practices) MAX_PRACTICES)
    (fold check-practice practices true)
  )
)

(define-private (check-practice (practice (string-utf8 100)) (acc bool))
  (and acc (> (len practice) u0) (validate-string-len practice u100))
)

(define-private (is-farm-valid (farm-id uint))
  (match (contract-call? .FarmRegistry get-farm-details farm-id)
    ok-value (is-eq (get active ok-value) true)
    err-value false
  )
)

;; Public Functions
(define-public (create-batch
  (farm-id uint)
  (produce-type (string-utf8 50))
  (harvest-date uint)
  (batch-hash (buff 32))
  (metadata (string-utf8 500))
  (organic-practices (list 10 (string-utf8 100))))
  (let ((batch-id (+ (var-get batch-counter) u1)))
    (if (var-get paused)
      (err ERR-PAUSED)
      (if (not (is-farm-valid farm-id))
        (err ERR-INACTIVE-FARM)
        (if (or
              (not (validate-string-len produce-type MAX_PRODUCE_TYPE_LEN))
              (not (validate-string-len metadata MAX_METADATA_LEN))
              (not (validate-practices organic-practices))
              (is-eq (len batch-hash) u0))
          (err ERR-INVALID-INPUT)
          (begin
            (map-set batches
              { batch-id: batch-id }
              {
                farm-id: farm-id,
                owner: tx-sender,
                produce-type: produce-type,
                harvest-date: harvest-date,
                batch-hash: batch-hash,
                metadata: metadata,
                organic-practices: organic-practices,
                creation-timestamp: block-height,
                last-updated: block-height,
                active: true
              }
            )
            (var-set batch-counter batch-id)
            (print { event: "batch-created", batch-id: batch-id, farm-id: farm-id, owner: tx-sender })
            (ok batch-id)
          )
        )
      )
    )
  )
)

(define-public (update-batch
  (batch-id uint)
  (new-produce-type (optional (string-utf8 50)))
  (new-harvest-date (optional uint))
  (new-batch-hash (optional (buff 32)))
  (new-metadata (optional (string-utf8 500)))
  (new-practices (optional (list 10 (string-utf8 100))))
  (version-notes (string-utf8 200))
  (version uint))
  (match (map-get? batches { batch-id: batch-id })
    batch
    (if (not (is-eq (get owner batch) tx-sender))
      (err ERR-UNAUTHORIZED)
      (if (not (get active batch))
        (err ERR-INACTIVE-FARM)
        (let (
          (updated-produce-type (default-to (get produce-type batch) new-produce-type))
          (updated-harvest-date (default-to (get harvest-date batch) new-harvest-date))
          (updated-batch-hash (default-to (get batch-hash batch) new-batch-hash))
          (updated-metadata (default-to (get metadata batch) new-metadata))
          (updated-practices (default-to (get organic-practices batch) new-practices))
        )
          (if (or
                (and (is-some new-produce-type) (not (validate-string-len (unwrap-panic new-produce-type) MAX_PRODUCE_TYPE_LEN)))
                (and (is-some new-metadata) (not (validate-string-len (unwrap-panic new-metadata) MAX_METADATA_LEN)))
                (and (is-some new-practices) (not (validate-practices (unwrap-panic new-practices))))
                (and (is-some new-batch-hash) (is-eq (len (unwrap-panic new-batch-hash)) u0))
                (not (validate-string-len version-notes MAX_VERSION_NOTES_LEN)))
            (err ERR-INVALID-INPUT)
            (begin
              (map-set batches { batch-id: batch-id }
                (merge batch {
                  produce-type: updated-produce-type,
                  harvest-date: updated-harvest-date,
                  batch-hash: updated-batch-hash,
                  metadata: updated-metadata,
                  organic-practices: updated-practices,
                  last-updated: block-height
                })
              )
              (map-set batch-versions { batch-id: batch-id, version: version }
                {
                  updated-hash: updated-batch-hash,
                  version-notes: version-notes,
                  timestamp: block-height
                }
              )
              (print { event: "batch-updated", batch-id: batch-id, version: version, owner: tx-sender })
              (ok true)
            )
          )
        )
      )
    )
    (err ERR-BATCH-NOT-FOUND)
  )
)

(define-public (deactivate-batch (batch-id uint))
  (match (map-get? batches { batch-id: batch-id })
    batch
    (if (not (is-eq (get owner batch) tx-sender))
      (err ERR-UNAUTHORIZED)
      (begin
        (map-set batches { batch-id: batch-id } (merge batch { active: false }))
        (print { event: "batch-deactivated", batch-id: batch-id, owner: tx-sender })
        (ok true)
      )
    )
    (err ERR-BATCH-NOT-FOUND)
  )
)

(define-public (transfer-batch-ownership (batch-id uint) (new-owner principal) (transfer-id uint))
  (match (map-get? batches { batch-id: batch-id })
    batch
    (if (not (is-eq (get owner batch) tx-sender))
      (err ERR-UNAUTHORIZED)
      (if (is-eq new-owner tx-sender)
        (err ERR-INVALID-INPUT)
        (begin
          (map-set batches { batch-id: batch-id } (merge batch { owner: new-owner, last-updated: block-height }))
          (map-set batch-ownership-history { batch-id: batch-id, transfer-id: transfer-id }
            {
              old-owner: tx-sender,
              new-owner: new-owner,
              timestamp: block-height
            }
          )
          (print { event: "batch-transferred", batch-id: batch-id, old-owner: tx-sender, new-owner: new-owner })
          (ok true)
        )
      )
    )
    (err ERR-BATCH-NOT-FOUND)
  )
)

(define-public (pause-contract)
  (if (is-eq tx-sender (var-get contract-owner))
    (begin
      (var-set paused true)
      (print { event: "contract-paused", caller: tx-sender })
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)

(define-public (unpause-contract)
  (if (is-eq tx-sender (var-get contract-owner))
    (begin
      (var-set paused false)
      (print { event: "contract-unpaused", caller: tx-sender })
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)