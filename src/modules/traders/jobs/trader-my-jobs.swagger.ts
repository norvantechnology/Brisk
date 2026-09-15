/**
 * @swagger
 * tags:
 *   - name: Trader / My Jobs
 *     description: |
 *       Trader My Jobs lifecycle (Figma multi site-visit / active job flow).
 *       Auth trader Bearer.
 *
 *       Screen map:
 *       1. My Jobs tabs → GET /traders/jobs/mine?tab=ACTIVE|COMPLETED|OTHER
 *       2. Job Details → GET /traders/jobs/mine/{id}
 *       3. Arrive → POST .../arrive
 *       4. Finish → POST .../finish
 *       5. Materials → GET/POST .../materials, DELETE .../materials/{materialId}
 *       6. Proof photos → POST .../proof-photos (upload purpose job_proof first)
 *       7. Messages → GET/POST .../messages
 *       8. Quotes → POST /traders/jobs/mine/{id}/quotes
 *          (also from Discover: POST /traders/jobs/discover/{id}/quotes)
 *       9. Accept job → POST .../accept
 *       10. Payment summary → GET .../payment-summary
 *       11. Request payment → POST .../request-payment
 *       12. Complete site visit → POST .../site-visit/complete
 *       13. Request site visit fee → POST .../site-visit/request-payment
 *       14. Incoming map sheet → GET /traders/jobs/incoming/latest
 *       15. Incoming accept/decline → POST /traders/jobs/incoming/{id}/accept|decline
 *
 *       Drive CTA from data.primaryAction on detail:
 *       ARRIVE | FINISH | COMPLETE_SITE_VISIT | REQUEST_SITE_VISIT_PAYMENT |
 *       REQUEST_PAYMENT | ACCEPT_JOB | SUBMIT_QUOTE | ADD_MATERIALS | AWAITING_PAYOUT | VIEW_DETAILS
 *
 * components:
 *   schemas:
 *     TraderMyJobCard:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         jobRef: { type: string, nullable: true }
 *         title: { type: string }
 *         statusBadge:
 *           type: string
 *           enum: [Active, Completed, Awaiting Payout]
 *         siteVisitedBadge: { type: boolean }
 *         customerName: { type: string }
 *         primaryActionLabel: { type: string, example: View Details }
 *     TraderMyJobsList:
 *       type: object
 *       properties:
 *         tab: { type: string, enum: [ACTIVE, COMPLETED, OTHER] }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/TraderMyJobCard' }
 *         page: { type: integer }
 *         limit: { type: integer }
 *         total: { type: integer }
 *         hasMore: { type: boolean }
 *     TraderMyJobDetail:
 *       type: object
 *       description: Payload for Active Job / Site Visited / Completed detail screens
 *       properties:
 *         id: { type: string, format: uuid }
 *         title: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         jobRef: { type: string, nullable: true }
 *         description: { type: string }
 *         status: { type: string }
 *         statusLabel: { type: string, example: ACTIVE JOB }
 *         photos:
 *           type: array
 *           items: { type: string, format: uri }
 *         proofPhotos:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               photoUrl: { type: string, format: uri }
 *         quotePrice: { type: number, nullable: true }
 *         quotePriceLabel: { type: string, nullable: true, example: "€450" }
 *         canArrive: { type: boolean }
 *         canFinish: { type: boolean }
 *         canAddMaterials: { type: boolean }
 *         canSubmitQuote: { type: boolean }
 *         canAcceptJob: { type: boolean }
 *         canRequestPayment: { type: boolean }
 *         canCompleteSiteVisit: { type: boolean }
 *         canRequestSiteVisitPayment: { type: boolean }
 *         primaryAction: { type: string }
 *         primaryActionLabel: { type: string }
 *         estimatedEarnings: { type: number, nullable: true }
 *         durationLabel: { type: string, nullable: true }
 *         arrival:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *               nullable: true
 *               enum: [ARRIVING_SOON, ARRIVED]
 *             etaLabel: { type: string, nullable: true }
 *         materials:
 *           type: object
 *           properties:
 *             count: { type: integer }
 *             total: { type: number }
 *             totalLabel: { type: string }
 *         siteVisit:
 *           type: object
 *           properties:
 *             status: { type: string }
 *             displayLabel: { type: string, nullable: true }
 *             fee: { type: number, nullable: true }
 *             feeLabel: { type: string, nullable: true }
 *             deductibleNote: { type: string, nullable: true }
 *     TraderMaterialsList:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               name: { type: string }
 *               detail: { type: string, nullable: true }
 *               price: { type: number }
 *               priceLabel: { type: string }
 *               photoUrl: { type: string, nullable: true }
 *         count: { type: integer }
 *         total: { type: number }
 *         totalLabel: { type: string }
 *         statusLabel: { type: string, example: Trader is adding parts }
 *         lastUpdatedLabel: { type: string, nullable: true }
 *         live: { type: boolean }
 *         runningTotalLabel: { type: string }
 *     TraderPaymentSummary:
 *       type: object
 *       properties:
 *         serviceCharge: { type: number }
 *         materialsTotal: { type: number }
 *         siteVisitFee: { type: number }
 *         platformFee: { type: number, example: 10 }
 *         vatRate: { type: number, example: 0.2 }
 *         vatAmount: { type: number }
 *         totalAmount: { type: number }
 *         jobRef: { type: string, nullable: true }
 *         completedDate: { type: string, format: date-time }
 *         address: { type: string }
 *         viewMaterialsHref: { type: string }
 *     TraderIncomingJob:
 *       type: object
 *       nullable: true
 *       properties:
 *         id: { type: string, format: uuid }
 *         title: { type: string }
 *         distanceKm: { type: number }
 *         customerName: { type: string }
 *         isSiteVisit: { type: boolean }
 *         priceLabel: { type: string, nullable: true }
 */
export {};
