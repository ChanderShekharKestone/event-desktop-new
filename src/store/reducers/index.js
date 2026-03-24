import { combineReducers } from "redux";
import mainReducer from "./mainReducer";
// import keyNames from "../../keyName";
const appReducer = combineReducers({
  mainReducer,
});
const rootReducer = (state, action) => {
  // if (action.type === keyNames.USER_LOGGED_OUT) {
  //   state = undefined;
  // }
  return appReducer(state, action);
};
export default rootReducer;
