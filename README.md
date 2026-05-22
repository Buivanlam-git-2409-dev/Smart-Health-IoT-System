# Smart Health IoT System

## 1. Giới thiệu dự án

**Smart Health IoT System** là hệ thống IoT hỗ trợ theo dõi sức khỏe và sàng lọc nguy cơ thiếu máu ở mức prototype. Hệ thống kết hợp dữ liệu cảm biến sinh hiệu từ ESP32 với mô hình AI xử lý ảnh mắt/lưỡi để đưa ra cảnh báo sức khỏe cơ bản.

> Lưu ý: Hệ thống chỉ phục vụ mục đích học tập, mô phỏng và hỗ trợ cảnh báo. Kết quả không thay thế chẩn đoán y tế của bác sĩ.

---

## 2. Mục tiêu chính

Hệ thống hướng tới các chức năng:

- Đo/gửi dữ liệu sinh hiệu gồm nhịp tim, SpO2 và nhiệt độ da.
- Hiển thị dữ liệu realtime trên dashboard web.
- Cảnh báo khi chỉ số vượt ngưỡng bất thường.
- Điều khiển thiết bị từ xa: LED, buzzer, relay.
- Hỗ trợ upload ảnh mắt/lưỡi để AI phân tích nguy cơ thiếu máu.
- Lưu lịch sử dữ liệu vào database.

---

## 3. Kiến trúc tổng thể

```text
ESP32 / Wokwi Simulator
        |
        | MQTT publish sensor data
        v
HiveMQ MQTT Broker
        |
        | MQTT subscribe
        v
FastAPI Backend
        |
        | Save data
        v
SQLite Database
        |
        | REST API
        v
React Dashboard
```

Luồng điều khiển thiết bị:

```text
React Dashboard
        |
        | POST /api/device/control
        v
FastAPI Backend
        |
        | MQTT publish command
        v
HiveMQ MQTT Broker
        |
        | MQTT subscribe
        v
ESP32
        |
        v
LED / Buzzer / Relay
```

Luồng AI dự kiến:

```text
React Upload Image
        |
        v
FastAPI Backend
        |
        v
AI CNN Model
        |
        v
Prediction Result
        |
        v
React Dashboard
```

---

## 4. Thành phần hệ thống

### 4.1. Hardware / IoT

Hiện tại đang mô phỏng bằng Wokwi:

- ESP32 DevKit
- OLED SSD1306 I2C
- LED đỏ
- Buzzer
- Relay module
- Dữ liệu cảm biến giả lập:
  - Heart rate
  - SpO2
  - Skin temperature

Dự kiến phần cứng thật:

- ESP32 DevKit V1
- MAX30102 đo nhịp tim và SpO2
- MLX90614/GY-906 đo nhiệt độ không tiếp xúc
- OLED 0.96 inch I2C
- ESP32-CAM hoặc upload ảnh từ web
- LED, buzzer, relay

### 4.2. MQTT

MQTT được dùng làm giao thức truyền dữ liệu giữa ESP32 và backend.

Topic đang dùng:

```text
smart-health-iot/sensor-data      # ESP32 publish dữ liệu cảm biến
smart-health-iot/device-control   # Backend publish lệnh điều khiển
```

Broker đang dùng:

```text
broker.hivemq.com
Port: 1883
```

### 4.3. Backend

Backend sử dụng:

- FastAPI
- SQLAlchemy
- SQLite
- Pydantic
- paho-mqtt
- Uvicorn

Chức năng backend hiện tại:

- Nhận dữ liệu MQTT từ ESP32.
- Lưu dữ liệu cảm biến vào SQLite.
- Cung cấp API lấy dữ liệu mới nhất.
- Cung cấp API lấy lịch sử dữ liệu.
- Gửi lệnh điều khiển thiết bị qua MQTT.

### 4.4. Frontend

Frontend sử dụng:

- React
- Vite
- TypeScript
- Axios

Chức năng frontend hiện tại:

- Hiển thị dữ liệu cảm biến mới nhất.
- Hiển thị lịch sử dữ liệu.
- Hiển thị trạng thái NORMAL / ALERT.
- Gửi lệnh điều khiển LED, buzzer, relay.
- Chuyển thiết bị về AUTO mode.

### 4.5. AI

AI sẽ được triển khai ở bước sau.

Định hướng:

- Dùng CNN hoặc MobileNetV2.
- Phân tích ảnh mắt/lưỡi.
- Phân loại:
  - Normal
  - Suspected anemia / pale
  - Invalid image
- Backend nhận ảnh từ frontend, gọi model AI và trả kết quả phân tích.

---

## 5. Chức năng đã hoàn thành

