#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <WiFi.h>
#include <time.h>
#include <Firebase_ESP_Client.h>
#include <AceButton.h>

#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

using namespace ace_button;

// --- 1. WIFI CREDENTIALS ---
const char* ssid = "MIS";
const char* pass = "1234567xxXX";

// --- 2. FIREBASE CREDENTIALS ---
#define API_KEY "AIzaSyAxxdd57OaqWavGOGAjRubDHROG5IXweFk"
#define DATABASE_URL "https://iot-water-level-app-default-rtdb.asia-southeast1.firebasedatabase.app"

// --- 3. PIN DEFINITIONS ---
// Level Sensor
#define TRIGPIN    27
#define ECHOPIN    26
#define ButtonPin1 12  // Local button (can be used for other features later)

// Sensors
#define PRESSURE_PIN 34  // ADC1
#define FLOW_PIN     4

// Current Sensors (MUST BE ADC1 PINS)
#define CURRENT1_PIN 35  // ADC1 Sensor for Pump 1
#define CURRENT2_PIN 32  // ADC1 Sensor for Pump 2 (Swapped with Valve 1)

// Relays
#define PUMP1_PIN  14
#define PUMP2_PIN  25

// Solenoid Valve Relays
#define VALVE1_PIN 13  // NC (Swapped to the old Buzzer pin!)
#define VALVE2_PIN 33  // NC
#define VALVE3_PIN 18  // NC
#define VALVE4_PIN 19  // NC
#define VALVE5_PIN 23  // NO

// --- 4. OLED CONFIG ---
#define i2c_Address 0x3c
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SH1106G display = Adafruit_SH1106G(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// --- 5. GLOBAL VARIABLES ---
float duration, distance;
int waterLevelPer = 0;
int triggerPer = 10;

int total_depth_cm = 200;
int sensor_blind_spot_cm = 20;
int auto_switch_minutes = 30;

// UPDATED: Source Tank Logic Limits
const int tankEmptyCutoffPercent = 5; 
const int tankSafePercent = 10;       

const float mpaToPsi = 145.038;
const float pressureLowPsi = 20.0;
const float pressureHighPsi = 40.0;

float pressureMPa = 0.0;
float pressurePsi = 0.0; // Global PSI variable
const float maxSafePressureMpa = 1.0;

// Variables retained for safety/compatibility
const float pressureDividerRatio = 1.5; // For 10k/20k resistors
const float psiConversionFactor = 145.038;
// -------------------------------------------

volatile unsigned long flowPulseCount = 0;
float flowRateLmin = 0.0;
float totalLiters = 0.0;
float dailyTotalLiters = 0.0;
const float flowCalibrationFactor = 7.5;

// Current Sensor Variables
float currentAmps1 = 0.0;
float currentAmps2 = 0.0;
const float currentSensitivity = 0.066;
const float maxSafeAmps = 12.0;
const float dryRunFlowThresholdLmin = 0.03;
const float dryRunCurrentMinAmps = 3.0;
const float dryRunCurrentMaxAmps = 5.0;
const unsigned long dryRunStartupGraceMs = 10000;
const int dryRunConsecutiveLimit = 3;

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
unsigned long sendDataPrevMillis = 0;
unsigned long sensorReadPrevMillis = 0;
bool signupOK = false;

String currentDateKey = "";
bool dailyHistoryRecovered = false;
bool tankEmptyLockout = false; // UPDATED variable name
bool dryRunAlert = false;
int nextPumpToStart = 1;
bool prevPump1Cmd = false;
bool prevPump2Cmd = false;
unsigned long activePumpStartMillis = 0;
int dryRunConsecutiveHits = 0;

// Auto-switch tracking state
bool lastPump1Command = false;
unsigned long pump1OnStartMillis = 0;

ButtonConfig config1;
AceButton button1(&config1);
void button1Handler(AceButton*, uint8_t, uint8_t);

void IRAM_ATTR countFlowPulse() {
  flowPulseCount++;
}

String getCurrentDateKey() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "";
  }

  char dateKey[11];
  strftime(dateKey, sizeof(dateKey), "%Y-%m-%d", &timeinfo);
  return String(dateKey);
}

