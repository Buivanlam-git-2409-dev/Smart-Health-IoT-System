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
        <h2>Health Summary</h2>
        <p>{loading ? "Loading summary..." : "No summary data yet."}</p>
      </div>
    );
  }

  const statusClass = (() => {
    const level = summary.level.toLowerCase();
    if (level.includes("high") || level.includes("risk")) {
      return "status-warning";
    }
    if (level.includes("warning")) {
      return "status-warning";
    }
    return "status-normal";
  })();

  return (
    <div className="upload-box">
      <div className="report-header">
        <div>
          <h2>Health Summary</h2>
          <p>Combined sensor and AI report</p>
        </div>
        <span className={`status-pill ${statusClass}`}>{summary.level}</span>
      </div>

      <div className="result-box">
        <div className="report-score">
          <div className="score-value">{summary.risk_score}</div>
          <div className="score-label">Risk score</div>
          <div className="score-status">{summary.status}</div>
        </div>
        <p>
          <strong>Recommendation:</strong> {summary.message}
        </p>
        <button className="button-secondary" onClick={fetchSummary} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh summary"}
        </button>
      </div>

      {summary.reasons.length > 0 && (
        <div className="result-box">
          <h3>Contributing reasons</h3>
          <ul>
            {summary.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="result-box">
        <h3>Latest signals</h3>

        {summary.latest_sensor && (
          <>
            <h4>Sensors</h4>
            <p>Heart rate: {summary.latest_sensor.heart_rate} BPM</p>
            <p>SpO2: {summary.latest_sensor.spo2}%</p>
            <p>Skin temperature: {summary.latest_sensor.skin_temp} C</p>
          </>
        )}

        {summary.latest_anemia && (
          <>
            <h4>Eye AI</h4>
            <p>Prediction: {summary.latest_anemia.prediction}</p>
            <p>Status: {summary.latest_anemia.status}</p>
            <p>
              Confidence: {(summary.latest_anemia.confidence * 100).toFixed(2)}%
            </p>
          </>
        )}

        {summary.latest_tongue && (
          <>
            <h4>Tongue AI</h4>
            <p>Status: {summary.latest_tongue.status}</p>
            <p>
              Abnormal features:{" "}
              {summary.latest_tongue.abnormal_features.length > 0
                ? summary.latest_tongue.abnormal_features.join(", ")
                : "None"}
            </p>
            <p>
              Abnormal targets:{" "}
              {summary.latest_tongue.abnormal_targets.length > 0
                ? summary.latest_tongue.abnormal_targets.join(", ")
                : "None"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}