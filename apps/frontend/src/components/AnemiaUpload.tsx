import { useEffect, useState } from "react";
import axios from "axios";

type PredictionResult = {
  id?: number;
  image_name: string;
  image_type: string;
  prediction: string;
  status: string;
  confidence: number;
  message: string;
};

type AnemiaHistoryItem = {
  id: number;
  image_path: string;
  image_type: string;
  prediction: string;
  status: string;
  confidence: number;
  message: string;
  created_at: string;
};

export default function AnemiaUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AnemiaHistoryItem[]>([]);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(
        "http://127.0.0.1:8000/api/anemia/history"
      );

      setHistory(response.data.data);
    } catch (error) {
      console.error("Lỗi lấy lịch sử AI:", error);
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
      alert("Vui lòng chọn ảnh trước.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("image_type", "eye");

    try {
      setLoading(true);

      const response = await axios.post(
        "http://127.0.0.1:8000/api/anemia/predict",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult(response.data.data);

      // Upload xong thì gọi lại lịch sử
      fetchHistory();
    } catch (error) {
      console.error(error);
      alert("Upload hoặc phân tích ảnh thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-box">
      <h2>Analyze Eye Image</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      {previewUrl && (
        <div className="image-preview-wrapper">
          <img src={previewUrl} alt="Eye preview" className="preview-image" />
          <button className="button-ghost button-clear" onClick={handleClearImage}>
            Clear image
          </button>
        </div>
      )}

      <button className="button-primary" onClick={handleUpload} disabled={loading}>
        {loading ? "Analyzing..." : "Analyze Eye Image"}
      </button>

      {result && (
        <div className="result-box">
          <h3>AI Result</h3>

          <p>
            <strong>Prediction:</strong> {result.prediction}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            <span
              className={`status-pill ${
                result.status === "abnormal"
                  ? "status-warning"
                  : "status-normal"
              }`}
            >
              {result.status}
            </span>
          </p>

          <p>
            <strong>Confidence:</strong> {(result.confidence * 100).toFixed(0)}%
          </p>

          <p>
            <strong>Medical note:</strong> {result.message}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <details className="result-box">
          <summary>Recent eye analyses</summary>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Prediction</th>
                <th>Status</th>
                <th>Confidence</th>
                <th>Time</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.image_type}</td>
                  <td>{item.prediction}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        item.status === "abnormal"
                          ? "status-warning"
                          : "status-normal"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>{(item.confidence * 100).toFixed(0)}%</td>
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