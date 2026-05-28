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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
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
      <h2>AI phân tích ảnh mắt</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      {previewUrl && (
        <div>
          <img src={previewUrl} alt="preview" className="preview-image" />
        </div>
      )}

      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Đang phân tích..." : "Upload và phân tích"}
      </button>

      {result && (
        <div className="result-box">
          <h3>Kết quả AI</h3>

          <p>
            <b>Loại ảnh:</b> {result.image_type}
          </p>

          <p>
            <b>Dự đoán:</b> {result.prediction}
          </p>

          <p>
            <b>Trạng thái:</b>{" "}
            <span
              className={
                result.status === "abnormal"
                  ? "status-alert"
                  : "status-normal"
              }
            >
              {result.status}
            </span>
          </p>

          <p>
            <b>Độ tin cậy:</b> {(result.confidence * 100).toFixed(0)}%
          </p>

          <p>
            <b>Khuyến nghị:</b> {result.message}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div className="result-box">
          <h3>Lịch sử phân tích AI</h3>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Loại ảnh</th>
                <th>Dự đoán</th>
                <th>Trạng thái</th>
                <th>Độ tin cậy</th>
                <th>Thời gian</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.image_type}</td>
                  <td>{item.prediction}</td>
                  <td
                    className={
                      item.status === "abnormal"
                        ? "status-alert"
                        : "status-normal"
                    }
                  >
                    {item.status}
                  </td>
                  <td>{(item.confidence * 100).toFixed(0)}%</td>
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