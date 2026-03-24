import { createStore, applyMiddleware, compose } from "redux";
import { thunk } from "redux-thunk";
import rootReducer from "./reducers";
const inititalState = {};
const middlewares = [thunk];
if (process.env.NODE_ENV === "development") {
  // const { logger } = require("redux-logger");
  // middlewares.push(logger);
}

const store = createStore(
  rootReducer,
  inititalState,
  compose(
    applyMiddleware(...middlewares),
    process.env.NODE_ENV === "development" &&
      window.__REDUX_DEVTOOLS_EXTENSION__
      ? window.__REDUX_DEVTOOLS_EXTENSION__()
      : (f) => f
  )
);

export default store;
