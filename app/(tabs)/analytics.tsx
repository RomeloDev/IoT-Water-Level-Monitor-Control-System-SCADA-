import { database } from "@/services/firebase";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function AnalyticsScreen() {
  const [pressureMpa, setPressureMpa] = useState<number>(0);
  const [flowRateLmin, setFlowRateLmin] = useState<number>(0);
  const [totalFlowL, setTotalFlowL] = useState<number>(0);
  const [hasPressureData, setHasPressureData] = useState<boolean>(false);
  const [hasFlowRateData, setHasFlowRateData] = useState<boolean>(false);
  const [hasTotalFlowData, setHasTotalFlowData] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>("--");

  useEffect(() => {
    const tankRef = ref(database, "tank_01");

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

        setHasPressureData(hasPressure);
        setHasFlowRateData(hasFlowRate);
        setHasTotalFlowData(hasTotalFlow);
        setPressureMpa(hasPressure ? Number(data.pressure_mpa) : 0);
        setFlowRateLmin(hasFlowRate ? Number(data.flow_rate_lmin) : 0);
        setTotalFlowL(hasTotalFlow ? Number(data.total_flow_l) : 0);
        setLastUpdated(new Date().toLocaleTimeString());
      },
      (error) => {
        console.error("Firebase analytics onValue error:", error);
      },
    );

    return () => unsubscribe();
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
