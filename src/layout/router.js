import { createHashRouter as createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import LazyLoad from "../common/LazyLoad";
import Layout from "./Layout";
import Route from "./Route";
const Register = LazyLoad(lazy(() => import("../pages/register")));
const ThankYou = LazyLoad(lazy(() => import("../pages/thank-you")));
const Activate = LazyLoad(lazy(() => import("../pages/activate")));
const NotFound = LazyLoad(lazy(() => import("../pages/notfound")));
const Dashboard = LazyLoad(lazy(() => import("../pages/dashboard")));
const Delegates = LazyLoad(lazy(() => import("../pages/delegates")));
const ScanPrint = LazyLoad(lazy(() => import("../pages/scan-print")));
const Settings = LazyLoad(lazy(() => import("../pages/settings")));
const ScanKiosk = LazyLoad(lazy(() => import("../pages/scan-kiosk")));
const RegistrationsConfig = LazyLoad(lazy(() => import("../pages/registrations-config")));
const router = createBrowserRouter([
  {
    path: "/",
    element: <Activate />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/thank-you",
    element: <ThankYou />,
  },
  {
    path: "/scan",
    element: <ScanKiosk />,
  },

  {
    path: "/app",
    element: <Route element={<Layout />} />,
    children: [
      {
        path: "/app",
        element: <Dashboard />,
      },
      {
        path: "delegates",
        element: <Delegates />,
      },
      {
        path: "scan-print",
        element: <ScanPrint />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
      {
        path: "registrations",
        element: <RegistrationsConfig />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
export default router;