void recoverDailyTotalFromFirebase() {
  if (!signupOK || !Firebase.ready() || dailyHistoryRecovered || currentDateKey.length() == 0) {
    return;
  }

  String dailyLitersPath = "/tank_01/history/daily/" + currentDateKey + "/total_liters";
  if (Firebase.RTDB.getFloat(&fbdo, dailyLitersPath)) {
    dailyTotalLiters = fbdo.floatData();
    Serial.print("Recovered daily total liters: ");
    Serial.println(dailyTotalLiters, 3);
  } else {
    dailyTotalLiters = 0.0;
    Serial.println("No existing daily history found for today; starting at 0.0 L");
  }

  dailyHistoryRecovered = true;
}

void updateDisplay() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);

  display.print("LVL: "); display.print(waterLevelPer); display.println("% ");
  
  display.print("PRS: "); display.print(pressurePsi, 1); display.println("psi");
  
  display.print("FLW: "); display.print(flowRateLmin, 1); display.println("L/m");
  display.print("TOT: "); display.print(totalLiters, 0); display.println("L");

  display.print("A1:"); display.print(currentAmps1, 1);
  display.print(" A2:"); display.println(currentAmps2, 1);

  display.display();
}

void setup() {
  Serial.begin(115200);

  analogSetAttenuation(ADC_11db);

  pinMode(ECHOPIN, INPUT); pinMode(TRIGPIN, OUTPUT);
  pinMode(ButtonPin1, INPUT_PULLUP);
  pinMode(PUMP1_PIN, OUTPUT); pinMode(PUMP2_PIN, OUTPUT);
  pinMode(VALVE1_PIN, OUTPUT); pinMode(VALVE2_PIN, OUTPUT);
  pinMode(VALVE3_PIN, OUTPUT); pinMode(VALVE4_PIN, OUTPUT);
  pinMode(VALVE5_PIN, OUTPUT);

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), countFlowPulse, FALLING);

  digitalWrite(PUMP1_PIN, HIGH); digitalWrite(PUMP2_PIN, HIGH);
  digitalWrite(VALVE1_PIN, HIGH); digitalWrite(VALVE2_PIN, HIGH);
  digitalWrite(VALVE3_PIN, HIGH); digitalWrite(VALVE4_PIN, HIGH);
  digitalWrite(VALVE5_PIN, HIGH);

  config1.setEventHandler(button1Handler);
  button1.init(ButtonPin1);

  delay(250);
  display.begin(i2c_Address, true);
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  display.setCursor(0, 10);
  display.println("Connecting WiFi...");
  display.display();

  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }

  // NTP sync for Asia/Manila (UTC+8)
  configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  currentDateKey = getCurrentDateKey();

  display.clearDisplay(); display.setCursor(0, 10);
  display.println("Connecting Firebase..."); display.display();

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  if (Firebase.signUp(&config, &auth, "", "")) {
    signupOK = true;
  }

  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  if (signupOK) {
    display.clearDisplay(); display.setCursor(0, 10);
    display.println("System Ready!"); display.display();

    // Safety init on database
    Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_1_status", false);
    Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_2_status", false);

    Firebase.RTDB.setBool(&fbdo, "/tank_01/valve_1_status", false);
    Firebase.RTDB.setBool(&fbdo, "/tank_01/valve_2_status", false);
    Firebase.RTDB.setBool(&fbdo, "/tank_01/valve_3_status", false);
    Firebase.RTDB.setBool(&fbdo, "/tank_01/valve_4_status", false);
    Firebase.RTDB.setBool(&fbdo, "/tank_01/valve_5_status", false);

    Firebase.RTDB.setFloat(&fbdo, "/tank_01/current_amps_1", 0.0);
    Firebase.RTDB.setFloat(&fbdo, "/tank_01/current_amps_2", 0.0);
  }
  delay(2000);
}

