import { useEffect, useState } from "react";
import axios from "axios";
import { apiPath, apiLocalIp } from "../apiPath";

/**
 * "https://<this PC's LAN IP>:<port>" — base for links opened on phones / tablets on the
 * same network (lead capture scanners). HTTPS because phone browsers only allow the camera
 * on a secure page. null until known (or when the server can't be reached).
 */
const useLanBase = () => {
  const [base, setBase] = useState(null);
  useEffect(() => {
    let alive = true;
    axios
      .get(apiPath + apiLocalIp)
      .then((res) => {
        const { ip, port, protocol } = res.data || {};
        if (alive && ip) setBase(`${protocol || "https"}://${ip}:${port}`);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return base;
};

export default useLanBase;
