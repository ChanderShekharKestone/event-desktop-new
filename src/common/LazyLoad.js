import { Suspense } from "react";
import CustomLoader from "../component/loader/Loader";
const LazyLoad = (Component) => (props) =>
  (
    <Suspense fallback={<CustomLoader />}>
      <Component {...props} />
    </Suspense>
  );
export default LazyLoad;
