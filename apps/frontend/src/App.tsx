import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";
import AnemiaUpload from "./components/AnemiaUpload";
import HealthSummary from "./components/HealthSummary";
import TongueUpload from "./components/TongueUpload";

type SensorData = {
  id: number;
  device_id: string;
  heart_rate: number;
  spo2: number;
  skin_temp: number;
  warning: boolean;
  reason: string;
  created_at: string;
};

const API_BASE_URL = "http://127.0.0.1:8000";

type View =
  | "home"
  | "vitals"
  | "eye"
  | "tongue"
  | "summary"
  | "history"
  | "device";

type HistoryTab = "sensors" | "eye" | "tongue" | "alerts";

function App() {
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [sensorLoading, setSensorLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>("home");
  const [historyTab, setHistoryTab] = useState<HistoryTab>("sensors");
  const [selectedRecord, setSelectedRecord] = useState<SensorData | null>(null);
  const [commandStatus, setCommandStatus] = useState("Ready");
  const [deviceState, setDeviceState] = useState({
    led: false,
    buzzer: false,
    relay: false,
  });

  const sendDeviceCommand = async (
    command: Partial<{ led: boolean; buzzer: boolean; relay: boolean }>
  ) => {
    try {
      setCommandStatus("Sending command");
      await axios.post(`${API_BASE_URL}/api/device/control`, command);
      setCommandStatus("Command sent");
      return true;
    } catch (error) {
      console.error("Error sending command:", error);
      setCommandStatus("Command failed");
      return false;
    }
  };
  const fetchLatestData = async () => {
    try {
      const res = await axios.get<SensorData | null>(
        `${API_BASE_URL}/api/latest-data`
      );
      setLatestData(res.data);
    } catch (error) {
      console.error("Error fetching latest data:", error);
    }
  };
  
  const fetchHistory = async () => {
    try {
      const res = await axios.get<SensorData[]>(
        `${API_BASE_URL}/api/history`
      );
      setHistory(res.data);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const fetchAllData = async () => {
    await fetchLatestData();
    await fetchHistory();
    setSensorLoading(false);
  };

  useEffect(() => {
    // schedule initial fetch asynchronously to avoid calling setState synchronously in the effect
    const initial = setTimeout(() => {
      fetchAllData();
    }, 0);

    const interval = setInterval(() => {
      fetchAllData();
    }, 2000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const statusLabel = latestData
    ? latestData.warning
      ? "Warning"
      : "Normal"
    : "No data";

  const statusClass = latestData
    ? latestData.warning
      ? "status-warning"
      : "status-normal"
    : "status-neutral";

  const deviceStatus = latestData ? "ESP32 Connected" : "ESP32 Disconnected";
  const deviceClass = latestData ? "status-normal" : "status-warning";

  const handleToggle = async (
    key: "led" | "buzzer" | "relay",
    value: boolean
  ) => {
    const ok = await sendDeviceCommand({ [key]: value });
    if (ok) {
      setDeviceState((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleAlertOn = async () => {
    const ok = await sendDeviceCommand({ led: true, buzzer: true });
    if (ok) {
      setDeviceState((prev) => ({ ...prev, led: true, buzzer: true }));
    }
  };

  const handleAlertOff = async () => {
    const ok = await sendDeviceCommand({ led: false, buzzer: false });
    if (ok) {
      setDeviceState((prev) => ({ ...prev, led: false, buzzer: false }));
    }
  };

  const handleTestDevice = async () => {
    await sendDeviceCommand({ relay: true });
  };

  const sensorCards = useMemo(
    () => [
      {
        title: "Heart Rate",
        value: latestData?.heart_rate ?? "--",
        unit: "BPM",
      },
      {
        title: "SpO2",
        value: latestData?.spo2 ?? "--",
        unit: "%",
      },
      {
        title: "Skin Temperature",
        value: latestData?.skin_temp ?? "--",
        unit: "C",
      },
    ],
    [latestData]
  );

  const actionCards = [
    {
      id: "vitals" as const,
      title: "Measure Vital Signs",
      description: "Read heart rate, SpO2, and skin temperature.",
      cta: "Start",
      status: statusLabel,
      statusClass,
    },
    {
      id: "eye" as const,
      title: "Analyze Eye Image",
      description: "Upload an eye image for anemia risk.",
      cta: "Analyze",
      status: "AI",
      statusClass: "status-neutral",
    },
    {
      id: "tongue" as const,
      title: "Analyze Tongue Image",
      description: "Upload a tongue image for multi-task analysis.",
      cta: "Analyze",
      status: "AI",
      statusClass: "status-neutral",
    },
    {
      id: "summary" as const,
      title: "View Health Summary",
      description: "Open the latest combined health report.",
      cta: "Open",
      status: statusLabel,
      statusClass,
    },
    {
      id: "history" as const,
      title: "View History",
      description: "Review sensor and AI records over time.",
      cta: "Open",
      status: `${history.length} records`,
      statusClass: "status-neutral",
    },
    {
      id: "device" as const,
      title: "Device Control",
      description: "Manage LED, buzzer, and relay.",
      cta: "Open",
      status: latestData ? "Online" : "Offline",
      statusClass: latestData ? "status-normal" : "status-warning",
    },
  ];

  const handleNavigate = (next: View) => {
    setActiveView(next);
  };

  const renderHome = () => (
    <div className="home">
      <div className="home-header">
        <div>
          <h1 className="page-title">Smart Health IoT</h1>
          <p className="page-subtitle">
            Choose a task to begin monitoring or analysis.
          </p>
        </div>
        <div className="home-status">
          <span className={`status-pill ${deviceClass}`}>{deviceStatus}</span>
          <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>
      <div className="action-grid">
        {actionCards.map((card) => (
          <button
            key={card.id}
            className="action-card"
            onClick={() => handleNavigate(card.id)}
          >
            <div className="action-card-top">
              <span className="action-icon">SH</span>
              <span className={`status-pill ${card.statusClass}`}>
                {card.status}
              </span>
            </div>
            <div className="action-title">{card.title}</div>
            <div className="action-description">{card.description}</div>
            <div className="action-cta">{card.cta}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderVitals = () => (
    <div className="flow">
      <div className="flow-header">
        <div>
          <h1 className="page-title">Measure Vital Signs</h1>
          <p className="page-subtitle">
            Read the latest sensor values and save them to history.
          </p>
        </div>
        <div className="flow-actions">
          <span className={`status-pill ${deviceClass}`}>{deviceStatus}</span>
          <button className="button-primary" onClick={fetchLatestData}>
            Refresh readings
          </button>
        </div>
      </div>
      <div className="metric-grid">
        {sensorCards.map((sensor) => (
          <div key={sensor.title} className="metric-card">
            <div className="metric-title">{sensor.title}</div>
            <div className="metric-value">
              {sensor.value}
              <span className="metric-unit">{sensor.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="result-panel">
        <div className="result-header">
          <span className="result-label">Result</span>
          <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
        </div>
        {sensorLoading ? (
          <div className="empty-state">Loading sensor data...</div>
        ) : latestData ? (
          <div className="result-body">
            <div>
              <div className="result-title">Reasons</div>
              <ul className="reason-list">
                <li>{latestData.reason || "No warning"}</li>
              </ul>
            </div>
            <div>
              <div className="result-title">Timestamp</div>
              <div className="result-text">
                {new Date(latestData.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">No sensor data yet.</div>
        )}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="flow">
      <div className="flow-header">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">
            Review past records and open detail drawers.
          </p>
        </div>
      </div>
      <div className="tabs">
        {(
          [
            { id: "sensors", label: "Sensor History" },
            { id: "eye", label: "Eye Analysis" },
            { id: "tongue", label: "Tongue Analysis" },
            { id: "alerts", label: "Alerts" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            className={`tab ${historyTab === tab.id ? "tab-active" : ""}`}
            onClick={() => setHistoryTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {historyTab === "sensors" ? (
        <div className="history-grid">
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Heart Rate</th>
                  <th>SpO2</th>
                  <th>Temperature</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedRecord(item)}
                  >
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>{item.heart_rate}</td>
                    <td>{item.spo2}%</td>
                    <td>{item.skin_temp} C</td>
                    <td>
                      <span
                        className={`status-pill ${
                          item.warning ? "status-warning" : "status-normal"
                        }`}
                      >
                        {item.warning ? "Warning" : "Normal"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="drawer">
            {selectedRecord ? (
              <div>
                <div className="drawer-title">Record Detail</div>
                <div className="drawer-item">
                  <span>Device</span>
                  <span>{selectedRecord.device_id}</span>
                </div>
                <div className="drawer-item">
                  <span>Heart Rate</span>
                  <span>{selectedRecord.heart_rate} BPM</span>
                </div>
                <div className="drawer-item">
                  <span>SpO2</span>
                  <span>{selectedRecord.spo2}%</span>
                </div>
                <div className="drawer-item">
                  <span>Temperature</span>
                  <span>{selectedRecord.skin_temp} C</span>
                </div>
                <div className="drawer-item">
                  <span>Status</span>
                  <span>
                    {selectedRecord.warning ? "Warning" : "Normal"}
                  </span>
                </div>
                <div className="drawer-item">
                  <span>Reason</span>
                  <span>{selectedRecord.reason || "No warning"}</span>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                Select a record to view details.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          No records available for this tab yet.
        </div>
      )}
    </div>
  );

  const renderDeviceControl = () => (
    <div className="flow">
      <div className="flow-header">
        <div>
          <h1 className="page-title">Device Control</h1>
          <p className="page-subtitle">
            Manage LED, buzzer, and relay controls.
          </p>
        </div>
        <span className={`status-pill ${deviceClass}`}>{deviceStatus}</span>
      </div>
      <div className="control-grid">
        <div className="control-card">
          <div className="control-row">
            <span>LED</span>
            <input
              type="checkbox"
              checked={deviceState.led}
              onChange={(event) =>
                handleToggle("led", event.target.checked)
              }
            />
          </div>
          <div className="control-row">
            <span>Buzzer</span>
            <input
              type="checkbox"
              checked={deviceState.buzzer}
              onChange={(event) =>
                handleToggle("buzzer", event.target.checked)
              }
            />
          </div>
          <div className="control-row">
            <span>Relay</span>
            <input
              type="checkbox"
              checked={deviceState.relay}
              onChange={(event) =>
                handleToggle("relay", event.target.checked)
              }
            />
          </div>
        </div>
        <div className="control-card">
          <div className="button-stack">
            <button className="button-primary" onClick={handleAlertOn}>
              Turn On Alert
            </button>
            <button className="button-secondary" onClick={handleAlertOff}>
              Turn Off Alert
            </button>
            <button className="button-ghost" onClick={handleTestDevice}>
              Test Device
            </button>
          </div>
          <div className="command-status">
            <span>Command status</span>
            <span>{commandStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">SH</div>
          <div>
            <div className="brand-title">Smart Health IoT</div>
            <div className="brand-subtitle">Health monitoring workflows</div>
          </div>
        </div>
        <div className="topbar-actions">
          {activeView !== "home" && (
            <button className="button-ghost" onClick={() => handleNavigate("home")}>
              Back to Home
            </button>
          )}
        </div>
      </header>

      <main className="content">
        {activeView === "home" && renderHome()}
        {activeView === "vitals" && renderVitals()}
        {activeView === "eye" && <AnemiaUpload />}
        {activeView === "tongue" && <TongueUpload />}
        {activeView === "summary" && <HealthSummary />}
        {activeView === "history" && renderHistory()}
        {activeView === "device" && renderDeviceControl()}
      </main>
    </div>
  );
}

export default App;