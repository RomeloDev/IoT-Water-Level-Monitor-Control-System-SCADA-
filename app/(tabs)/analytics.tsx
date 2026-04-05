import { database } from "@/services/firebase";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Notifications from "expo-notifications";
import { onValue, ref, update } from "firebase/database";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const MAX_SAFE_AMPS = 12.0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function AnalyticsScreen() {
  const [pressureMpa, setPressureMpa] = useState<number>(0);
  const [flowRateLmin, setFlowRateLmin] = useState<number>(0);
  const [totalFlowL, setTotalFlowL] = useState<number>(0);
  const [currentAmps1, setCurrentAmps1] = useState<number>(0);
  const [currentAmps2, setCurrentAmps2] = useState<number>(0);
  const [hasPressureData, setHasPressureData] = useState<boolean>(false);
  const [hasFlowRateData, setHasFlowRateData] = useState<boolean>(false);
  const [hasTotalFlowData, setHasTotalFlowData] = useState<boolean>(false);
  const [hasCurrent1Data, setHasCurrent1Data] = useState<boolean>(false);
  const [hasCurrent2Data, setHasCurrent2Data] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>("--");
  const emergencyAlarmPlayer = useAudioPlayer(
    require("../../assets/alarm.mp3"),
  );
  const emergencyAlarmPlayingRef = useRef<boolean>(false);
  const pump1TripNotifiedRef = useRef<boolean>(false);
  const pump2TripNotifiedRef = useRef<boolean>(false);
  const hasNotificationPermissionRef = useRef<boolean>(false);

  useEffect(() => {
    const requestNotificationPermission = async (): Promise<void> => {
      try {
        const { status, granted } =
          await Notifications.requestPermissionsAsync();
        hasNotificationPermissionRef.current = granted || status === "granted";
      } catch (error) {
        console.error("Failed to request notification permission:", error);
      }
    };

    void requestNotificationPermission();

    const tankRef = ref(database, "tank_01");

    const startEmergencyAlarm = async (): Promise<void> => {
      if (emergencyAlarmPlayingRef.current) return;

      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
        });

        emergencyAlarmPlayer.loop = true;
        emergencyAlarmPlayer.volume = 1;
        emergencyAlarmPlayer.play();
        emergencyAlarmPlayingRef.current = true;
      } catch (error) {
        console.error("Failed to play emergency alarm:", error);
      }
    };

    const stopEmergencyAlarm = (): void => {
      if (!emergencyAlarmPlayingRef.current) return;
      emergencyAlarmPlayer.pause();
      emergencyAlarmPlayer.seekTo(0);
      emergencyAlarmPlayingRef.current = false;
    };

    const notifyAndShutdownPump = async (
      pumpNumber: 1 | 2,
      currentAmps: number,
    ): Promise<void> => {
      try {
        if (hasNotificationPermissionRef.current) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⚠️ EMERGENCY SHUTDOWN: PUMP ${pumpNumber}`,
              body: `Pump ${pumpNumber} current reached ${currentAmps.toFixed(2)} A and exceeded ${MAX_SAFE_AMPS.toFixed(1)} A. Pump turned OFF automatically.`,
            },
            trigger: null,
          });
        }

        await update(tankRef, {
          [`pump_${pumpNumber}_status`]: false,
        });
      } catch (error) {
        console.error(
          `Emergency shutdown failed for pump ${pumpNumber}:`,
          error,
        );
      }
    };

    const evaluateSafety = (
      amps1: number,
      amps2: number,
      pump1Status: boolean,
      pump2Status: boolean,
    ): void => {
      const pump1Overcurrent = pump1Status && amps1 > MAX_SAFE_AMPS;
      const pump2Overcurrent = pump2Status && amps2 > MAX_SAFE_AMPS;
      const anyOvercurrent = pump1Overcurrent || pump2Overcurrent;

      if (anyOvercurrent) {
        void startEmergencyAlarm();
      } else {
        stopEmergencyAlarm();
      }

      if (pump1Overcurrent && !pump1TripNotifiedRef.current) {
        pump1TripNotifiedRef.current = true;
        void notifyAndShutdownPump(1, amps1);
      } else if (!pump1Overcurrent) {
        pump1TripNotifiedRef.current = false;
      }

      if (pump2Overcurrent && !pump2TripNotifiedRef.current) {
        pump2TripNotifiedRef.current = true;
        void notifyAndShutdownPump(2, amps2);
      } else if (!pump2Overcurrent) {
        pump2TripNotifiedRef.current = false;
      }
    };

    const unsubscribe = onValue(
      tankRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          console.warn("Firebase snapshot is empty for tank_01 analytics");
          return;
        }

        const hasPressure = data.pressure_mpa !== undefined;
        const hasFlowRate = data.flow_rate_lmin !== undefined;
        const hasTotalFlow = data.total_flow_l !== undefined;
        const hasCurrent1 = data.current_amps_1 !== undefined;
        const hasCurrent2 = data.current_amps_2 !== undefined;

        const pump1Status = data.pump_1_status ?? false;
        const pump2Status = data.pump_2_status ?? false;

        const amps1 = hasCurrent1 ? Number(data.current_amps_1) : 0;
        const amps2 = hasCurrent2 ? Number(data.current_amps_2) : 0;

        setHasPressureData(hasPressure);
        setHasFlowRateData(hasFlowRate);
        setHasTotalFlowData(hasTotalFlow);
        setHasCurrent1Data(hasCurrent1);
        setHasCurrent2Data(hasCurrent2);
        setPressureMpa(hasPressure ? Number(data.pressure_mpa) : 0);
        setFlowRateLmin(hasFlowRate ? Number(data.flow_rate_lmin) : 0);
        setTotalFlowL(hasTotalFlow ? Number(data.total_flow_l) : 0);
        setCurrentAmps1(amps1);
        setCurrentAmps2(amps2);
        setLastUpdated(new Date().toLocaleTimeString());

        evaluateSafety(amps1, amps2, pump1Status, pump2Status);
      },
      (error) => {
        console.error("Firebase analytics onValue error:", error);
      },
    );

    return () => {
      unsubscribe();
      stopEmergencyAlarm();
      emergencyAlarmPlayer.remove();
    };
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Sensor Analytics</Text>
      <Text style={styles.headerSubtitle}>Live hydraulic telemetry</Text>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pressure</Text>
          <Text style={styles.metricValue}>
            {hasPressureData
              ? `${pressureMpa.toFixed(3)} MPa`
              : "No sensor yet"}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Real-time Flow Rate</Text>
          <Text style={styles.metricValue}>
            {hasFlowRateData
              ? `${flowRateLmin.toFixed(2)} L/min`
              : "No sensor yet"}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Volume Pumped</Text>
          <Text style={styles.metricValue}>
            {hasTotalFlowData ? `${totalFlowL.toFixed(1)} L` : "No sensor yet"}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Motor Currents</Text>

          <View style={styles.currentRow}>
            <Text style={styles.currentLabel}>Pump 1</Text>
            <Text
              style={[
                styles.currentValue,
                {
                  color:
                    hasCurrent1Data && currentAmps1 > MAX_SAFE_AMPS
                      ? "#e74c3c"
                      : "#27ae60",
                },
              ]}
            >
              {hasCurrent1Data
                ? `${currentAmps1.toFixed(2)} A`
                : "No sensor yet"}
            </Text>
          </View>

          <View style={styles.currentRow}>
            <Text style={styles.currentLabel}>Pump 2</Text>
            <Text
              style={[
                styles.currentValue,
                {
                  color:
                    hasCurrent2Data && currentAmps2 > MAX_SAFE_AMPS
                      ? "#e74c3c"
                      : "#27ae60",
                },
              ]}
            >
              {hasCurrent2Data
                ? `${currentAmps2.toFixed(2)} A`
                : "No sensor yet"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footerCard}>
        <Text style={styles.footerLabel}>Last updated</Text>
        <Text style={styles.footerValue}>{lastUpdated}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    paddingTop: 56,
    paddingBottom: 30,
    paddingHorizontal: 22,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1f2d3d",
  },
  headerSubtitle: {
    marginTop: 6,
    marginBottom: 24,
    fontSize: 14,
    color: "#7b8a97",
  },
  metricsGrid: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: "#f8f9fb",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ecf0f1",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  metricLabel: {
    fontSize: 12,
    color: "#7f8c8d",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 25,
    fontWeight: "700",
    color: "#2c3e50",
  },
  currentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  currentLabel: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "600",
  },
  currentValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  footerCard: {
    marginTop: 14,
    backgroundColor: "#eef6ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d9ebff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footerLabel: {
    fontSize: 12,
    color: "#6283a6",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 18,
    color: "#2c3e50",
    fontWeight: "600",
  },
});
