import { Provider } from "react-redux";
import store from "./store";
import Layout from "./layout";
const App = () => {
  return (
    <Provider store={store}>
      <Layout />
    </Provider>
  );
};

export default App;
