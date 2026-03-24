import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Alert, AlertTitle } from "@mui/material";
import { Toaster, toast } from "sonner";
import { useDirect } from "../../hooks";
import keyNames from "../../keyName";
const CustomToast = () => {
  const storeData = useSelector((state) => state.mainReducer);
  const { toastData } = storeData;
  const directDispatch = useDirect();
  const [position, setPosition] = useState("top-right");
  useEffect(() => {
    if (toastData) {
      toastData?.position && setPosition(toastData.position);
      toast.custom(
        (t) => (
          <Alert severity={toastData.type} onClose={() => toast.dismiss(t)}>
            <AlertTitle>{toastData.title}</AlertTitle>
            {toastData.description}
          </Alert>
        ),

        {
          onAutoClose: (t) => toast.dismiss(t),
          onDismiss: (t) => toast.dismiss(t),
        }
      );
      directDispatch(null, keyNames.toastData);
    }
  }, [toastData, directDispatch]);
  return (
    <Toaster
      position={position}
      closeButton
      visibleToasts={5}
      duration={5000}
    />
  );
};
export default CustomToast;
