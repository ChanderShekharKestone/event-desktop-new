import { useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const useQrScanner = ({ onScan }) => {
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

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
          onScan(decodedText);

          if (scannerRef.current?.getState() === 2) {
            await scannerRef.current.stop();
            await scannerRef.current.clear();
          }

          scannerRef.current = null;
          setIsScanning(false);
        }
      );
    } catch (err) {
      console.error("QR start error", err);
      setIsScanning(false);
    }
  };

  const resetScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  return { startScanning, resetScanner, isScanning };
};

export default useQrScanner;
