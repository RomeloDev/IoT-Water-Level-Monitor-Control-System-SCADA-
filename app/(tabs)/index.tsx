import { database } from "@/services/firebase";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Notifications from "expo-notifications";
import { onValue, ref, update } from "firebase/database";
import React, { useEffect, useRef, useState } from "react";
import {
  LogBox,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native"; // <--- Import ScrollView
import CircularProgress from "react-native-circular-progress-indicator";

export default function DashboardScreen() {
  const [waterLevel, setWaterLevel] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>("--");
  const [pump1, setPump1] = useState<boolean>(false);
  const [pump2, setPump2] = useState<boolean>(false);
  const [valve1, setValve1] = useState<boolean>(false);
  const [valve2, setValve2] = useState<boolean>(false);
  const [valve3, setValve3] = useState<boolean>(false);
  const [valve4, setValve4] = useState<boolean>(false);
  const [valve5, setValve5] = useState<boolean>(false);
  const [valve1Name, setValve1Name] = useState<string>("Valve 1");
  const [valve2Name, setValve2Name] = useState<string>("Valve 2");
  const [valve3Name, setValve3Name] = useState<string>("Valve 3");
  const [valve4Name, setValve4Name] = useState<string>("Valve 4");
  const [valve5Name, setValve5Name] = useState<string>("Valve 5");
  const alarmPlayer = useAudioPlayer(require("../../assets/alarm.mp3"));
  const isAlarmPlayingRef = useRef<boolean>(false);
  const alarmNotifiedRef = useRef<boolean>(false);
  const notificationPermissionGrantedRef = useRef<boolean>(false);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  useEffect(() => {
    const requestPermissions = async (): Promise<void> => {
      const { status, granted } = await Notifications.requestPermissionsAsync();
      console.log("Permission status:", status);
      notificationPermissionGrantedRef.current =
        granted || status === "granted";
    };

    void requestPermissions();
  }, []);

  useEffect(() => {
    const tankRef = ref(database, "tank_01");

    const startAlarm = async (): Promise<void> => {
      if (isAlarmPlayingRef.current) return;

      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
        });

        alarmPlayer.loop = true;
        alarmPlayer.volume = 1;
        alarmPlayer.play();
        isAlarmPlayingRef.current = true;
      } catch (error) {
        console.warn("Failed to play alarm sound:", error);
      }

      if (
        !alarmNotifiedRef.current &&
        notificationPermissionGrantedRef.current
      ) {
        alarmNotifiedRef.current = true;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Critical Alert",
            body: "⚠️ CRITICAL LEVEL: Water is below 10%!",
          },
          trigger: null,
        });
      }
    };

    const stopAlarm = async (): Promise<void> => {
      if (!isAlarmPlayingRef.current) return;
      alarmPlayer.pause();
      alarmPlayer.seekTo(0);
      isAlarmPlayingRef.current = false;
    };

    const unsubscribe = onValue(
      tankRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          console.warn("Firebase snapshot is empty for tank_01");
          return;
        }

        const distanceCm = data.distance_cm ?? 0;
        const levelPercent = data.level_percent ?? 0;
        const p1 = data.pump_1_status ?? false;
        const p2 = data.pump_2_status ?? false;
        const v1 = data.valve_1_status ?? false;
        const v2 = data.valve_2_status ?? false;
        const v3 = data.valve_3_status ?? false;
        const v4 = data.valve_4_status ?? false;
        const v5 = data.valve_5_status ?? false;
        const name1 = String(data.valve_1_name ?? "").trim();
        const name2 = String(data.valve_2_name ?? "").trim();
        const name3 = String(data.valve_3_name ?? "").trim();
        const name4 = String(data.valve_4_name ?? "").trim();
        const name5 = String(data.valve_5_name ?? "").trim();

        const clamped = Math.max(0, Math.min(100, Math.round(levelPercent)));

        setDistance(distanceCm);
        setWaterLevel(clamped);
        setPump1(p1);
        setPump2(p2);
        setValve1(v1);
        setValve2(v2);
        setValve3(v3);
        setValve4(v4);
        setValve5(v5);
        setValve1Name(name1.length > 0 ? name1 : "Valve 1");
        setValve2Name(name2.length > 0 ? name2 : "Valve 2");
        setValve3Name(name3.length > 0 ? name3 : "Valve 3");
        setValve4Name(name4.length > 0 ? name4 : "Valve 4");
        setValve5Name(name5.length > 0 ? name5 : "Valve 5");
        setLastUpdated(new Date().toLocaleTimeString());

        if (clamped < 10) {
          void startAlarm();
        } else {
          alarmNotifiedRef.current = false;
          void stopAlarm();
        }
      },
      (error) => {
        console.error("Firebase onValue error:", error);
      },
    );

    return () => {
      unsubscribe();
      void stopAlarm();
      alarmPlayer.remove();
    };
  }, []);

  const toggleControl = (
    key:
      | "pump_1_status"
      | "pump_2_status"
      | "valve_1_status"
      | "valve_2_status"
      | "valve_3_status"
      | "valve_4_status"
      | "valve_5_status",
    currentVal: boolean,
  ) => {
    const tankRef = ref(database, "tank_01");
    update(tankRef, { [key]: !currentVal });
  };

  // Ignore the specific Expo Go notification warning
  LogBox.ignoreLogs([
    "expo-notifications: Android Push notifications",
    "Encountered an error while trying to get the push token",
    "[Reanimated] `createAnimatedPropAdapter` is no longer necessary in Reanimated 4",
  ]);

  return (
    // CHANGED: View -> ScrollView
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent} // <--- Added this prop
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Water Monitor</Text>

      <View style={styles.gaugeContainer}>
        <CircularProgress
          value={waterLevel}
          radius={120}
          duration={1000}
          progressValueColor={"#2ecc71"}
          maxValue={100}
          title={"%"}
          titleColor={"#2c3e50"}
          titleStyle={{ fontWeight: "bold" }}
          activeStrokeColor={"#3498db"}
          inActiveStrokeColor={"#ecf0f1"}
        />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.secondaryInfo}>Sensor Distance: {distance} cm</Text>
        <Text style={styles.secondaryInfo}>Last Updated: {lastUpdated}</Text>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: waterLevel < 10 ? "#e74c3c" : "#2ecc71" },
          ]}
        >
          <Text style={styles.statusText}>
            {waterLevel < 10 ? "⚠️ CRITICAL LOW" : "NORMAL STATUS"}
          </Text>
        </View>

        {/* Manual Pump Control */}
        <View style={styles.pumpControls}>
          <Text style={styles.pumpTitle}>Manual Pump Control</Text>

          <View style={styles.pumpRow}>
            <Text style={styles.pumpLabel}>Pump 1</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#3498db" }}
              thumbColor={pump1 ? "#fff" : "#f4f3f4"}
              onValueChange={() => toggleControl("pump_1_status", pump1)}
              value={pump1}
            />
          </View>

          <View style={styles.pumpRow}>
            <Text style={styles.pumpLabel}>Pump 2</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#3498db" }}
              thumbColor={pump2 ? "#fff" : "#f4f3f4"}
              onValueChange={() => toggleControl("pump_2_status", pump2)}
              value={pump2}
            />
          </View>
        </View>

        <View style={styles.pumpControls}>
          <Text style={styles.pumpTitle}>Valve Controls</Text>

          <View style={styles.pumpRow}>
            <Text style={styles.pumpLabel}>{valve1Name}</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#3498db" }}
              thumbColor={valve1 ? "#fff" : "#f4f3f4"}
              onValueChange={() => toggleControl("valve_1_status", valve1)}
              value={valve1}
            />
          </View>

          <View style={styles.pumpRow}>
            <Text style={styles.pumpLabel}>{valve2Name}</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#3498db" }}
              thumbColor={valve2 ? "#fff" : "#f4f3f4"}
              onValueChange={() => toggleControl("valve_2_status", valve2)}
              value={valve2}
            />
          </View>

          <View style={styles.pumpRow}>
            <Text style={styles.pumpLabel}>{valve3Name}</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#3498db" }}
              thumbColor={valve3 ? "#fff" : "#f4f3f4"}
              onValueChange={() => toggleControl("valve_3_status", valve3)}
              value={valve3}
            />
          </View>

          <View style={styles.pumpRow}>
            <Text style={styles.pumpLabel}>{valve4Name}</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#3498db" }}
              thumbColor={valve4 ? "#fff" : "#f4f3f4"}
              onValueChange={() => toggleControl("valve_4_status", valve4)}
              value={valve4}
            />
          </View>

          <View style={styles.pumpRow}>
            <Text style={styles.pumpLabel}>{valve5Name}</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#3498db" }}
              thumbColor={valve5 ? "#fff" : "#f4f3f4"}
              onValueChange={() => toggleControl("valve_5_status", valve5)}
              value={valve5}
            />
          </View>

          <Text style={styles.valveHint}>
            Valves 1-4 are NC: ON = OPEN. Valve 5 is NO: ON = CLOSED.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  // NEW: This style handles the alignment inside the ScrollView
  scrollContent: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 40, // Adds space at the bottom so you can scroll past the last item
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 40,
  },
  gaugeContainer: {
    marginBottom: 40,
  },
  infoContainer: {
    alignItems: "center",
    width: "85%", // Increased slightly for better fit
  },
  label: {
    fontSize: 16,
    color: "#7f8c8d",
  },
  value: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 10,
  },
  secondaryInfo: {
    fontSize: 12,
    color: "#95a5a6",
    marginBottom: 18,
  },
  statusBadge: {
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 10,
    marginBottom: 30, // Added margin to separate from Pump Controls
  },
  statusText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  pumpControls: {
    width: "100%",
    backgroundColor: "#f8f9fb",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ecf0f1",
    marginBottom: 18,
  },
  pumpTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 15,
    textAlign: "center",
  },
  pumpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15, // Increased spacing between switches
  },
  pumpLabel: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "500",
  },
  valveHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#8ea0b1",
    lineHeight: 18,
  },
});
