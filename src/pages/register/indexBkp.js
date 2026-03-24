import { Button } from "@mui/material";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();
  useEffect(() => {
    window["vosmosForms"] = "w1";
    window["w1"] =
      window["w1"] ||
      function () {
        (window["w1"].q = window["w1"].q || []).push(arguments);
      };
    window.w1("init", {
      targetElementId: "vosmosForms",
      formId: "692fe6f5a38a22e27e81ffec",
      cssUrls: [
        "https://www.greatindiasummit.com/gias-2026/assets/Rcss/form.css",
      ],
      props: {
        successRedirect:
          "https://www.greatindiasummit.com/gias-2026/thank-you/",
      },
    });

    const script = document.createElement("script");
    script.id = "w1";
    script.src = "https://cdn.vosmos.live/sdk/gias26/widget.js";
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
    return () => {
      document.body.removeChild(script);
      delete window["w1"];
      delete window["vosmosForms"];
    };
  }, []);

  return (
    <div>
      <div>banner</div>
      <div id="vosmosForms" />
      <Button onClick={() => navigate("/login")}>Login</Button>
    </div>
  );
};

export default Register;
