import { useEffect, useState } from "react";
import axios from "axios";

type HealthSummaryData = {
  status: string;
  level: string;
  risk_score: number;
  message: string;
  reasons: string[];
  latest_sensor: {
    heart_rate: number;
    spo2: number;
    skin_temp: number;
    warning: boolean;
    reason: string;
    created_at: string;
  } | null;
  latest_anemia: {
    id: number;
    prediction: string;
    status: string;
    confidence: number;
    message: string;
    created_at: string;
  } | null;
  latest_tongue: {
    id: number;
    status: string;
    message: string;
    abnormal_features: string[];
    abnormal_targets: string[];
    created_at: string;
  } | null;
};

const API_BASE_URL = "http://127.0.0.1:8000";

export default function HealthSummary() {
  const [summary, setSummary] = useState<HealthSummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/health/summary`);
      setSummary(response.data.data);
    } catch (error) {
      console.error("Lỗi lấy health summary:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // avoid calling setState synchronously inside effect - run fetch in next tick
    const timeout = setTimeout(() => {
      fetchSummary();
    }, 0);

    const interval = setInterval(() => {
      fetchSummary();
    }, 5000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  if (!summary) {
    return (
      <div className="upload-box">
        <h2>Tổng hợp sức khỏe</h2>
        <p>{loading ? "Đang tải..." : "Chưa có dữ liệu tổng hợp."}</p>
      </div>
    );
  }

  const statusClass =
    summary.level === "normal" ? "status-normal" : "status-alert";

  return (
    <div className="upload-box">
      <h2>Tổng hợp sức khỏe</h2>

      <div className="result-box">
        <p>
          <b>Trạng thái tổng hợp:</b>{" "}
          <span className={statusClass}>{summary.status}</span>
        </p>

        <p>
          <b>Mức cảnh báo:</b>{" "}
          <span className={statusClass}>{summary.level}</span>
        </p>

        <p>
          <b>Risk score:</b> {summary.risk_score}
        </p>

        <p>
          <b>Nhận xét:</b> {summary.message}
        </p>

        <button onClick={fetchSummary} disabled={loading}>
          {loading ? "Đang cập nhật..." : "Cập nhật tổng hợp"}
        </button>
      </div>

      {summary.reasons.length > 0 && (
        <div className="result-box">
          <h3>Lý do cảnh báo</h3>
          <ul>
            {summary.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="result-box">
        <h3>Dữ liệu mới nhất</h3>

        {summary.latest_sensor && (
          <>
            <h4>Cảm biến</h4>
            <p>Nhịp tim: {summary.latest_sensor.heart_rate} BPM</p>
            <p>SpO2: {summary.latest_sensor.spo2}%</p>
            <p>Nhiệt độ: {summary.latest_sensor.skin_temp}°C</p>
          </>
        )}

        {summary.latest_anemia && (
          <>
            <h4>AI ảnh mắt</h4>
            <p>Dự đoán: {summary.latest_anemia.prediction}</p>
            <p>Trạng thái: {summary.latest_anemia.status}</p>
            <p>
              Độ tin cậy:{" "}
              {(summary.latest_anemia.confidence * 100).toFixed(2)}%
            </p>
          </>
        )}

        {summary.latest_tongue && (
          <>
            <h4>AI ảnh lưỡi</h4>
            <p>Trạng thái: {summary.latest_tongue.status}</p>
            <p>
              Đặc điểm bất thường:{" "}
              {summary.latest_tongue.abnormal_features.length > 0
                ? summary.latest_tongue.abnormal_features.join(", ")
                : "Không có"}
            </p>
            <p>
              Target bất thường:{" "}
              {summary.latest_tongue.abnormal_targets.length > 0
                ? summary.latest_tongue.abnormal_targets.join(", ")
                : "Không có"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}