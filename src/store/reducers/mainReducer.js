import keyNames from "../../keyName";
import { initialState } from "./initialState";
const initData = initialState;
function mainReducer(state = initData, action) {
  switch (action.type) {
    case keyNames.REUSABLE:
      const data = state[action.keyName];
      const extra = {
        ...action.keyTarget,
        payload: action.payload,
      };
      switch (action.keyTarget?.type) {
        case "get":
          return {
            ...state,
            [action.keyName]: action.payload,
            [keyNames.extra]: extra,
          };
        case "add":
          const dataAdded = [...data, action.payload];
          return {
            ...state,
            [action.keyName]: dataAdded,
            [keyNames.extra]: extra,
          };
        case "edit":
          const dataEdit = data?.map((obj) => {
            if (obj._id === action.payload._id) {
              return action.payload;
            }
            return obj;
          });
          return {
            ...state,
            [action.keyName]: dataEdit,
            [keyNames.extra]: extra,
          };
        case "delete":
          const dataRemoved = data?.filter(
            (obj) => obj._id !== action.payload._id
          );
          return {
            ...state,
            [action.keyName]: dataRemoved,
            [keyNames.extra]: extra,
          };
        default:
          break;
      }
      return {
        ...state,
        [action.keyName]: action.payload,
      };
    default:
      return state;
  }
}
export default mainReducer;
