import { useEffect, useState } from "react";
import AnemiaUpload from "./components/AnemiaUpload";
import axios from "axios";
import "./App.css";

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

function App() {
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);

  const sendDeviceCommand = async (
    command: Partial<{ led: boolean; buzzer: boolean; relay: boolean }>
  ) => {
    try {
      await axios.post(`${API_BASE_URL}/api/device/control`, command);
      alert("Command sent successfully");
    } catch (error) {
      console.error("Error sending command:", error);
      alert("Failed to send command");
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
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();

    const interval = setInterval(() => {
      fetchAllData();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container">
      <h1>Smart Health IoT Dashboard</h1>

      <section className="card">
        <h2>Latest Sensor Data</h2>

        {latestData ? (
          <>
            <p>
              <strong>Device:</strong> {latestData.device_id}
            </p>
            <p>
              <strong>Heart Rate:</strong> {latestData.heart_rate} BPM
            </p>
            <p>
              <strong>SpO2:</strong> {latestData.spo2}%
            </p>
            <p>
              <strong>Skin Temp:</strong> {latestData.skin_temp} °C
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {latestData.warning ? (
                <span className="alert">ALERT</span>
              ) : (
                <span className="normal">NORMAL</span>
              )}
            </p>
            <p>
              <strong>Reason:</strong>{" "}
              {latestData.reason || "No warning"}
            </p>
            <p>
              <strong>Time:</strong>{" "}
              {new Date(latestData.created_at).toLocaleString()}
            </p>
          </>
        ) : (
          <p>No sensor data yet.</p>
        )}
      </section>
      <section className="card">
        <AnemiaUpload />
      </section>
      <section className="card">
        <h2>Device Control</h2>
            
        <div className="button-group">
          <button onClick={() => sendDeviceCommand({ led: true })}>
            LED ON
          </button>
          <button onClick={() => sendDeviceCommand({ led: false })}>
            LED OFF
          </button>

          <button onClick={() => sendDeviceCommand({ buzzer: true })}>
            Buzzer ON
          </button>
          <button onClick={() => sendDeviceCommand({ buzzer: false })}>
            Buzzer OFF
          </button>

          <button onClick={() => sendDeviceCommand({ relay: true })}>
            Relay ON
          </button>
          <button onClick={() => sendDeviceCommand({ relay: false })}>
            Relay OFF
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Sensor History</h2>

        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>HR</th>
              <th>SpO2</th>
              <th>Temp</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleTimeString()}</td>
                <td>{item.heart_rate}</td>
                <td>{item.spo2}%</td>
                <td>{item.skin_temp}°C</td>
                <td>
                  {item.warning ? (
                    <span className="alert">ALERT</span>
                  ) : (
                    <span className="normal">NORMAL</span>
                  )}
                </td>
                <td>{item.reason || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default App;