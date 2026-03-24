import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { useTheme } from "../hooks";
import { CustomToast, Theme } from "../component";
import router from "./router";
const Layout = () => {
  const themes = useTheme();
  return (
    <ThemeProvider theme={themes}>
      <Theme />
      <CustomToast />
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ThemeProvider>
  );
};
export default Layout;
