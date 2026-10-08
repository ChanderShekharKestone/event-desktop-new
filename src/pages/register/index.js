import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Box, Button, Divider, Typography } from "@mui/material";
import { basePath } from "../../apiPath";

const DEFAULT_SDK_SRC = "https://cdn.vosmos.live/sdk/sdk_v1.js";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [heading, setHeading] = useState({ heading: "", subheading: "" });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("type") || "attendee";

    const apiBase = basePath;

    let cancelled = false;

    const loadSdk = (sdkSrc, formId, cssUrls = []) => {
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
        // Set per form type on the Registrations page (local only)
        cssUrls,

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

    // Heading / subheading / CSS set on the Registrations page. Optional, so a
    // failure here must not stop the form from loading.
    const headingReq = fetch(
      `${apiBase}/api/form-headings/${encodeURIComponent(type)}`,
    )
      .then((r) => r.json())
      .then((res) => res.data || {})
      .catch(() => ({}));

    // Fetch SDK config, registration form and heading in parallel
    Promise.all([
      fetch(`${apiBase}/api/sdk-configs`).then((r) => r.json()),
      fetch(`${apiBase}/api/registration-fields/by-type/${type}`).then((r) =>
        r.json(),
      ),
      headingReq,
    ])
      .then(([sdkRes, formRes, headingRes]) => {
        if (!cancelled) setHeading(headingRes);
        const config = (sdkRes.data || []).find((s) => s.type === type);
        let sdkSrc = DEFAULT_SDK_SRC;
        if (config?.sdkLocalPath) {
          const basename = config.sdkLocalPath.split(/[\\/]/).pop();
          sdkSrc = `${apiBase}/sdk-files/${basename}`;
        }
        const formId = formRes.data?._id || "";
        loadSdk(sdkSrc, formId, headingRes.cssUrls || []);
      })
      .catch(() =>
        headingReq.then((h) => {
          if (!cancelled) setHeading(h);
          loadSdk(DEFAULT_SDK_SRC, "", h.cssUrls || []);
        }),
      );

    return () => {
      cancelled = true;
      const existing = document.getElementById("w1");
      if (existing) document.body.removeChild(existing);
      delete window["w1"];
      delete window["vosmosForms"];
    };
  }, [location.search]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f5f6f8",
        py: { xs: 2, md: 5 },
        px: 2,
      }}
    >
      <Box
        sx={{
          maxWidth: 1000,
          mx: "auto",
          bgcolor: "#fff",
          borderRadius: 2,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          p: { xs: 2, md: 4 },
        }}
      >
        {(heading.heading || heading.subheading) && (
          <Box sx={{ textAlign: "left" }}>
            {heading.heading && (
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  color: "#1E1033",
                  fontSize: { xs: "1.5rem", md: "2rem" },
                }}
              >
                {heading.heading}
              </Typography>
            )}
            {heading.subheading && (
              <Typography
                variant="body1"
                sx={{ color: "#6B7280", mt: 1, whiteSpace: "pre-line" }}
              >
                {heading.subheading}
              </Typography>
            )}
            <Divider
              sx={{ my: { xs: 2, md: 3 }, borderColor: "rgba(32,23,81,0.12)" }}
            />
          </Box>
        )}
        <div id="vosmosForms" />
      </Box>
    </Box>
  );
};

export default Register;
