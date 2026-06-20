from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import math, time, random
from collections import deque

app = FastAPI(title="EnvMonitor IoT")
history = deque(maxlen=50)

# Real device data: set by POST /data/sensor (ESP32 Receiver Gateway), read by GET /data/latest.
last_device_data = None
last_device_time = 0
DEVICE_FRESH_WINDOW = 30  # seconds — how long a device reading is considered "live"

def fake_data():
    t = time.time()
    d = {
        "temperature": round(29 + 7  * math.sin(t/30)      + random.uniform(-0.3,0.3), 1),
        "humidity":    round(max(0,min(100, 68+18*math.sin(t/45+1)+random.uniform(-0.5,0.5))), 1),
        "lux":         round(max(0, 400+350*math.sin(t/35+2) + random.uniform(-10,10)), 1),
        "rainDO":      0,
        "rainAO":      round(max(0, 3800+200*math.sin(t/60+3) + random.uniform(-50,50))),
        "soilDO":      0,
        "soilAO":      round(max(0, 2200+400*math.sin(t/50+4)+random.uniform(-50,50))),
        "uvVoltage":   round(max(0, 1.2+0.8*math.sin(t/40+5)  + random.uniform(-0.05,0.05)), 2),
        "timestamp":   time.strftime("%H:%M:%S"),
        "date":        time.strftime("%d/%m/%Y"),
        "source":      "simulated",
    }
    history.append(d)
    return d

def latest_data():
    if last_device_data is not None and (time.time() - last_device_time) < DEVICE_FRESH_WINDOW:
        return last_device_data
    return fake_data()

class LoginData(BaseModel):
    email: str
    password: str

class SensorData(BaseModel):
    temperature: Optional[float] = None
    humidity:    Optional[float] = None
    lux:         Optional[float] = None
    rainDO:      Optional[int] = None
    rainAO:      Optional[int] = None
    soilDO:      Optional[int] = None
    soilAO:      Optional[int] = None
    uvVoltage:   Optional[float] = None

app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/")
def landing():   return FileResponse("app/static/landing.html")

@app.get("/login")
def login_page(): return FileResponse("app/static/login.html")

@app.get("/dashboard")
def dashboard():  return FileResponse("app/static/dashboard.html")

@app.get("/sensors")
def sensors_page(): return FileResponse("app/static/sensors.html")

@app.get("/alerts")
def alerts_page(): return FileResponse("app/static/alerts.html")

@app.get("/charts")
def charts_page(): return FileResponse("app/static/charts.html")

@app.get("/settings")
def settings_page(): return FileResponse("app/static/settings.html")

@app.post("/auth/login")
def do_login(data: LoginData):
    name = data.email.split("@")[0].replace(".", " ").title() if "@" in data.email else "Demo User"
    return {"success": True, "user": {"name": name, "email": data.email, "role": "Admin"}}

@app.get("/data/latest")
def get_latest(): return latest_data()

@app.get("/data/history")
def get_history(): return list(history)

@app.post("/data/sensor")
def receive(data: SensorData):
    global last_device_data, last_device_time
    entry = {
        **data.model_dump(exclude_none=True),
        "timestamp": time.strftime("%H:%M:%S"),
        "date": time.strftime("%d/%m/%Y"),
        "source": "device",
    }
    last_device_data = entry
    last_device_time = time.time()
    history.append(entry)
    return {"status": "ok"}
