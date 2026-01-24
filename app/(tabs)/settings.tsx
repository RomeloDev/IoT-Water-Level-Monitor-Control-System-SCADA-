import { database } from "@/services/firebase";
import { onValue, ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function SettingsScreen() {
  const [tankDepth, setTankDepth] = useState<string>("");
  const [failoverTimer, setFailoverTimer] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    const tankRef = ref(database, "tank_01");
    const unsubscribe = onValue(
      tankRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.total_depth_cm !== undefined) {
            setTankDepth(String(data.total_depth_cm));
          }
          if (data.auto_switch_minutes !== undefined) {
            setFailoverTimer(String(data.auto_switch_minutes));
          }
        }
      },
      (error) => {
        console.warn("Failed to load settings from Firebase:", error);
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
      Alert.alert("Invalid input", "Please enter a valid failover timer.");
      return;
    }

    try {
      setIsSaving(true);
      const tankRef = ref(database, "tank_01");
      await update(tankRef, {
        total_depth_cm: parsedDepth,
        auto_switch_minutes: parsedTimer,
      });
      Alert.alert("Saved", "Configuration updated in Firebase.");
    } catch (error) {
      Alert.alert("Save failed", "Unable to update configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
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
        <Text style={styles.label}>Failover Timer (minutes)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 30"
          keyboardType="numeric"
          value={failoverTimer}
          onChangeText={setFailoverTimer}
          maxLength={6}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
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
