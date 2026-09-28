import axios from "axios";
import keyNames from "../../keyName";
import { apiPath } from "../../apiPath";

const { apiErrors, isLoading, apiMsg, toastData, forceLogOut } = keyNames;
axios.defaults.withCredentials = true;
export const getByPath =
  (path, data, name, method, keyName, toast, keyTarget = null) =>
  (dispatch) => {
    let payload = null;
    dispatch({ type: name, payload, keyName: apiErrors });
    payload = keyName;
    dispatch({ type: name, payload, keyName: isLoading });
    axios[method](apiPath + path, data && data)
      .then((res) => {
        payload = res.data.data;
        dispatch({ type: name, payload, keyName, keyTarget });
        if (toast?.success) {
          payload = { ...toast.success };
          if (payload.description === apiMsg)
            payload.description = res.data.message;
          dispatch({ type: name, payload, keyName: toastData });
        }
      })
      .catch((error) => {
        payload = error.response?.data;
        if (payload?.data?.logOut) {
          payload = payload.data.logOut;
          dispatch({ type: name, payload, keyName: forceLogOut });
        }
        dispatch({ type: name, payload, keyName: apiErrors });
        if (toast?.error) {
          const message =
            payload?.message ||
            "Cannot reach server. Check the network connection.";
          payload = { ...toast.error };
          if (payload.description === apiMsg) payload.description = message;
          dispatch({ type: name, payload, keyName: toastData });
        }
      })
      .finally(() => {
        setTimeout(() => {
          payload = "noLoading";
          dispatch({ type: name, payload, keyName: isLoading });
        }, 500);
      });
  };
