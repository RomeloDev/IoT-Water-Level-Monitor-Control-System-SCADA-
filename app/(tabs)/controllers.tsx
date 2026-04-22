import { database } from "@/services/firebase";
import { onValue, ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";

type ControlKey =
  | "pump_1_status"
  | "pump_2_status"
  | "valve_1_status"
  | "valve_2_status"
  | "valve_3_status"
  | "valve_4_status"
  | "valve_5_status";

export default function ControllersScreen() {
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

  useEffect(() => {
    const tankRef = ref(database, "tank_01");
    const unsubscribe = onValue(
      tankRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          console.warn("Firebase snapshot is empty for tank_01 controllers");
          return;
        }

        setPump1(data.pump_1_status ?? false);
        setPump2(data.pump_2_status ?? false);
        setValve1(data.valve_1_status ?? false);
        setValve2(data.valve_2_status ?? false);
        setValve3(data.valve_3_status ?? false);
        setValve4(data.valve_4_status ?? false);
        setValve5(data.valve_5_status ?? false);

        const name1 = String(data.valve_1_name ?? "").trim();
        const name2 = String(data.valve_2_name ?? "").trim();
        const name3 = String(data.valve_3_name ?? "").trim();
        const name4 = String(data.valve_4_name ?? "").trim();
        const name5 = String(data.valve_5_name ?? "").trim();

        setValve1Name(name1.length > 0 ? name1 : "Valve 1");
        setValve2Name(name2.length > 0 ? name2 : "Valve 2");
        setValve3Name(name3.length > 0 ? name3 : "Valve 3");
        setValve4Name(name4.length > 0 ? name4 : "Valve 4");
        setValve5Name(name5.length > 0 ? name5 : "Valve 5");
      },
      (error) => {
        console.error("Firebase controllers onValue error:", error);
      },
    );

    return () => unsubscribe();
  }, []);

  const toggleControl = (key: ControlKey, currentVal: boolean) => {
    const tankRef = ref(database, "tank_01");
    update(tankRef, { [key]: !currentVal });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Controllers</Text>

      <View style={styles.controlsCard}>
        <Text style={styles.controlsTitle}>Manual Pump Control</Text>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Pump 1</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#3498db" }}
            thumbColor={pump1 ? "#fff" : "#f4f3f4"}
            onValueChange={() => toggleControl("pump_1_status", pump1)}
            value={pump1}
          />
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Pump 2</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#3498db" }}
            thumbColor={pump2 ? "#fff" : "#f4f3f4"}
            onValueChange={() => toggleControl("pump_2_status", pump2)}
            value={pump2}
          />
        </View>
      </View>

      <View style={styles.controlsCard}>
        <Text style={styles.controlsTitle}>Valve Controls</Text>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>{valve1Name}</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#3498db" }}
            thumbColor={valve1 ? "#fff" : "#f4f3f4"}
            onValueChange={() => toggleControl("valve_1_status", valve1)}
            value={valve1}
          />
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>{valve2Name}</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#3498db" }}
            thumbColor={valve2 ? "#fff" : "#f4f3f4"}
            onValueChange={() => toggleControl("valve_2_status", valve2)}
            value={valve2}
          />
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>{valve3Name}</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#3498db" }}
            thumbColor={valve3 ? "#fff" : "#f4f3f4"}
            onValueChange={() => toggleControl("valve_3_status", valve3)}
            value={valve3}
          />
        </View>

        {/* <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>{valve4Name}</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#3498db" }}
            thumbColor={valve4 ? "#fff" : "#f4f3f4"}
            onValueChange={() => toggleControl("valve_4_status", valve4)}
            value={valve4}
          />
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>{valve5Name}</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#3498db" }}
            thumbColor={valve5 ? "#fff" : "#f4f3f4"}
            onValueChange={() => toggleControl("valve_5_status", valve5)}
            value={valve5}
          />
        </View> */}

        {/* <Text style={styles.valveHint}>
          Valves 1-4 are NC: ON = OPEN. Valve 5 is NO: ON = CLOSED.
        </Text> */}
        <Text style={styles.valveHint}>
         All Valves 1-3 are NC: ON = OPEN. .
        </Text>
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
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 30,
    paddingHorizontal: 22,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1f2d3d",
    marginBottom: 24,
  },
  controlsCard: {
    width: "100%",
    backgroundColor: "#f8f9fb",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ecf0f1",
    marginBottom: 16,
  },
  controlsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 15,
    textAlign: "center",
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  controlLabel: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "500",
    flex: 1,
    marginRight: 10,
  },
  valveHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#8ea0b1",
    lineHeight: 18,
  },
});
