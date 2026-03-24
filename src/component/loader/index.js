import CircularProgress from "@mui/material/CircularProgress";
import Backdrop from "@mui/material/Backdrop";
const Loader = ({ layer, layerStyle }) => {
  return layer ? (
    <Backdrop open={true} sx={layerStyle}>
      <CircularProgress />
    </Backdrop>
  ) : (
    <CircularProgress />
  );
};
export default Loader;
