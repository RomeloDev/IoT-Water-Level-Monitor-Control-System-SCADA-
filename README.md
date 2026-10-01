## IoT Water Distribution SCADA

An end-to-end supervisory control and data acquisition (SCADA) system for monitoring and controlling a source-water-tank distribution installation. The project combines a React Native mobile operator console, Firebase Realtime Database telemetry and command transport, and an ESP32 edge controller that reads the physical plant, applies local safety logic, and drives pumps and solenoid valves.

## Key Features

### Mobile SCADA console

- Real-time water level, distance, pressure, flow, total volume, motor-current, and safety-alert monitoring.
- Expo Router tabs for Dashboard, Sensor Analytics, Water History, Controllers, and Settings.
- Manual pump control and manual overrides for Valves 1-3 through Firebase `update` operations.
- Read-only status indicators for hardware-interlocked Valves 4-5.
- Daily flow totals in liters and cubic meters, keyed to `Asia/Manila` dates.
- Remote configuration of tank depth, pump mode settings, failover interval, and valve names.
- Audio alarms and local notifications for critical level, high pressure, dry-run, and overcurrent events.

### Hardware edge logic

- Ultrasonic level calculation with configurable tank depth and a 20 cm sensor blind spot.
- Empirical two-point pressure calibration from ESP32 ADC voltage, reported in PSI and MPa.
- Digital flow measurement with interrupt pulse counting, a 5.5 K-factor, and EMI/noise rejection.
- Empty-source-tank lockout at 5%, released only after the tank reaches 10%.
- Dry-run detection after a 10-second startup grace period when current is present but flow is near zero.
- Overcurrent and overpressure shutdown gates before pump relay activation.
- Pressure hysteresis: stop at 40 PSI and permit startup at or below 20 PSI.
- Alternating pump start preference and automatic Valve 4/5 synchronization.

## System Architecture

```text
                         Firebase Realtime Database
                      /tank_01 telemetry and commands
                         ^                       ^
                         |                       |
               onValue real-time reads     update commands
                         |                       |
  React Native + Expo mobile app       ESP32 edge controller
  Dashboard / Analytics / History      Sensor sampling + safety logic
  Controllers / Settings               Relay and valve actuation
                         |                       v
                         +---------- Pumps, valves, OLED, alarms
```

The mobile application imports the shared Firebase database instance from `services/firebase.ts`. Screens subscribe to `/tank_01` with `onValue`; control and configuration writes use `update`. The ESP32 polls commands and publishes telemetry approximately every two seconds.

## Tech Stack

| Layer              | Technology                                                    |
| ------------------ | ------------------------------------------------------------- |
| Mobile UI          | React Native 0.81, React 19, TypeScript 5.9                   |
| Mobile runtime     | Expo SDK 54, Expo Router, Expo Dev Client                     |
| Cloud transport    | Firebase Realtime Database                                    |
| Mobile services    | Firebase JS SDK, Expo Notifications, Expo Audio               |
| Edge controller    | ESP32 with Arduino framework, C/C++                           |
| Hardware libraries | Firebase_ESP_Client, Adafruit_GFX, Adafruit_SH110X, AceButton |

## Mobile App Architecture

```text
app/_layout.tsx                    Root Stack and theme provider
app/(tabs)/_layout.tsx             Bottom-tab navigation
app/(tabs)/index.tsx               Live dashboard and critical-level alarm
app/(tabs)/analytics.tsx           Pressure, flow, current, and safety analysis
app/(tabs)/history.tsx             Daily historical volume queries
app/(tabs)/controllers.tsx         Pump and Valve 1-3 command controls
app/(tabs)/settings.tsx            Remote tank and naming configuration
components/                        Reusable UI components
services/firebase.ts               Firebase Realtime Database client
AI_RULES/AI_RULES.md               Mobile architecture and data contract
```

`services/firebase.ts` reads Expo public environment variables and reports missing keys before initializing Firebase. Runtime configuration is stored in Firebase rather than `AsyncStorage`; the ESP32 reads the same values from `/tank_01`.

## Firebase Data Contract

The system uses `/tank_01` as its root node:

