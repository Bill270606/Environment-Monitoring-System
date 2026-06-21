from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request
from pydantic import BaseModel
from typing import Optional, List
import math, time, random, json, os
from collections import deque
import anthropic

app = FastAPI(title="EnvMonitor IoT")
history = deque(maxlen=50)
chat_client = anthropic.Anthropic() if os.environ.get("ANTHROPIC_API_KEY") else None
CHAT_MODEL = "claude-haiku-4-5"

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return FileResponse("app/static/404.html", status_code=404)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

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

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

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

def build_chat_system_prompt():
    d = latest_data()
    return (
        "You are the EnvMonitor Assistant, a friendly helper built into a small IoT "
        "environmental monitoring dashboard for a garden/farm. Answer questions about "
        "the current conditions and give short, practical, plain-language advice. "
        "Keep replies to 2-4 sentences unless the user asks for more detail. "
        "If a question has nothing to do with the dashboard or the garden, answer briefly "
        "and steer back to what you can help with.\n\n"
        f"Live sensor readings (source: {d.get('source')}, as of {d.get('timestamp')}):\n"
        f"- Temperature: {d.get('temperature')} °C\n"
        f"- Humidity: {d.get('humidity')} %\n"
        f"- Light: {d.get('lux')} lux\n"
        f"- Soil dryness (raw analog, higher = drier): {d.get('soilAO')}\n"
        f"- Rain sensor (raw analog): {d.get('rainAO')}\n"
        f"- UV sensor voltage: {d.get('uvVoltage')} V\n"
    )

@app.post("/api/chat")
def chat(req: ChatRequest):
    if chat_client is None:
        def missing_key():
            msg = "Chat is not configured yet — the server is missing an ANTHROPIC_API_KEY."
            yield f"data: {json.dumps({'text': msg})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(missing_key(), media_type="text/event-stream")

    system_prompt = build_chat_system_prompt()
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    def generate():
        try:
            with chat_client.messages.stream(
                model=CHAT_MODEL,
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
        except anthropic.APIError as e:
            yield f"data: {json.dumps({'text': f'(Chat error: {e.message})'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
