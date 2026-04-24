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
   - **Read-Only (Sensors & Safety Alerts from ESP32):**
     - `distance_cm` (number): Raw air gap distance.
     - `level_percent` (number): Pre-calculated water level percentage from ESP32.
     - `pressure_mpa` (number): Current pressure in the tank in MPa.
     - `pressure_psi` (number): Current pressure in the tank in PSI.
     - `flow_rate_lmin` (number): Current water flow in Liters per minute.
     - `total_flow_l` (number): Cumulative water pumped in Liters.
     - `current_amps_1` (number): AC Current for Pump 1 in Amps.
     - `current_amps_2` (number): AC Current for Pump 2 in Amps.
     - `tank_empty_lockout` (boolean): true = Source tank empty (< 5%), pumps locked out.
     - `dry_run_alert` (boolean): true = Dry run detected, pumps forced OFF.
   - **Hardware Interlocked (Read-Only UI Indicators):**
     - `valve_4_status` (boolean): Auto-opens when Pump 1 is ON. Do NOT build a manual toggle for this.
     - `valve_5_status` (boolean): Auto-opens when Pump 2 is ON. Do NOT build a manual toggle for this.
   - **Write/Control (Commands & Config to ESP32):**
     - `pump_1_status` (boolean): true = ON, false = OFF.
     - `pump_2_status` (boolean): true = ON, false = OFF.
     - `auto_switch_minutes` (number): Failover timer setting.
     - `total_depth_cm` (number): The maximum depth of the tank (Centralized).
     - `valve_1_status` (boolean): true = OPEN (NC), false = CLOSED
     - `valve_2_status` (boolean): true = OPEN (NC), false = CLOSED
     - `valve_3_status` (boolean): true = OPEN (NC), false = CLOSED
4. **DATA LOGIC:**
   - **Water Level %:** Read `level_percent` directly from Firebase (ESP32 handles the math dynamically based on `total_depth_cm`).
   - **Persistence:** ALL settings (Depth & Timer) are stored in Firebase. NO `AsyncStorage` for config.
5. **UI/UX:**
   - Use 'Switch' component for Pump & Valve 1-3 Control.
   - Use 'TextInput' with `keyboardType='numeric'` for settings.
   - Dashboard must listen to all read-only sensors and safety alerts in real-time and display them cleanly.