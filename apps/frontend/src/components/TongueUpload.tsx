import { useEffect, useState } from "react";
import axios from "axios";

type DetectionItem = {
  probability: number;
  threshold: number;
  detected: boolean;
};

type TonguePredictionResult = {
  id?: number;
  image_name: string;
  image_type: string;
  status: string;
  message: string;
  features: Record<string, DetectionItem>;
  targets: Record<string, DetectionItem>;
  abnormal_features: string[];
  abnormal_targets: string[];
};

type TongueHistoryItem = {
  id: number;
  image_path: string;
  image_type: string;
  status: string;
  message: string;
  abnormal_features: string[];
  abnormal_targets: string[];
  features: Record<string, DetectionItem>;
  targets: Record<string, DetectionItem>;
  created_at: string;
};

const API_BASE_URL = "http://127.0.0.1:8000";

export default function TongueUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [result, setResult] = useState<TonguePredictionResult | null>(null);
  const [history, setHistory] = useState<TongueHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tongue/history`);
      setHistory(response.data.data);
    } catch (error) {
      console.error("Lỗi lấy lịch sử phân tích lưỡi:", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const createResizedPreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxWidth = 500;
          const maxHeight = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    setFile(selectedFile);
    createResizedPreview(selectedFile).then((resizedUrl) => {
      setPreviewUrl(resizedUrl);
    });
    setResult(null);
  };

  const handleClearImage = () => {
    setFile(null);
    setPreviewUrl("");
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Vui lòng chọn ảnh lưỡi trước.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("image_type", "tongue");

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/api/tongue/predict`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult(response.data.data);
      fetchHistory();
    } catch (error) {
      console.error(error);
      alert("Upload hoặc phân tích ảnh lưỡi thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const renderDetectionTable = (
    title: string,
    data: Record<string, DetectionItem>
  ) => {
    const entries = Object.entries(data);

    if (entries.length === 0) return null;

    return (
      <details className="result-box">
        <summary>{title}</summary>
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Probability</th>
              <th>Threshold</th>
              <th>Result</th>
            </tr>
          </thead>

          <tbody>
            {entries.map(([name, item]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{(item.probability * 100).toFixed(2)}%</td>
                <td>{(item.threshold * 100).toFixed(2)}%</td>
                <td>
                  <span
                    className={`status-pill ${
                      item.detected ? "status-warning" : "status-normal"
                    }`}
                  >
                    {item.detected ? "Detected" : "Normal"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    );
  };

  return (
    <div className="upload-box">
      <h2>Analyze Tongue Image</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      {previewUrl && (
        <div className="image-preview-wrapper">
          <img src={previewUrl} alt="Tongue preview" className="preview-image" />
          <button className="button-ghost button-clear" onClick={handleClearImage}>
            Clear image
          </button>
        </div>
      )}

      <button className="button-primary" onClick={handleUpload} disabled={loading}>
        {loading ? "Analyzing..." : "Analyze Tongue Image"}
      </button>

      {result && (
        <div className="result-box">
          <h3>Tongue Analysis Summary</h3>

          <p>
            <strong>Status:</strong>{" "}
            <span
              className={`status-pill ${
                result.status === "normal"
                  ? "status-normal"
                  : "status-warning"
              }`}
            >
              {result.status}
            </span>
          </p>

          <p>
            <strong>Message:</strong> {result.message}
          </p>

          <p>
            <strong>Abnormal features:</strong>{" "}
            {result.abnormal_features.length > 0
              ? result.abnormal_features.join(", ")
              : "None"}
          </p>

          <p>
            <strong>Abnormal targets:</strong>{" "}
            {result.abnormal_targets.length > 0
              ? result.abnormal_targets.join(", ")
              : "None"}
          </p>
        </div>
      )}

      {result && renderDetectionTable("Feature probabilities", result.features)}

      {result && renderDetectionTable("Target probabilities", result.targets)}

      {history.length > 0 && (
        <details className="result-box">
          <summary>Recent tongue analyses</summary>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Abnormal features</th>
                <th>Abnormal targets</th>
                <th>Time</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>

                  <td>
                    <span
                      className={`status-pill ${
                        item.status === "normal"
                          ? "status-normal"
                          : "status-warning"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td>
                    {item.abnormal_features.length > 0
                      ? item.abnormal_features.join(", ")
                      : "None"}
                  </td>

                  <td>
                    {item.abnormal_targets.length > 0
                      ? item.abnormal_targets.join(", ")
                      : "None"}
                  </td>

                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}