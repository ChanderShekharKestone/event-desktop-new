import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@mui/material";
import { basePath } from "../../apiPath";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("type") || "attendee";

    const apiBase = basePath;

    let cancelled = false;

    const loadSdk = (sdkSrc, formId) => {
      if (cancelled) return;

      window["vosmosForms"] = "w1";
      window["w1"] =
        window["w1"] ||
        function () {
          (window["w1"].q = window["w1"].q || []).push(arguments);
        };
      window.w1("init", {
        targetElementId: "vosmosForms",
        formId,
        props: {
          // debug: true,
          // Hash route: widget sets window.location.href, so "/thank-you" would leave the app
          successRedirect: `#/thank-you?type=${encodeURIComponent(type)}`,
          getForm: `${apiBase}/api/registration-fields/by-type/${type}`,
          submitForm: `${apiBase}/api/registrations`,
        },
      });

      const script = document.createElement("script");
      script.id = "w1";
      script.src = sdkSrc;
      script.async = true;
      script.onload = () => {
        const queue = window.w1.q || [];
        window.w1.q = [];
        queue.forEach(([method, params]) => {
          if (typeof window.w1[method] === "function") {
            window.w1[method](params);
          }
        });
      };
      document.body.appendChild(script);
    };

    // Fetch SDK config and registration form in parallel
    Promise.all([
      fetch(`${apiBase}/api/sdk-configs`).then((r) => r.json()),
      fetch(`${apiBase}/api/registration-fields/by-type/${type}`).then((r) =>
        r.json(),
      ),
    ])
      .then(([sdkRes, formRes]) => {
        const config = (sdkRes.data || []).find((s) => s.type === type);
        let sdkSrc = `${apiBase}/widget.js`;
        if (config?.sdkLocalPath) {
          const basename = config.sdkLocalPath.split(/[\\/]/).pop();
          sdkSrc = `${apiBase}/sdk-files/${basename}`;
        }
        const formId = formRes.data?._id || "";
        loadSdk(sdkSrc, formId);
      })
      .catch(() => loadSdk(`${apiBase}/widget.js`, ""));

    return () => {
      cancelled = true;
      const existing = document.getElementById("w1");
      if (existing) document.body.removeChild(existing);
      delete window["w1"];
      delete window["vosmosForms"];
    };
  }, [location.search]);

  return <div id="vosmosForms" />;
};

export default Register;
