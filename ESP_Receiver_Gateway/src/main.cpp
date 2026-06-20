#include <esp_now.h>
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "Just T4n";
const char* password = "12348765";
String apiKey = "4OUEBMRNTW46AP5J";


String serverName = "http://api.thingspeak.com/update";
String dashboardUrl = "https://iot-env-monitor.onrender.com/data/sensor";

typedef struct struct_message {
  float temperature;
  float humidity;
  float lux;
  int rainDO;
  int rainAO;
  int soilDO;
  int soilAO;
  float uvVoltage;
} struct_message;

struct_message sensorData;
bool isDataReady = false; 

unsigned long previousMillis = 0;
const long postInterval = 15500; 

void OnDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {
  memcpy(&sensorData, incomingData, sizeof(sensorData));
  isDataReady = true;
  
  Serial.println("\n=== SENSOR DATA RECEIVED ===");
  Serial.printf("Temperature: %.2f C | Humidity: %.2f %%\n", sensorData.temperature, sensorData.humidity);
  Serial.printf("Light: %.2f lux\n", sensorData.lux);
  Serial.printf("Rain (AO): %d | Soil (AO): %d\n", sensorData.rainAO, sensorData.soilAO);
  Serial.printf("UV Voltage: %.2f V\n", sensorData.uvVoltage);
  Serial.println("----------------------------");
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

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected Successfully!");

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Initialization Failed!");
    return;
  }
  
  esp_now_register_recv_cb(OnDataRecv);
  Serial.println("Gateway Ready! Listening for ESP-NOW...");
}

void loop() {
  if ((millis() - previousMillis) > postInterval) {
    if (WiFi.status() == WL_CONNECTED && isDataReady) {
      
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
      int httpResponseCode = http.GET();

      if (httpResponseCode == 200) {
        Serial.println("SUCCESS! (Code: 200)");
      } else {
        Serial.printf("FAILED! HTTP Code: %d\n", httpResponseCode);
      }
      
      http.end();

      postToDashboard();

      previousMillis = millis();
      isDataReady = false;
    }
  }
}