| Field                                | Type    | Ownership / meaning                           |
| ------------------------------------ | ------- | --------------------------------------------- |
| `distance_cm`                        | number  | ESP32 ultrasonic air-gap distance             |
| `level_percent`                      | number  | ESP32-calculated source-tank level            |
| `pressure_mpa`, `pressure_psi`       | number  | ESP32 pressure telemetry                      |
| `flow_rate_lmin`                     | number  | Current flow in L/min                         |
| `total_flow_l`                       | number  | Cumulative pumped volume in liters            |
| `current_amps_1`, `current_amps_2`   | number  | AC current for Pumps 1 and 2                  |
| `tank_empty_lockout`                 | boolean | Source tank is below the 5% cutoff            |
| `dry_run_alert`                      | boolean | Edge controller detected a dry-run condition  |
| `pump_1_status`, `pump_2_status`     | boolean | Operator/ESP32 pump commands                  |
| `valve_1_status` to `valve_3_status` | boolean | Manual commands; `true` is open for NC valves |
| `valve_4_status`, `valve_5_status`   | boolean | Read-only, synchronized to Pumps 1 and 2      |
| `total_depth_cm`                     | number  | Configurable tank depth                       |
| `auto_switch_minutes`                | number  | Remote pump failover interval setting         |
| `history/daily/YYYY-MM-DD`           | object  | Daily `total_liters` and `total_m3` records   |

The mobile UI treats Valves 4 and 5 as indicators, not manual controls. The edge controller can overwrite pump commands whenever a safety condition is active.

## Hardware Architecture & Pinout

### Field components

- **Waterproof ultrasonic sensor:** measures the air gap above the water; the ESP32 converts it to a percentage using `total_depth_cm` and the 20 cm blind spot.
- **YANGS 1.2 MPa pressure transducer:** connected through a voltage divider to an ADC1 input; the sketch averages 100 samples.
- **1-60 L/min flow meter:** pulse output is counted on an interrupt input and converted using a 5.5 K-factor.
- **AC current sensors:** one ADC1 channel per pump; a 20 ms peak-to-peak window estimates RMS current.
- **Relay outputs:** active-low pump and solenoid relay outputs. Startup writes HIGH, representing OFF.
- **128x64 SH1106 OLED:** local display at I2C address `0x3C`.

### ESP32 pin definitions

| Function                |            GPIO | Notes                                                |
| ----------------------- | --------------: | ---------------------------------------------------- |
| Ultrasonic trigger      |              27 | `TRIGPIN`                                            |
| Ultrasonic echo         |              26 | `ECHOPIN`                                            |
| Local push button       |              12 | `ButtonPin1`, internal pull-up                       |
| Pressure transducer ADC |              34 | `PRESSURE_PIN`, ADC1                                 |
| Flow meter pulse        |               4 | `FLOW_PIN`, interrupt, internal pull-up              |
| Pump 1 current sensor   |              35 | `CURRENT1_PIN`, ADC1                                 |
| Pump 2 current sensor   |              32 | `CURRENT2_PIN`, ADC1                                 |
| Pump 1 relay            |              14 | `PUMP1_PIN`, active-low                              |
| Pump 2 relay            |              25 | `PUMP2_PIN`, active-low                              |
| Valve 1 relay           |              13 | `VALVE1_PIN`, NC                                     |
| Valve 2 relay           |              33 | `VALVE2_PIN`, NC                                     |
| Valve 3 relay           |              18 | `VALVE3_PIN`, NC                                     |
| Valve 4 relay           |              19 | `VALVE4_PIN`, NC; follows Pump 1                     |
| Valve 5 relay           |              23 | `VALVE5_PIN`, NO; follows Pump 2                     |
| OLED I2C                | `Wire` defaults | Address `0x3C`; verify board-specific SDA/SCL wiring |

### Edge control and safety behavior

1. **Level:** distances at or above `total_depth_cm` become 0%; distances at or below the 20 cm blind spot become 100%.
2. **Empty tank lockout:** at 5% or below, both pumps are forced off and Firebase commands reset to `false`. Lockout releases at 10% or above.
3. **Pressure:** 100 ADC samples are averaged. At or below 0.315 V, pressure is 0 PSI; otherwise the sketch applies `PSI = (pinVoltage - 0.311) * 512.82`, then derives MPa using `145.038 PSI = 1 MPa`.
4. **Flow:** pulse counts below 3 or above 1000 per interval are rejected as noise/EMI. Accepted frequency is divided by `5.5` to produce L/min and interval volume is accumulated.
5. **Electrical protection:** a pump is unsafe above 1.0 MPa or 12 A. Unsafe commands are forced off at the relay and synchronized to Firebase.
6. **Pressure control:** an active pump stops at 40 PSI. When both pumps are off and pressure is at or below 20 PSI, the preferred alternating safe pump may start.
7. **Dry-run protection:** after a 10-second grace period, flow at or below 0.03 L/min with current between 3 A and 5 A is counted as a dry-run candidate. Three consecutive detections force the pump off and raise `dry_run_alert`.
8. **Valve interlocks:** Valve 4 mirrors Pump 1 and Valve 5 mirrors Pump 2 at relay and Firebase levels. Valves 1-3 remain manual.

