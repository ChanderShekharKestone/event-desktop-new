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
const Giveaway = LazyLoad(lazy(() => import("../pages/giveaway")));
const LeadCapture = LazyLoad(lazy(() => import("../pages/lead-capture")));
const LeadReport = LazyLoad(lazy(() => import("../pages/lead-capture/Report")));
// Lead capture scanners — opened on phones / tablets on the LAN, no login (token = access)
const LeadScanner = LazyLoad(lazy(() => import("../pages/lead-scanner")));
const EventScanner = LazyLoad(lazy(() => import("../pages/lead-scanner/EventScanner")));
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
    path: "/lead/:token",
    element: <LeadScanner />,
  },
  {
    path: "/lead-scan/:token",
    element: <EventScanner />,
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
      {
        path: "giveaway",
        element: <Giveaway />,
      },
      {
        path: "lead-capture",
        element: <LeadCapture />,
      },
      {
        path: "lead-capture/:id",
        element: <LeadReport />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
export default router;
