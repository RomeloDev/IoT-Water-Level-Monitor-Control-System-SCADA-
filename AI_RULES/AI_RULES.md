# Project: IoT Water Level Monitor & Control System (SCADA)
# Stack: React Native (Expo), TypeScript, Firebase Realtime Database
# Structure:
# - /app (Expo Router pages)
# - /components (Re-usable UI)
# - /services (Backend logic)

# RULES FOR AI AGENT:
1. **ROUTING:** Use 'expo-router'.
2. **DATABASE & STATE:**
   - Import 'database' from '@/services/firebase'.
   - **READING:** Use 'onValue' for real-time updates.
   - **WRITING:** Use 'update' to modify specific fields.
3. **HARDWARE CONTRACT (JSON Structure):**
   - **Root Node:** `/tank_01`
   - **Read-Only (Sensors from ESP32):**
     - `distance_cm` (number): Raw air gap distance.
     - `level_percent` (number): Pre-calculated water level percentage from ESP32.
     - `pressure_mpa` (number): Current pressure in the tank in MPa.
     - `flow_rate_lmin` (number): Current water flow in Liters per minute.
     - `total_flow_l` (number): Cumulative water pumped in Liters.
     - `current_amps_1` (number): AC Current for Pump 1 in Amps.
     - `current_amps_2` (number): AC Current for Pump 2 in Amps.
   - **Write/Control (Commands & Config to ESP32):**
     - `pump_1_status` (boolean): true = ON, false = OFF.
     - `pump_2_status` (boolean): true = ON, false = OFF.
     - `auto_switch_minutes` (number): Failover timer setting.
     - `total_depth_cm` (number): The maximum depth of the tank (Centralized).
     - `valve_1_status` (boolean): true = OPEN (NC), false = CLOSED
     - `valve_2_status` (boolean): true = OPEN (NC), false = CLOSED
     - `valve_3_status` (boolean): true = OPEN (NC), false = CLOSED
     - `valve_4_status` (boolean): true = OPEN (NC), false = CLOSED
     - `valve_5_status` (boolean): true = CLOSED (NO), false = OPEN
4. **DATA LOGIC:**
   - **Water Level %:** Read `level_percent` directly from Firebase (ESP32 handles the math dynamically based on `total_depth_cm`).
   - **Persistence:** ALL settings (Depth & Timer) are stored in Firebase. NO `AsyncStorage` for config.
5. **UI/UX:**
   - Use 'Switch' component for Pump Control.
   - Use 'TextInput' with `keyboardType='numeric'` for settings.
   - Dashboard must listen to all read-only sensors in real-time and display them cleanly.