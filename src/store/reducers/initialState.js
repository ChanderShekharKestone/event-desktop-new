import keyNames from "../../keyName";
export const initialState = {
  [keyNames.themeMode]: "light",
  [keyNames.apiErrors]: null,
  [keyNames.extra]: null,
  [keyNames.isLoading]: "noLoading",
  [keyNames.toastData]: null,

  [keyNames.registerData]: null,
  [keyNames.userData]: null,
  [keyNames.activationData]: null,
  [keyNames.machineId]: null,
  [keyNames.syncPullData]: null,
  [keyNames.syncPushData]: null,
  [keyNames.userScanData]: null,
  [keyNames.attendeeTypesData]: null,
  [keyNames.badgeTemplatesData]: null,
  [keyNames.syncPendingCount]: null,
  [keyNames.dashboardStats]: null,
};
