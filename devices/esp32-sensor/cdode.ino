from machine import Pin, I2C, ADC
import ssd1306
import time
import network
import ujson
from umqtt.simple import MQTTClient

# ======================
# WIFI CONFIG
# ======================
WIFI_SSID = "Wokwi-GUEST"
WIFI_PASSWORD = ""

# ======================
# MQTT CONFIG
# ======================
MQTT_CLIENT_ID = "smart-health-esp32-001"
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883

# Topic gửi dữ liệu cảm biến lên backend
MQTT_SENSOR_TOPIC = "smart-health-iot/sensor-data"

# Topic nhận lệnh điều khiển từ backend
MQTT_CONTROL_TOPIC = "smart-health-iot/device-control"

# ======================
# I2C OLED
# ======================
i2c = I2C(0, scl=Pin(22), sda=Pin(21))

oled_width = 128
oled_height = 64
oled = ssd1306.SSD1306_I2C(oled_width, oled_height, i2c)

# ======================
# OUTPUT PINS
# ======================
led_red = Pin(25, Pin.OUT)
buzzer = Pin(14, Pin.OUT)
relay = Pin(18, Pin.OUT)

# ======================
# ANALOG INPUT PINS
# ======================
# Potentiometer 1: Heart Rate
pot_hr = ADC(Pin(34))

# Potentiometer 2: SpO2
pot_spo2 = ADC(Pin(35))

# Potentiometer 3: Skin Temperature
pot_temp = ADC(Pin(32))

# ESP32 ADC range 0 - 3.3V
pot_hr.atten(ADC.ATTN_11DB)
pot_spo2.atten(ADC.ATTN_11DB)
pot_temp.atten(ADC.ATTN_11DB)

pot_hr.width(ADC.WIDTH_12BIT)
pot_spo2.width(ADC.WIDTH_12BIT)
pot_temp.width(ADC.WIDTH_12BIT)

# ======================
# CONTROL STATE
# ======================
manual_control = False


# ======================
# MAP FUNCTION
# ======================
def map_value(value, in_min, in_max, out_min, out_max):
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min


# ======================
# READ MANUAL SENSOR VALUES
# ======================
def read_manual_sensor_values():
    raw_hr = pot_hr.read()
    raw_spo2 = pot_spo2.read()
    raw_temp = pot_temp.read()

    # Map giá trị ADC 0-4095 thành giá trị sức khỏe giả lập
    heart_rate = int(map_value(raw_hr, 0, 4095, 60, 130))
    spo2 = int(map_value(raw_spo2, 0, 4095, 85, 100))
    skin_temp = round(map_value(raw_temp, 0, 4095, 35.0, 39.5), 1)

    return heart_rate, spo2, skin_temp


# ======================
# CONNECT WIFI
# ======================
def connect_wifi():
    print("Connecting to WiFi...")

    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)

    while not wlan.isconnected():
        print(".", end="")
        time.sleep(0.5)

    print("\nWiFi connected!")
    print("IP:", wlan.ifconfig()[0])


# ======================
# MQTT CONTROL CALLBACK
# ======================
def on_mqtt_message(topic, msg):
    global manual_control

    try:
        print("Control message received:", topic, msg)

        data = ujson.loads(msg)

        led_state = data.get("led", False)
        buzzer_state = data.get("buzzer", False)
        relay_state = data.get("relay", False)

        source = data.get("source", "web")
        reason = data.get("reason", "manual")

        # Nếu cả 3 thiết bị đều false thì tắt cảnh báo và quay lại AUTO mode
        if not led_state and not buzzer_state and not relay_state:
            manual_control = False
        else:
            manual_control = True

        led_red.value(1 if led_state else 0)
        relay.value(1 if relay_state else 0)

        if buzzer_state:
            buzzer.value(1)
            time.sleep(0.3)
            buzzer.value(0)
        else:
            buzzer.value(0)

        oled.fill(0)

        if manual_control:
            oled.text("REMOTE ALERT", 0, 0)
            oled.text("Source: " + str(source), 0, 16)
            oled.text("Reason:", 0, 28)
            oled.text(str(reason)[:16], 0, 40)
            oled.text("Device: ON", 0, 54)
        else:
            oled.text("ALERT OFF", 0, 0)
            oled.text("Back to AUTO", 0, 20)
            oled.text("mode", 0, 36)

        oled.show()

    except Exception as e:
        print("Error handling control message:", e)


