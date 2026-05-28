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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
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
      <div className="result-box">
        <h4>{title}</h4>

        <table>
          <thead>
            <tr>
              <th>Nhãn</th>
              <th>Xác suất</th>
              <th>Ngưỡng</th>
              <th>Kết quả</th>
            </tr>
          </thead>

          <tbody>
            {entries.map(([name, item]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{(item.probability * 100).toFixed(2)}%</td>
                <td>{(item.threshold * 100).toFixed(2)}%</td>
                <td
                  className={
                    item.detected ? "status-alert" : "status-normal"
                  }
                >
                  {item.detected ? "Detected" : "Normal"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="upload-box">
      <h2>AI phân tích ảnh lưỡi</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      {previewUrl && (
        <div>
          <img src={previewUrl} alt="tongue preview" className="preview-image" />
        </div>
      )}

      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Đang phân tích..." : "Upload và phân tích lưỡi"}
      </button>

      {result && (
        <div className="result-box">
          <h3>Kết quả phân tích lưỡi</h3>

          <p>
            <b>Loại ảnh:</b> {result.image_type}
          </p>

          <p>
            <b>Trạng thái:</b>{" "}
            <span
              className={
                result.status === "normal"
                  ? "status-normal"
                  : "status-alert"
              }
            >
              {result.status}
            </span>
          </p>

          <p>
            <b>Nhận xét:</b> {result.message}
          </p>

          <p>
            <b>Đặc điểm bất thường:</b>{" "}
            {result.abnormal_features.length > 0
              ? result.abnormal_features.join(", ")
              : "Không có"}
          </p>

          <p>
            <b>Target bất thường:</b>{" "}
            {result.abnormal_targets.length > 0
              ? result.abnormal_targets.join(", ")
              : "Không có"}
          </p>
        </div>
      )}

      {result && renderDetectionTable("Đặc điểm lưỡi", result.features)}

      {result && renderDetectionTable("Nhóm target", result.targets)}

      {history.length > 0 && (
        <div className="result-box">
          <h3>Lịch sử phân tích ảnh lưỡi</h3>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Trạng thái</th>
                <th>Đặc điểm bất thường</th>
                <th>Target bất thường</th>
                <th>Thời gian</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>

                  <td
                    className={
                      item.status === "normal"
                        ? "status-normal"
                        : "status-alert"
                    }
                  >
                    {item.status}
                  </td>

                  <td>
                    {item.abnormal_features.length > 0
                      ? item.abnormal_features.join(", ")
                      : "Không có"}
                  </td>

                  <td>
                    {item.abnormal_targets.length > 0
                      ? item.abnormal_targets.join(", ")
                      : "Không có"}
                  </td>

                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}