unsigned long flowCalcPrevMillis = 0;

void loop() {
  button1.check();

  String latestDateKey = getCurrentDateKey();
  if (latestDateKey.length() > 0 && latestDateKey != currentDateKey) {
    currentDateKey = latestDateKey;
    dailyTotalLiters = 0.0;
    dailyHistoryRecovered = false;
    Serial.print("DATE ROLLOVER DETECTED: ");
    Serial.println(currentDateKey);
  }

  recoverDailyTotalFromFirebase();

  if (millis() - sensorReadPrevMillis > 2000 || sensorReadPrevMillis == 0) {
    sensorReadPrevMillis = millis();

    // A. Read Level
    digitalWrite(TRIGPIN, LOW); delayMicroseconds(2);
    digitalWrite(TRIGPIN, HIGH); delayMicroseconds(20);
    digitalWrite(TRIGPIN, LOW);
    duration = pulseIn(ECHOPIN, HIGH, 30000);

    if (duration > 0) {
      distance = ((duration / 2) * 0.343) / 10;
      if (distance >= total_depth_cm) waterLevelPer = 0;
      else if (distance <= sensor_blind_spot_cm) waterLevelPer = 100;
      else waterLevelPer = map((int)distance, total_depth_cm, sensor_blind_spot_cm, 0, 100);
    }

    // UPDATED: Source Tank Empty Protection Logic
    if (!tankEmptyLockout && waterLevelPer <= tankEmptyCutoffPercent) {
      tankEmptyLockout = true;
      digitalWrite(PUMP1_PIN, HIGH);
      digitalWrite(PUMP2_PIN, HIGH);
      pump1OnStartMillis = 0;
      lastPump1Command = false;
      Serial.println("SOURCE TANK EMPTY: Pump lockout enabled to prevent dry run");
    } else if (tankEmptyLockout && waterLevelPer >= tankSafePercent) {
      tankEmptyLockout = false;
      Serial.println("SOURCE TANK REFILLED: Pump lockout released");
    }

    // --- INTEGRATED BLOCK START ---
    // B. Read Pressure (Direct Pin Voltage Calibration)
    long pressureRaw = 0;
    const int numSamples = 100; 
    for (int i = 0; i < numSamples; i++) {
      pressureRaw += analogRead(PRESSURE_PIN);
      delayMicroseconds(500); 
    }
    
    float avgRaw = (float)pressureRaw / numSamples;

    // 1. Convert Raw ADC to Voltage at the ESP32 pin
    float pinVoltage = (avgRaw / 4095.0) * 3.3;

    // 2. Direct Calibration using Reverse-Engineered Hardware Data
    if (pinVoltage <= 0.315) { 
      pressurePsi = 0.0;
    } else {
      pressurePsi = (pinVoltage - 0.311) * 512.82;
    }
    
    // Safety clamp
    if (pressurePsi < 0.0) pressurePsi = 0.0;
    
    // 3. Back-calculate MPa for existing pump safety logic and Firebase
    pressureMPa = pressurePsi / 145.038;

    // Serial Debug for Calibration
    // Serial.print("Pin V: "); Serial.print(pinVoltage, 3);
    // Serial.print(" | P(psi): "); Serial.println(pressurePsi, 1);

    // C. Read Flow (With Phantom Pulse Noise Filter)
    unsigned long timeChange = millis() - flowCalcPrevMillis;
    flowCalcPrevMillis = millis();
    detachInterrupt(digitalPinToInterrupt(FLOW_PIN));
    unsigned long pulses = flowPulseCount; flowPulseCount = 0;
    attachInterrupt(digitalPinToInterrupt(FLOW_PIN), countFlowPulse, FALLING);

    if (timeChange > 0) {
      if (pulses < 3) {
        flowRateLmin = 0.0; 
      } else {
        flowRateLmin = (pulses / flowCalibrationFactor) * (60000.0 / timeChange);
        float intervalLiters = flowRateLmin * (timeChange / 60000.0);
        totalLiters += intervalLiters;
        dailyTotalLiters += intervalLiters;
      }
    }

    // D. Read AC Current
    int max1 = 0, min1 = 4095, max2 = 0, min2 = 4095;
    uint32_t start_time = millis();
    while ((millis() - start_time) < 20) {
      int r1 = analogRead(CURRENT1_PIN);
      int r2 = analogRead(CURRENT2_PIN);
      if (r1 > max1) max1 = r1; if (r1 < min1) min1 = r1;
      if (r2 > max2) max2 = r2; if (r2 < min2) min2 = r2;
    }

    float svRMS1 = (((max1 - min1) * (3.3 / 4095.0) * 1.5) / 2.0) * 0.707;
    currentAmps1 = svRMS1 / currentSensitivity;
    if (currentAmps1 < 0.15) currentAmps1 = 0.0;

    float svRMS2 = (((max2 - min2) * (3.3 / 4095.0) * 1.5) / 2.0) * 0.707;
    currentAmps2 = svRMS2 / currentSensitivity;
    if (currentAmps2 < 0.15) currentAmps2 = 0.0;

    // OVERCURRENT & OVERPRESSURE SAFETY SHUTDOWN
    bool pump1Safe = (pressureMPa <= maxSafePressureMpa) && (currentAmps1 <= maxSafeAmps);
    bool pump2Safe = (pressureMPa <= maxSafePressureMpa) && (currentAmps2 <= maxSafeAmps);

    if (!pump1Safe) digitalWrite(PUMP1_PIN, HIGH); // Force OFF
    if (!pump2Safe) digitalWrite(PUMP2_PIN, HIGH); // Force OFF

    if (currentAmps1 > maxSafeAmps) Serial.println("ALERT: PUMP 1 OVERCURRENT!");
    if (currentAmps2 > maxSafeAmps) Serial.println("ALERT: PUMP 2 OVERCURRENT!");

    Serial.print("P(psi):"); Serial.print(pressurePsi, 1);
    Serial.print("| F:"); Serial.print(flowRateLmin, 1);
    Serial.print("| A1:"); Serial.print(currentAmps1, 2);
    Serial.print("| A2:"); Serial.println(currentAmps2, 2);

    updateDisplay();
  }

  // --- 2. CLOUD SYNC & HARDWARE CONTROL ---
  if (Firebase.ready() && signupOK && (millis() - sendDataPrevMillis > 2000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    recoverDailyTotalFromFirebase();

    if (Firebase.RTDB.getInt(&fbdo, "/tank_01/total_depth_cm")) {
      total_depth_cm = fbdo.intData();
    }

    if (Firebase.RTDB.getInt(&fbdo, "/tank_01/auto_switch_minutes")) {
      auto_switch_minutes = fbdo.intData();
      if (auto_switch_minutes < 0) auto_switch_minutes = 0;
    }

    bool p1Safe = (pressureMPa <= maxSafePressureMpa) && (currentAmps1 <= maxSafeAmps);
    bool p2Safe = (pressureMPa <= maxSafePressureMpa) && (currentAmps2 <= maxSafeAmps);

    bool pump1Cmd = false;
    bool pump2Cmd = false;

    if (Firebase.RTDB.getBool(&fbdo, "/tank_01/pump_1_status")) {
      pump1Cmd = fbdo.boolData();
    }
    if (Firebase.RTDB.getBool(&fbdo, "/tank_01/pump_2_status")) {
      pump2Cmd = fbdo.boolData();
    }

    // UPDATED: Now enforces lockout when tank is EMPTY
    if (tankEmptyLockout) {
      if (pump1Cmd || pump2Cmd) {
        Serial.println("TANK EMPTY SAFETY: Forcing pumps OFF");
      }
      pump1Cmd = false;
      pump2Cmd = false;
      Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_1_status", false);
      Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_2_status", false);
    }

    // Safety gate pump commands
    if (!p1Safe && pump1Cmd) {
      pump1Cmd = false;
      Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_1_status", false);
      Serial.println("SAFETY: Pump 1 forced OFF");
    }

    if (!p2Safe && pump2Cmd) {
      pump2Cmd = false;
      Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_2_status", false);
      Serial.println("SAFETY: Pump 2 forced OFF");
    }

    // Pressure-based hysteresis control (psi):
    bool anyPumpOn = pump1Cmd || pump2Cmd;

    if (!tankEmptyLockout) {
      if (anyPumpOn && pressurePsi >= pressureHighPsi) {
        int stoppedPump = pump1Cmd ? 1 : (pump2Cmd ? 2 : 0);
        pump1Cmd = false;
        pump2Cmd = false;
        Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_1_status", false);
        Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_2_status", false);

        if (stoppedPump == 1) nextPumpToStart = 2;
        else if (stoppedPump == 2) nextPumpToStart = 1;

        Serial.print("PRESSURE HIGH (");
        Serial.print(pressurePsi, 1);
        Serial.println(" psi): Active pump OFF");
      }

      if (!pump1Cmd && !pump2Cmd && pressurePsi <= pressureLowPsi) {
        bool startedPump = false;

        if (nextPumpToStart == 1 && p1Safe) {
          pump1Cmd = true;
          pump2Cmd = false;
          nextPumpToStart = 2;
          startedPump = true;
          Serial.print("PRESSURE LOW (");
          Serial.print(pressurePsi, 1);
          Serial.println(" psi): Pump 1 ON");
        } else if (nextPumpToStart == 2 && p2Safe) {
          pump2Cmd = true;
          pump1Cmd = false;
          nextPumpToStart = 1;
          startedPump = true;
          Serial.print("PRESSURE LOW (");
          Serial.print(pressurePsi, 1);
          Serial.println(" psi): Pump 2 ON");
        } else {
          Serial.println("PRESSURE LOW: Preferred alternating pump not safe, keeping pumps OFF");
        }

        if (startedPump) {
          Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_1_status", pump1Cmd);
          Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_2_status", pump2Cmd);
        }
      }
    }

    // Dry-run protection
    if ((pump1Cmd && !prevPump1Cmd) || (pump2Cmd && !prevPump2Cmd)) {
      activePumpStartMillis = millis();
      dryRunConsecutiveHits = 0;
    }
    if (!pump1Cmd && !pump2Cmd) {
      activePumpStartMillis = 0;
      dryRunConsecutiveHits = 0;
    }

    bool inDryRunGrace = activePumpStartMillis > 0 &&
                         (millis() - activePumpStartMillis < dryRunStartupGraceMs);

    bool dryRunPump1 = pump1Cmd && !pump2Cmd &&
                       (flowRateLmin <= dryRunFlowThresholdLmin) &&
                       (currentAmps1 >= dryRunCurrentMinAmps) &&
                       (currentAmps1 <= dryRunCurrentMaxAmps);
    bool dryRunPump2 = pump2Cmd && !pump1Cmd &&
                       (flowRateLmin <= dryRunFlowThresholdLmin) &&
                       (currentAmps2 >= dryRunCurrentMinAmps) &&
                       (currentAmps2 <= dryRunCurrentMaxAmps);

    bool dryRunCandidate = !inDryRunGrace && (dryRunPump1 || dryRunPump2);
    if (dryRunCandidate) {
      dryRunConsecutiveHits++;
    } else {
      dryRunConsecutiveHits = 0;
    }

    if (dryRunConsecutiveHits >= dryRunConsecutiveLimit) {
      dryRunAlert = true;

      if (dryRunPump1) {
        pump1Cmd = false;
        nextPumpToStart = 2;
        Serial.println("DRY RUN DETECTED: Pump 1 forced OFF");
      }
      if (dryRunPump2) {
        pump2Cmd = false;
        nextPumpToStart = 1;
        Serial.println("DRY RUN DETECTED: Pump 2 forced OFF");
      }

      Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_1_status", pump1Cmd);
      Firebase.RTDB.setBool(&fbdo, "/tank_01/pump_2_status", pump2Cmd);
      dryRunConsecutiveHits = 0;
    } else {
      dryRunAlert = false;
    }

    lastPump1Command = pump1Cmd;
    prevPump1Cmd = pump1Cmd;
    prevPump2Cmd = pump2Cmd;

    // Apply final pump states to relays
    digitalWrite(PUMP1_PIN, pump1Cmd ? LOW : HIGH);
    digitalWrite(PUMP2_PIN, pump2Cmd ? LOW : HIGH);

    // --- AUTOMATED VALVE INTERLOCK ---
    digitalWrite(VALVE4_PIN, pump1Cmd ? LOW : HIGH);
    digitalWrite(VALVE5_PIN, pump2Cmd ? LOW : HIGH); 

    // Valve controls (Manual overrides for Valves 1-3 only)
    if (Firebase.RTDB.getBool(&fbdo, "/tank_01/valve_1_status")) digitalWrite(VALVE1_PIN, fbdo.boolData() ? LOW : HIGH);
    if (Firebase.RTDB.getBool(&fbdo, "/tank_01/valve_2_status")) digitalWrite(VALVE2_PIN, fbdo.boolData() ? LOW : HIGH);
    if (Firebase.RTDB.getBool(&fbdo, "/tank_01/valve_3_status")) digitalWrite(VALVE3_PIN, fbdo.boolData() ? LOW : HIGH);

    // Sensor telemetry upload
    Firebase.RTDB.setFloat(&fbdo, "/tank_01/pressure_mpa", pressureMPa);
    Firebase.RTDB.setFloat(&fbdo, "/tank_01/pressure_psi", pressurePsi);
    Firebase.RTDB.setFloat(&fbdo, "/tank_01/flow_rate_lmin", flowRateLmin);
    Firebase.RTDB.setFloat(&fbdo, "/tank_01/total_flow_l", totalLiters);
    Firebase.RTDB.setFloat(&fbdo, "/tank_01/current_amps_1", currentAmps1);
    Firebase.RTDB.setFloat(&fbdo, "/tank_01/current_amps_2", currentAmps2);
    Firebase.RTDB.setInt(&fbdo, "/tank_01/distance_cm", (int)distance);
    Firebase.RTDB.setInt(&fbdo, "/tank_01/level_percent", waterLevelPer);

    if (currentDateKey.length() > 0) {
      float dailyTotalM3 = dailyTotalLiters / 1000.0;
      String dailyBasePath = "/tank_01/history/daily/" + currentDateKey;
      Firebase.RTDB.setFloat(&fbdo, dailyBasePath + "/total_liters", dailyTotalLiters);
      Firebase.RTDB.setFloat(&fbdo, dailyBasePath + "/total_m3", dailyTotalM3);
    }

    // UPDATED: Sends tank_empty_lockout to Firebase
    Firebase.RTDB.setBool(&fbdo, "/tank_01/tank_empty_lockout", tankEmptyLockout);
    Firebase.RTDB.setBool(&fbdo, "/tank_01/dry_run_alert", dryRunAlert);

    // Sync automated valves back to App
    Firebase.RTDB.setBool(&fbdo, "/tank_01/valve_4_status", pump1Cmd);
    Firebase.RTDB.setBool(&fbdo, "/tank_01/valve_5_status", pump2Cmd);
  }

  delay(10);
}

void button1Handler(AceButton* button, uint8_t eventType, uint8_t buttonState) {
  switch (eventType) {
    case AceButton::kEventReleased:
      Serial.println("Local Button Pressed!");
      break;
  }
}