- [x] Mô phỏng ESP32 trên Wokwi.
- [x] OLED hiển thị dữ liệu cảm biến.
- [x] LED/buzzer/relay cảnh báo theo dữ liệu bất thường.
- [x] ESP32 publish dữ liệu lên MQTT Broker.
- [x] FastAPI backend subscribe MQTT và nhận dữ liệu.
- [x] Lưu dữ liệu vào SQLite.
- [x] API `/health` hoạt động.
- [x] API `/api/latest-data` hoạt động.
- [x] API `/api/history` hoạt động.
- [x] React Dashboard hiển thị dữ liệu cảm biến.
- [x] Backend publish command điều khiển thiết bị.
- [x] ESP32 nhận command qua MQTT.
- [x] Hỗ trợ AUTO mode và MANUAL mode.
- [x] Điều khiển LED/buzzer/relay từ backend/React.

---

## 6. Chức năng cần làm tiếp

Ưu tiên tiếp theo:

1. Hoàn thiện giao diện Device Control trên React.
2. Tạo API upload ảnh.
3. React upload ảnh mắt/lưỡi.
4. Backend lưu ảnh vào thư mục `uploads/`.
5. Backend trả kết quả AI giả lập trước.
6. Train CNN/MobileNetV2.
7. Tích hợp model AI thật vào backend.
8. Hiển thị kết quả AI trên React.
9. Hoàn thiện báo cáo, sơ đồ và video demo.

---

## 7. API hiện tại

### Health Check

```http
GET /health
```

Response mẫu:

```json
{
  "status": "ok",
  "message": "Smart Health IoT Backend is running"
}
```

### Lấy dữ liệu mới nhất

```http
GET /api/latest-data
```

Response mẫu:

```json
{
  "id": 1,
  "device_id": "esp32_001",
  "heart_rate": 95,
  "spo2": 97,
  "skin_temp": 36.8,
  "warning": false,
  "reason": "",
  "created_at": "2026-05-22T10:00:00"
}
```

### Lấy lịch sử dữ liệu

```http
GET /api/history
```

### Điều khiển thiết bị

```http
POST /api/device/control
```

Body mẫu bật thiết bị:

```json
{
  "led": true,
  "buzzer": true,
  "relay": true
}
```

Body mẫu tắt thiết bị:

```json
{
  "led": false,
  "buzzer": false,
  "relay": false
}
```

Body mẫu chuyển về AUTO mode:

```json
{
  "mode": "AUTO"
}
```

---

## 8. Cách chạy dự án

### 8.1. Chạy backend

```bash
cd apps/backend
pip install fastapi uvicorn paho-mqtt sqlalchemy pydantic python-multipart
uvicorn main:app --reload
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

### 8.2. Chạy frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Frontend mặc định:

```text
http://localhost:5173
```

### 8.3. Chạy ESP32 mô phỏng

Mở project Wokwi và chạy code ESP32.

Điều kiện cần có:

- WiFi SSID: `Wokwi-GUEST`
- MQTT Broker: `broker.hivemq.com`
- Topic sensor: `smart-health-iot/sensor-data`
- Topic control: `smart-health-iot/device-control`

---

## 9. Cấu trúc thư mục đề xuất

```text
smart-health-iot/
├── apps/
│   ├── backend/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── mqtt_client.py
│   │   ├── uploads/
│   │   └── ai_model/
│   └── frontend/
│       └── src/
├── devices/
│   └── esp32-sensor/
├── docs/
│   ├── diagrams/
│   └── report/
└── README.md
```

---

## 10. Rule cảnh báo hiện tại

Hệ thống cảnh báo khi:

```text
Heart rate > 110 BPM
SpO2 < 94%
Skin temperature > 37.8°C
```

Nếu có bất thường:

- `warning = true`
- LED sáng
- Relay bật
- Buzzer kêu ngắn
- Dashboard hiển thị ALERT

---

## 11. AUTO mode và MANUAL mode

### AUTO mode

ESP32 tự động điều khiển thiết bị theo dữ liệu cảm biến.

```text
warning = true  → LED/relay/buzzer bật
warning = false → LED/relay/buzzer tắt
```

### MANUAL mode

ESP32 nhận lệnh điều khiển từ backend/frontend.

```text
led: true/false
buzzer: true/false
relay: true/false
```

Khi gửi lệnh điều khiển từ web, ESP32 tự chuyển sang `MANUAL`.

Muốn quay lại tự động:

```json
{
  "mode": "AUTO"
}
```

---

## 12. Định hướng báo cáo/demo

Kịch bản demo:

1. Chạy Wokwi ESP32.
2. ESP32 gửi dữ liệu cảm biến lên MQTT.
3. Backend nhận và lưu dữ liệu.
4. React hiển thị dữ liệu realtime.
5. Khi dữ liệu bất thường, dashboard hiện ALERT.
6. Điều khiển LED/buzzer/relay từ React.
7. Chuyển AUTO/MANUAL mode.
8. Upload ảnh mắt/lưỡi và hiển thị kết quả AI.
9. Hiển thị lịch sử dữ liệu.

---

## 13. Ghi chú

Dự án hiện đang ở giai đoạn prototype. Các giá trị cảm biến đang được giả lập để kiểm thử luồng IoT. Khi có phần cứng thật, dữ liệu giả lập sẽ được thay bằng dữ liệu từ MAX30102 và MLX90614.
