// ============================================================
//  EnvMonitor — single-board firmware (no ESP-NOW)
//  Reads sensors directly and posts straight to the dashboard
//  + ThingSpeak. For setups with only ONE ESP32 board.
//
//  Required libraries (Tools > Manage Libraries):
//    1. DHT sensor library (by Adafruit)
//    2. Adafruit Unified Sensor
//    3. BH1750 (by Christopher Laws)
// ============================================================
#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>

#define DHTPIN 5
#define DHTTYPE DHT22
#define RAIN_DO 6
#define RAIN_AO 1
#define SOIL_DO 14
#define SOIL_AO 16
#define UV_PIN 17

DHT dht(DHTPIN, DHTTYPE);
BH1750 lightMeter;

const char* ssid = "Just T4n";
const char* password = ""; // leave empty for an open WiFi network (no password)
String apiKey = "4OUEBMRNTW46AP5J";

String serverName = "http://api.thingspeak.com/update";
String dashboardUrl = "https://iot-env-monitor.onrender.com/data/sensor";

typedef struct {
  float temperature;
  float humidity;
  float lux;
  int rainDO;
  int rainAO;
  int soilDO;
  int soilAO;
  float uvVoltage;
} SensorData;

SensorData sensorData;

unsigned long previousDashboardMillis = 0;
unsigned long previousThingSpeakMillis = 0;
const long dashboardInterval = 3000;   // dashboard can refresh fast
const long thingSpeakInterval = 15500; // ThingSpeak free tier allows 1 update / 15s

void readSensors() {
  sensorData.humidity = dht.readHumidity();
  sensorData.temperature = dht.readTemperature();
  sensorData.lux = lightMeter.readLightLevel();
  sensorData.rainDO = digitalRead(RAIN_DO);
  sensorData.rainAO = analogRead(RAIN_AO);
  sensorData.soilDO = digitalRead(SOIL_DO);
  sensorData.soilAO = analogRead(SOIL_AO);

  int uvRaw = analogRead(UV_PIN);
  sensorData.uvVoltage = uvRaw * 3.3 / 4095.0;

  Serial.println("\n=== SENSOR DATA ===");
  Serial.printf("Temperature: %.2f C | Humidity: %.2f %%\n", sensorData.temperature, sensorData.humidity);
  Serial.printf("Light: %.2f lux\n", sensorData.lux);
  Serial.printf("Rain (AO): %d | Soil (AO): %d\n", sensorData.rainAO, sensorData.soilAO);
  Serial.printf("UV Voltage: %.2f V\n", sensorData.uvVoltage);
  Serial.println("-------------------");
}

void postToThingSpeak() {
  HTTPClient http;
  String url = serverName + "?api_key=" + apiKey +
               "&field1=" + String(sensorData.temperature) +
               "&field2=" + String(sensorData.humidity) +
               "&field3=" + String(sensorData.lux) +
               "&field4=" + String(sensorData.rainAO) +
               "&field5=" + String(sensorData.soilAO) +
               "&field6=" + String(sensorData.uvVoltage);
  http.begin(url);
  Serial.print("Pushing data to ThingSpeak... ");
  int code = http.GET();
  Serial.printf(code == 200 ? "SUCCESS! (Code: 200)\n" : "FAILED! HTTP Code: %d\n", code);
  http.end();
}

void postToDashboard() {
  HTTPClient http;
  http.setTimeout(15000); // Render free tier can be asleep; give it time to wake up
  http.begin(dashboardUrl);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"temperature\":" + String(sensorData.temperature) + ",";
  json += "\"humidity\":"    + String(sensorData.humidity) + ",";
  json += "\"lux\":"         + String(sensorData.lux) + ",";
  json += "\"rainDO\":"      + String(sensorData.rainDO) + ",";
  json += "\"rainAO\":"      + String(sensorData.rainAO) + ",";
  json += "\"soilDO\":"      + String(sensorData.soilDO) + ",";
  json += "\"soilAO\":"      + String(sensorData.soilAO) + ",";
  json += "\"uvVoltage\":"   + String(sensorData.uvVoltage);
  json += "}";

  int code = http.POST(json);
  Serial.printf("Dashboard POST -> %d\n", code);
  http.end();
}

void setup() {
  Serial.begin(115200);

  dht.begin();
  pinMode(RAIN_DO, INPUT);
  pinMode(SOIL_DO, INPUT);
  Wire.begin(42, 45);

  if (lightMeter.begin()) {
    Serial.println("BH1750 OK");
  } else {
    Serial.println("BH1750 FAIL");
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected Successfully!");
}

void loop() {
  unsigned long now = millis();

  if (now - previousDashboardMillis > dashboardInterval) {
    previousDashboardMillis = now;
    readSensors();

    if (isnan(sensorData.temperature) || isnan(sensorData.humidity)) {
      Serial.println("DHT read error, skipping this cycle.");
    } else if (WiFi.status() == WL_CONNECTED) {
      postToDashboard();

      if (now - previousThingSpeakMillis > thingSpeakInterval) {
        previousThingSpeakMillis = now;
        postToThingSpeak();
      }
    }
  }
}
