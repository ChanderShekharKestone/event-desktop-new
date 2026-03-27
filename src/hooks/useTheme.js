import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { createTheme } from "@mui/material";
const useTheme = () => {
  const stateData = useSelector((state) => state.mainReducer);
  const { themeMode } = stateData;

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: {
            main: "#2F1A7A",
          },
          secondary: {
            main: "#1E1033",
          },
        },
        shape: {
          borderRadius: 8,
        },
        components: {
          button: {
            // borderRadius: "10px",
          },
        },
        typography: {
          fontSize: 13,
        },
      }),
    [themeMode],
  );
  useEffect(() => {
    const $style = document.createElement("style");
    if (theme) {
      document.head.appendChild($style);
      $style.innerHTML = ` 
      :root {--colorPrimary: ${theme.palette.primary.main};  
      --contrastText:${theme.palette.primary.contrastText};  
      ;}`;
    }
  }, [theme]);

  return theme;
};
export default useTheme;
