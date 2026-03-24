import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { directSave } from "../common/utils";
import keyNames from "../keyName";
const { REUSABLE } = keyNames;
const useDirect = () => {
  const dispatch = useDispatch();
  const directDispatch = useCallback(
    (data, key, extra = null) => {
      directSave(dispatch, REUSABLE, data, key, extra);
    },
    [dispatch],
  );
  return directDispatch;
};

export default useDirect;
