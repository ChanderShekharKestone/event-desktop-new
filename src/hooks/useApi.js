import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { fetchData } from "../common/utils";
import keyNames from "../keyName";
const { REUSABLE } = keyNames;
const useApiNew = () => {
  const dispatch = useDispatch();
  // prettier-ignore
  const useApiNew = useCallback(
    (path, data, method, key, toast, extra = null) => {
      fetchData( dispatch, path, data, REUSABLE, method, key, toast, extra );
    },
    [dispatch]
  );

  return useApiNew;
};
export default useApiNew;
