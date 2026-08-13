export * from "./types";
export { destinations } from "./destinations";
export { originBaseCosts, destinationBaseStayCosts } from "./destinations/originBaseCosts";
export { destinationCoordinates } from "./destinations/coordinates";
export { generatePriceSnapshotsForDestination, generateAllPriceSnapshots, COST_TIER_MULTIPLIER } from "./priceSnapshots";
export { getRecommendations } from "./recommend";
export type { RecommendationInput, ScoredDestination, CostBreakdown } from "./recommend";
export {
  estimateFlightPrice,
  advancePurchaseFactor,
  computeConfidence,
  classifyPrice,
  daysUntil,
  ADVANCE_PURCHASE_FACTORS,
  MAX_TOTAL_MULTIPLIER,
  MIN_TOTAL_MULTIPLIER,
  MIN_REASONABLE_ROUND_TRIP_USD,
} from "./priceEstimation";
export type { PriceEstimate, PriceClassification, AdvancePurchaseBucket } from "./priceEstimation";
export { SCORING_WEIGHTS_V1 } from "./scoringWeights";
export {
  ORIGIN_HUB_COORDS,
  DEFAULT_ORIGIN_HUB,
  nearestOriginHub,
  ORIGIN_LABELS,
  ORIGIN_OPTIONS,
  ORIGIN_IMAGE_QUERY,
} from "./originGeo";
export { getDiscoverPicks, getDiscoverDetail } from "./discover";
export type { DiscoverSlot, DiscoverPick, DiscoverDetail } from "./discover";
export { writeFirestoreDocument, setDocument, getDocument, listDocuments, queryDocuments, countDocuments, deleteDocument } from "./firestore";
export type { FirestoreCredentials } from "./firestore";
export { hashPassword, verifyPassword, signSession, verifySession, timingSafeEqual } from "./adminAuth";
export type { AdminSession } from "./adminAuth";
export { PARTNER_CATEGORIES, PARTNER_LABELS, DEFAULT_PARTNER_CONFIG } from "./partners";
export type { PartnerCategory, PartnerConfigEntry, PartnerConfig } from "./partners";
export { applyLivePriceOverlay, applyLiveHotelPriceOverlay, livePriceDocId } from "./livePrices";
export type { LiveFlightPrice, LiveHotelPrice } from "./livePrices";
export { applyImageOverlay } from "./liveImages";
export type { LiveDestinationImage } from "./liveImages";
export { HOTEL_KEYS } from "./hotelKeys";
export { detectFlightDeals, evaluateFlightDeal, toStoredFlightDeal, fromStoredFlightDeal, MIN_DEAL_DISCOUNT_PERCENT } from "./deals";
export type { FlightDeal, StoredFlightDeal } from "./deals";
export { verifyGoogleIdToken } from "./googleAuth";
export type { GoogleIdentity } from "./googleAuth";
export { signUserSession, verifyUserSession } from "./userAuth";
export type { UserSession } from "./userAuth";
