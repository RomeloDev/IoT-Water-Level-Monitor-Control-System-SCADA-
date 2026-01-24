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
   - **Read-Only (Sensors):**
     - `distance_cm` (number): Raw air gap distance.
     - `current_pump_running` (1 | 2): Which pump is currently active.
   - **Write/Control (Commands & Config):**
     - `pump_1_command` (boolean): true = ON, false = OFF.
     - `pump_2_command` (boolean): true = ON, false = OFF.
     - `auto_switch_minutes` (number): Failover timer setting.
     - `total_depth_cm` (number): The maximum depth of the tank (Centralized).
4. **DATA LOGIC:**
   - **Water Level %:** Calculated in App using Firebase data: `((total_depth_cm - distance_cm) / total_depth_cm) * 100`.
   - **Persistence:** ALL settings (Depth & Timer) are stored in Firebase. NO `AsyncStorage` for config.
5. **UI/UX:**
   - Use 'Switch' component for Pump Control.
   - Use 'TextInput' with `keyboardType='numeric'`.
   - Dashboard must listen to `total_depth_cm` changes in real-time.