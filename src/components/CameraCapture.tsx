import React, { useRef, useState } from 'react';

interface CameraCaptureProps {
  onCapture: (photo: string) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  React.useEffect(() => {
    startCamera();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      onCapture(canvas.toDataURL('image/jpeg'));
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg">
        <video ref={videoRef} autoPlay playsInline className="w-full max-w-sm rounded" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="mt-4 flex gap-2">
          <button onClick={capture} className="bg-blue-600 text-white px-4 py-2 rounded">Capture</button>
          <button onClick={onClose} className="bg-slate-300 px-4 py-2 rounded">Cancel</button>
        </div>
      </div>
    </div>
  );
};