# ======================
# CONNECT MQTT
# ======================
def connect_mqtt():
    print("Connecting to MQTT broker...")

    client = MQTTClient(
        MQTT_CLIENT_ID,
        MQTT_BROKER,
        port=MQTT_PORT
    )

    client.set_callback(on_mqtt_message)
    client.connect()
    client.subscribe(MQTT_CONTROL_TOPIC)

    print("MQTT connected!")
    print("Subscribed control topic:", MQTT_CONTROL_TOPIC)

    return client


# ======================
# WARNING CHECK
# ======================
def check_warning(heart_rate, spo2, skin_temp):
    warning = False
    reason = []

    if heart_rate > 110:
        warning = True
        reason.append("HR")

    if spo2 < 94:
        warning = True
        reason.append("SpO2")

    if skin_temp > 37.8:
        warning = True
        reason.append("Temp")

    return warning, reason


# ======================
# DISPLAY OLED
# ======================
def display_data(heart_rate, spo2, skin_temp, warning, reason):
    oled.fill(0)

    oled.text("Smart Health", 0, 0)
    oled.text("HR: " + str(heart_rate), 0, 16)
    oled.text("SpO2: " + str(spo2) + "%", 0, 28)
    oled.text("Temp: " + str(skin_temp), 0, 40)

    if warning:
        oled.text("ALERT:" + ",".join(reason), 0, 54)
    else:
        oled.text("STATUS: NORMAL", 0, 54)

    oled.show()


# ======================
# CONTROL OUTPUT BY SENSOR
# ======================
def control_output_by_sensor(warning):
    if warning:
        led_red.value(1)
        relay.value(1)

        buzzer.value(1)
        time.sleep(0.2)
        buzzer.value(0)
    else:
        led_red.value(0)
        buzzer.value(0)
        relay.value(0)


# ======================
# PUBLISH SENSOR DATA
# ======================
def publish_sensor_data(client, heart_rate, spo2, skin_temp, warning, reason):
    data = {
        "device_id": "esp32_001",
        "heart_rate": heart_rate,
        "spo2": spo2,
        "skin_temp": skin_temp,
        "warning": warning,
        "reason": reason
    }

    message = ujson.dumps(data)

    client.publish(MQTT_SENSOR_TOPIC, message)

    print("Published:", message)


# ======================
# MAIN PROGRAM
# ======================
connect_wifi()
mqtt_client = connect_mqtt()

while True:
    try:
        # Nhận lệnh từ backend/web/AI
        mqtt_client.check_msg()

        # Đọc dữ liệu từ 3 biến trở thay vì random
        heart_rate, spo2, skin_temp = read_manual_sensor_values()

        warning, reason = check_warning(heart_rate, spo2, skin_temp)

        # Nếu không bị điều khiển từ web/AI thì sensor tự điều khiển thiết bị
        if not manual_control:
            display_data(heart_rate, spo2, skin_temp, warning, reason)
            control_output_by_sensor(warning)

        # Gửi dữ liệu sensor lên backend qua MQTT
        publish_sensor_data(
            mqtt_client,
            heart_rate,
            spo2,
            skin_temp,
            warning,
            reason
        )

        time.sleep(3)

    except Exception as e:
        print("Main loop error:", e)

        try:
            mqtt_client = connect_mqtt()
        except Exception as reconnect_error:
            print("MQTT reconnect failed:", reconnect_error)
            time.sleep(3)