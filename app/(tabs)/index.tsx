import { database } from "@/services/firebase";
import { onValue, ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View, ScrollView } from "react-native"; // <--- Import ScrollView
import CircularProgress from "react-native-circular-progress-indicator";

export default function DashboardScreen() {
  const [waterLevel, setWaterLevel] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [tankDepth, setTankDepth] = useState<number>(0);
  const [pump1, setPump1] = useState<boolean>(false);
  const [pump2, setPump2] = useState<boolean>(false);

  useEffect(() => {
    const tankRef = ref(database, "tank_01");
    const unsubscribe = onValue(tankRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const distanceCm = data.distance_cm ?? 0;
        const totalDepth = data.total_depth_cm ?? 0;
        const p1 = data.pump_1_status ?? false;
        const p2 = data.pump_2_status ?? false;

        const percentage =
          totalDepth > 0 ? ((totalDepth - distanceCm) / totalDepth) * 100 : 0;

        setTankDepth(totalDepth);
        setDistance(distanceCm);
        setWaterLevel(Math.max(0, Math.min(100, Math.round(percentage))));
        setPump1(p1);
        setPump2(p2);
      }
    });
    return () => unsubscribe();
  }, []);

  const togglePump = (pumpKey: "pump_1_status" | "pump_2_status", currentVal: boolean) => {
    const tankRef = ref(database, "tank_01");
    update(tankRef, { [pumpKey]: !currentVal });
  };

  const waterHeight = tankDepth > 0 ? Math.max(0, tankDepth - distance) : 0;

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
        <Text style={styles.label}>Current Water Level:</Text>
        <Text style={styles.value}>
          {tankDepth > 0 ? `${waterHeight} cm` : "--"}
        </Text>
        <Text style={{ fontSize: 12, color: "#bdc3c7", marginBottom: 20 }}>
          (Sensor Distance: {distance} cm | Total Depth: {tankDepth} cm)
        </Text>

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
              onValueChange={() => togglePump("pump_1_status", pump1)}
              value={pump1}
            />
          </View>

          <View style={styles.pumpRow}>
            <Text style={styles.pumpLabel}>Pump 2</Text>
            <Switch
              trackColor={{ false: "#767577", true: "#3498db" }}
              thumbColor={pump2 ? "#fff" : "#f4f3f4"}
              onValueChange={() => togglePump("pump_2_status", pump2)}
              value={pump2}
            />
          </View>
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
});