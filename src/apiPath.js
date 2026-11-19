const isLocalApp =
  window.location.protocol === "file:" || window.location.port === "3000";
const path = isLocalApp ? "http://localhost:4001" : window.location.origin;
export const method = {
  post: "post",
  put: "put",
  get: "get",
  delete: "delete",
};
export const basePath = path;
export const apiPath = basePath + "/api/";
// Registration
export const apiRegisterUser = "registrations";
export const apiGetRegistrations = "registrations";
export const apiRegistrationStats = "registrations/stats";

// Sync
export const apiSyncPull = "sync/pull";
export const apiSyncPush = "sync/push";
export const apiSyncPendingCount = "sync/pending-count";

// Activation
export const apiActivation = "activation";
export const apiMachineId = "activation/machine-id";

// Attendee Types
export const apiAttendeeTypesPull = "attendee-types/pull";
export const apiAttendeeTypes = "attendee-types";

// Badge Templates
export const apiBadgeTemplates = "badge-templates";
export const apiBadgeTemplatesPull = "badge-templates/pull";

// SDK Configs (Registrations)
export const apiSdkConfigs = "sdk-configs";
export const apiRegistrationFields = "registration-fields";
export const apiFormHeadings = "form-headings";
export const apiRegistrationFieldsPull = "registration-fields/pull";

// Scan & Check-in
export const apiUserScan = "scan/checkin";
export const apiUserSearch = "scan/search";
export const apiScanDelegates = "scan/delegates";

// Lead capture — admin (this PC only)
export const apiLeadPoints = "lead-capture/points";
export const apiLeadScreen = (id) => `lead-capture/points/${id}/screen`;
export const apiLeadAgenda = (id) => `lead-capture/points/${id}/agenda`;
export const apiLeadLink = "lead-capture/link";
export const apiLeadExport = "lead-capture/export";
export const apiLeadSync = "lead-capture/sync"; // GET status, POST push + pull
// Lead capture — scanner links on LAN devices (the token is the access key)
export const apiPublicLead = (token) => `public/lead/${token}`;
export const apiPublicLeadEvent = (token) => `public/lead-event/${token}`;

// Backup / Restore / Clean all data (host PC only)
export const apiAppResetSummary = "app-reset/summary";
export const apiAppResetExport = "app-reset/export";
export const apiAppResetRestore = "app-reset/restore";
export const apiAppResetChallenge = "app-reset/challenge";
export const apiAppResetWipe = "app-reset/wipe";

// Giveaway (stored locally, synced with cloud)
export const apiGiveaway = "giveaway";
export const apiGiveawayAttendees = "giveaway/attendees";
export const apiGiveawayAssign = "giveaway/assign";
export const apiGiveawayRevert = "giveaway/revert";
export const apiGiveawayFailed = "giveaway/failed";
export const apiGiveawaySync = "giveaway/sync";

// Network
export const apiLocalIp = "local-ip";
