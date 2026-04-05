import { database } from "@/services/firebase";
import { onValue, ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function SettingsScreen() {
  const [tankDepth, setTankDepth] = useState<string>("");
  const [failoverTimer, setFailoverTimer] = useState<string>("");
  const [valve1Name, setValve1Name] = useState<string>("");
  const [valve2Name, setValve2Name] = useState<string>("");
  const [valve3Name, setValve3Name] = useState<string>("");
  const [valve4Name, setValve4Name] = useState<string>("");
  const [valve5Name, setValve5Name] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    const tankRef = ref(database, "tank_01");
    const unsubscribe = onValue(
      tankRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          console.warn("Firebase snapshot is empty for tank_01 settings");
          return;
        }

        const data = snapshot.val();
        if (data.total_depth_cm !== undefined) {
          setTankDepth(String(data.total_depth_cm));
        }
        if (data.auto_switch_minutes !== undefined) {
          setFailoverTimer(String(data.auto_switch_minutes));
        }
        if (data.valve_1_name !== undefined) {
          setValve1Name(String(data.valve_1_name));
        }
        if (data.valve_2_name !== undefined) {
          setValve2Name(String(data.valve_2_name));
        }
        if (data.valve_3_name !== undefined) {
          setValve3Name(String(data.valve_3_name));
        }
        if (data.valve_4_name !== undefined) {
          setValve4Name(String(data.valve_4_name));
        }
        if (data.valve_5_name !== undefined) {
          setValve5Name(String(data.valve_5_name));
        }
      },
      (error) => {
        console.error("Failed to load settings from Firebase:", error);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleSave = async (): Promise<void> => {
    const parsedDepth = Number(tankDepth);
    const parsedTimer = Number(failoverTimer);

    if (Number.isNaN(parsedDepth) || parsedDepth <= 0) {
      Alert.alert("Invalid input", "Please enter a valid tank depth.");
      return;
    }
    if (Number.isNaN(parsedTimer) || parsedTimer < 0) {
      Alert.alert(
        "Invalid input",
        "Please enter a valid auto-switch interval.",
      );
      return;
    }

    try {
      setIsSaving(true);
      const tankRef = ref(database, "tank_01");
      await update(tankRef, {
        total_depth_cm: parsedDepth,
        auto_switch_minutes: parsedTimer,
        valve_1_name: valve1Name.trim(),
        valve_2_name: valve2Name.trim(),
        valve_3_name: valve3Name.trim(),
        valve_4_name: valve4Name.trim(),
        valve_5_name: valve5Name.trim(),
      });
      Alert.alert("Saved", "Configuration updated in Firebase.");
    } catch (error) {
      Alert.alert("Save failed", "Unable to update configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Total Tank Depth (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 150"
          keyboardType="numeric"
          value={tankDepth}
          onChangeText={setTankDepth}
          maxLength={6}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Pump Auto-Switch Interval (minutes)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 1"
          keyboardType="numeric"
          value={failoverTimer}
          onChangeText={setFailoverTimer}
          maxLength={6}
        />
        <Text style={styles.helperText}>
          If Pump 1 stays ON for this duration, the controller should switch
          Pump 1 OFF and Pump 2 ON.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Valve Names</Text>

        <Text style={styles.label}>Valve 1 Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Admin Valve"
          value={valve1Name}
          onChangeText={setValve1Name}
          maxLength={30}
        />

        <Text style={styles.label}>Valve 2 Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Kitchen Valve"
          value={valve2Name}
          onChangeText={setValve2Name}
          maxLength={30}
        />

        <Text style={styles.label}>Valve 3 Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Bathroom Valve"
          value={valve3Name}
          onChangeText={setValve3Name}
          maxLength={30}
        />

        <Text style={styles.label}>Valve 4 Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Utility Valve"
          value={valve4Name}
          onChangeText={setValve4Name}
          maxLength={30}
        />

        <Text style={styles.label}>Valve 5 Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Main Outlet Valve"
          value={valve5Name}
          onChangeText={setValve5Name}
          maxLength={30}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.saveButtonPressed,
          isSaving && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? "Saving..." : "Save Configuration"}
        </Text>
      </Pressable>
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
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 40,
  },
  card: {
    width: "100%",
    backgroundColor: "#f8f9fb",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#ecf0f1",
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: "#7f8c8d",
    marginBottom: 10,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 6,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: "#8ea0b1",
    lineHeight: 18,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe6e9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    color: "#2c3e50",
  },
  saveButton: {
    width: "100%",
    backgroundColor: "#3498db",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonDisabled: {
    backgroundColor: "#95a5a6",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
