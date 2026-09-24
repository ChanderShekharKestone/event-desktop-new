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
export const apiRegistrationFieldsPull = "registration-fields/pull";

// Scan & Check-in
export const apiUserScan = "scan/checkin";
export const apiUserSearch = "scan/search";

// Backup / Restore / Clean all data (host PC only)
export const apiAppResetSummary = "app-reset/summary";
export const apiAppResetExport = "app-reset/export";
export const apiAppResetRestore = "app-reset/restore";
export const apiAppResetChallenge = "app-reset/challenge";
export const apiAppResetWipe = "app-reset/wipe";

// Network
export const apiLocalIp = "local-ip";
