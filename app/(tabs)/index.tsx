import { database } from "@/services/firebase";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Notifications from "expo-notifications";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useRef, useState } from "react";
import { LogBox, ScrollView, StyleSheet, Text, View } from "react-native"; // <--- Import ScrollView
import CircularProgress from "react-native-circular-progress-indicator";

const MPA_TO_PSI = 145.038;

export default function DashboardScreen() {
  const [waterLevel, setWaterLevel] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>("--");
  const [pressurePsi, setPressurePsi] = useState<number>(0);
  const [pressureMpa, setPressureMpa] = useState<number>(0);
  const [hasPressurePsi, setHasPressurePsi] = useState<boolean>(false);
  const [hasPressureMpa, setHasPressureMpa] = useState<boolean>(false);
  const [isTankEmptyLockout, setIsTankEmptyLockout] = useState<boolean>(false);
  const [isDryRunActive, setIsDryRunActive] = useState<boolean>(false);
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
        const hasPressurePsiValue = data.pressure_psi !== undefined;
        const hasPressureMpaValue = data.pressure_mpa !== undefined;
        const tankEmptyLockout = data.tank_empty_lockout === true;
        const dryRunAlert = data.dry_run_alert === true;
        const pressurePsiValue = hasPressurePsiValue
          ? Number(data.pressure_psi)
          : hasPressureMpaValue
            ? Number(data.pressure_mpa) * MPA_TO_PSI
            : 0;
        const pressureMpaValue = hasPressureMpaValue
          ? Number(data.pressure_mpa)
          : hasPressurePsiValue
            ? Number(data.pressure_psi) / MPA_TO_PSI
            : 0;

        const clamped = Math.max(0, Math.min(100, Math.round(levelPercent)));

        setDistance(distanceCm);
        setWaterLevel(clamped);
        setLastUpdated(new Date().toLocaleTimeString());
        setHasPressurePsi(hasPressurePsiValue);
        setHasPressureMpa(hasPressureMpaValue);
        setPressurePsi(pressurePsiValue);
        setPressureMpa(pressureMpaValue);
        setIsTankEmptyLockout(tankEmptyLockout);
        setIsDryRunActive(dryRunAlert);

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

  // Ignore the specific Expo Go notification warning
  LogBox.ignoreLogs([
    "expo-notifications: Android Push notifications",
    "Encountered an error while trying to get the push token",
    "[Reanimated] `createAnimatedPropAdapter` is no longer necessary in Reanimated 4",
  ]);

  const hasAnyPressure = hasPressurePsi || hasPressureMpa;

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
        <Text style={styles.secondaryInfo}>
          {hasAnyPressure
            ? `Pressure: ${pressurePsi.toFixed(1)} psi${hasPressureMpa ? ` (${pressureMpa.toFixed(3)} MPa)` : ""}`
            : "Pressure: No sensor yet"}
        </Text>
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

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Safety Status</Text>

          <View style={styles.safetyRow}>
            <View
              style={[
                styles.statusDot,
                isTankEmptyLockout ? styles.dotCritical : styles.dotNormal,
              ]}
            />
            <Text style={styles.safetyLabel}>Source Tank Lockout</Text>
            <Text
              style={[
                styles.safetyValue,
                isTankEmptyLockout ? styles.valueCritical : styles.valueNormal,
              ]}
            >
              {isTankEmptyLockout ? "ACTIVE" : "Normal"}
            </Text>
          </View>

          <View style={styles.safetyRow}>
            <View
              style={[
                styles.statusDot,
                isDryRunActive ? styles.dotCritical : styles.dotNormal,
              ]}
            />
            <Text style={styles.safetyLabel}>Dry Run Alert</Text>
            <Text
              style={[
                styles.safetyValue,
                isDryRunActive ? styles.valueCritical : styles.valueNormal,
              ]}
            >
              {isDryRunActive ? "ACTIVE" : "Normal"}
            </Text>
          </View>
        </View>

        {isTankEmptyLockout && (
          <View style={[styles.alertBanner, styles.lockoutBanner]}>
            <Text style={styles.alertBannerText}>
              Source Tank Empty! Pumps locked out to prevent dry run.
            </Text>
          </View>
        )}

        {isDryRunActive && (
          <View style={[styles.alertBanner, styles.dryRunBanner]}>
            <Text style={styles.alertBannerText}>
              Dry run detected. Pumps forced OFF.
            </Text>
          </View>
        )}
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
  safetyCard: {
    width: "100%",
    backgroundColor: "#f8f9fb",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ecf0f1",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  safetyTitle: {
    fontSize: 12,
    color: "#7f8c8d",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  safetyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  safetyLabel: {
    flex: 1,
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "600",
  },
  safetyValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  dotCritical: {
    backgroundColor: "#e74c3c",
  },
  dotNormal: {
    backgroundColor: "#2ecc71",
  },
  valueCritical: {
    color: "#e74c3c",
  },
  valueNormal: {
    color: "#27ae60",
  },
  alertBanner: {
    width: "100%",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  lockoutBanner: {
    backgroundColor: "#fff1f0",
    borderWidth: 1,
    borderColor: "#ffb8b8",
  },
  dryRunBanner: {
    backgroundColor: "#fff4e5",
    borderWidth: 1,
    borderColor: "#ffd6a0",
  },
  alertBannerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
  },
});