> **Implementation note:** `auto_switch_minutes` is read from Firebase and retained as controller configuration. The current sketch's active pump selection is driven by pressure hysteresis and alternating pump preference; validate or extend the timer behavior before relying on it as a timed failover guarantee in production.

## Installation & Setup

### Software

Prerequisites: Node.js LTS, npm, Android Studio/SDK for native Android builds, a Firebase project with Realtime Database enabled, and Arduino IDE with ESP32 board support.

1. Install dependencies with `npm install`.
2. Create a local `.env` file using the template below. Do not commit it.
3. Start Expo with `npx expo start`, then use a development build, emulator, or compatible Expo Go client.
4. For a local Android build, run `npx expo run:android`.
5. Run `npm run lint` to validate the Expo project.

The Android project references `google-services.json` through `app.json`; keep it matched to the Firebase project used by Realtime Database.

### Hardware

1. Install Arduino IDE and add the Espressif ESP32 board package through Boards Manager.
2. Select the matching board variant and serial port.
3. Install the libraries below through Library Manager.
4. Open `assets/iot_water_monitoring_esp32/iot_water_monitoring_esp32.ino`.
5. Replace Wi-Fi and Firebase values with device-specific values. Never commit real credentials.
6. Verify the voltage divider, relay polarity, common ground, and pin wiring before powering pumps.
7. Compile and upload at 115200 baud. Use Serial Monitor at 115200 to inspect Wi-Fi, Firebase, sensor, and safety messages.
8. Confirm `/tank_01` telemetry in Firebase and the app before testing relay outputs.

Required Arduino libraries:

- `Firebase_ESP_Client`
- `Adafruit GFX Library`
- `Adafruit SH110X`
- `AceButton`

The sketch also uses the ESP32 core's `WiFi`, `Wire`, and `time` APIs, plus `TokenHelper.h` and `RTDBHelper.h` from the Firebase library's `addons` directory.

## Environment Configuration

### Mobile `.env` template

The Expo Firebase service reads these `EXPO_PUBLIC_*` variables. They are bundled into the client, so Realtime Database rules must provide the authorization boundary.

```dotenv
EXPO_PUBLIC_API_KEY=your-firebase-web-api-key
EXPO_PUBLIC_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_DATABASE_URL=https://your-project-default-rtdb.region.firebasedatabase.app
EXPO_PUBLIC_PROJECT_ID=your-project-id
EXPO_PUBLIC_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_MESSAGING_SENDER_ID=your-messaging-sender-id
EXPO_PUBLIC_APP_ID=your-firebase-web-app-id
```

Restart Expo after changing environment variables.

### ESP32 credential template

Use equivalent device-specific values in the sketch, preferably through a local untracked configuration mechanism:

```cpp
const char* ssid = "your-wifi-ssid";
const char* pass = "your-wifi-password";

#define API_KEY "your-firebase-api-key"
#define DATABASE_URL "https://your-project-default-rtdb.region.firebasedatabase.app"
```

The ESP32 uses anonymous Firebase sign-up and the configured Realtime Database URL. Apply least-privilege database rules, rotate exposed credentials, and keep production secrets out of source control.

## Operational Notes

- Relay outputs are active-low: `LOW` energizes a pump/valve and `HIGH` turns it off.
- The source tank cutoff is 5%, while the mobile dashboard alarm threshold is below 10%.
- The ESP32 is authoritative because it can shut down outputs without the app being connected.
- Daily history is persisted under `/tank_01/history/daily/YYYY-MM-DD` using the ESP32's NTP-synchronized `Asia/Manila` date.
- Test with pumps disconnected or under supervision first. Validate relay logic and sensor calibration with the actual installation before commissioning.

## Repository Layout

```text
app/                                      Expo Router screens
components/                               Reusable React Native components
constants/                                Theme definitions
hooks/                                    React hooks
services/firebase.ts                      Firebase Realtime Database client
assets/iot_water_monitoring_esp32/        ESP32 Arduino sketch
AI_RULES/AI_RULES.md                      Mobile architecture and data contract
android/                                  Native Android project
app.json                                  Expo application configuration
package.json                              Scripts and dependencies
```

## License and Project Status

This repository is structured as a technical portfolio project and does not currently declare a license. Confirm the intended license and production deployment requirements before redistribution or live operation.
