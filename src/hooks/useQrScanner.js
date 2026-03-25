import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const stopCameraTracks = () => {
  navigator.mediaDevices?.enumerateDevices().then(() => {
    document.querySelectorAll("video").forEach((video) => {
      video.srcObject?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    });
  });
};

const useQrScanner = ({ onScan }) => {
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

  const stopScanner = async () => {
    try {
      if (scannerRef.current?.getState() === 2) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch (_) {}
    scannerRef.current = null;
    stopCameraTracks();
    setIsScanning(false);
  };

  const startScanning = async () => {
    if (isScanning) return;

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("qr-reader");
    }

    setIsScanning(true);

    try {
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250, disableFlip: false },
        async (decodedText) => {
          await stopScanner();
          onScan(decodedText);
        }
      );
    } catch (err) {
      console.error("QR start error", err);
      await stopScanner();
    }
  };

  // Stop camera when component unmounts
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return { startScanning, resetScanner: stopScanner, isScanning };
};

export default useQrScanner;
