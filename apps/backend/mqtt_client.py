import json
import threading
import paho.mqtt.client as mqtt

from database import SessionLocal
from models import SensorLog

MQTT_CONTROL_TOPIC = "smart-health-iot/device-control"
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_TOPIC = "smart-health-iot/sensor-data"


def save_sensor_data(data: dict):
    db = SessionLocal()

    try:
        reason = data.get("reason", "")

        if isinstance(reason, list):
            reason = ",".join(reason)

        sensor_log = SensorLog(
            device_id=data.get("device_id", "esp32_001"),
            heart_rate=int(data.get("heart_rate", 0)),
            spo2=int(data.get("spo2", 0)),
            skin_temp=float(data.get("skin_temp", 0)),
            warning=bool(data.get("warning", False)),
            reason=reason
        )

        db.add(sensor_log)
        db.commit()
        db.refresh(sensor_log)

        print(
            f"Saved sensor data: "
            f"HR={sensor_log.heart_rate}, "
            f"SpO2={sensor_log.spo2}, "
            f"Temp={sensor_log.skin_temp}, "
            f"Warning={sensor_log.warning}"
        )

    except Exception as e:
        db.rollback()
        print("Error saving sensor data:", e)

    finally:
        db.close()


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("MQTT connected successfully")
        client.subscribe(MQTT_TOPIC)
        print(f"Subscribed topic: {MQTT_TOPIC}")
    else:
        print("MQTT connection failed with code:", rc)


def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode("utf-8")
        data = json.loads(payload)

        print("MQTT received:", data)

        save_sensor_data(data)

    except Exception as e:
        print("Error processing MQTT message:", e)


def start_mqtt_client():
    client = mqtt.Client(client_id="fastapi-backend-001")
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()


def start_mqtt_in_background():
    mqtt_thread = threading.Thread(target=start_mqtt_client)
    mqtt_thread.daemon = True
    mqtt_thread.start()

def publish_device_command(command: dict):
    client = mqtt.Client(client_id="fastapi-command-publisher-001")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)

    client.loop_start()

    payload = json.dumps(command)
    result = client.publish(MQTT_CONTROL_TOPIC, payload, qos=0)

    result.wait_for_publish()

    client.loop_stop()
    client.disconnect()

    print("Published device command:", payload)