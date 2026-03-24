import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import useApi from "../hooks/useApi";
import keyNames from "../keyName";
import { apiActivation, method } from "../apiPath";

const isLocalhost = () => {
  const host = window.location.hostname;
  const proto = window.location.protocol;
  return host === "localhost" || host === "127.0.0.1" || proto === "file:";
};

const Route = ({ element }) => {
  const hitApi = useApi();
  const { activationData, isLoading } = useSelector((s) => s.mainReducer);
  const [loading, setLoading] = useState(true);
  const wasLoading = useRef(false);
  const lan = !isLocalhost();

  useEffect(() => {
    if (lan) return;
    hitApi(apiActivation, null, method.get, keyNames.activationData, null);
  }, [hitApi, lan]);

  useEffect(() => {
    if (lan) return;
    if (isLoading !== "noLoading") {
      wasLoading.current = true;
    }
    if (wasLoading.current && isLoading === "noLoading") {
      setLoading(false);
    }
  }, [isLoading, lan]);

  // Block LAN users from accessing admin
  if (lan) return <Navigate to="/register" replace />;

  if (loading) return null;
  if (activationData?.activated === true) return element;
  const reason = activationData?.reason === "expired" ? "expired" : null;
  return <Navigate to="/" replace state={{ reason }} />;
};

export default Route;
