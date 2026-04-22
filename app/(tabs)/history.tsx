import { database } from "@/services/firebase";
import { onValue, ref } from "firebase/database";
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

const HISTORY_TIMEZONE = "Asia/Manila";
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type DailyHistoryData = {
  total_liters?: number;
  total_m3?: number;
};

function getDateKeyInTimezone(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HISTORY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_REGEX.test(value)) return false;

  const [year, month, day] = value.split("-").map((v) => Number(v));
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

function shiftDateKey(value: string, deltaDays: number): string {
  if (!isValidDateKey(value)) return value;

  const [year, month, day] = value.split("-").map((v) => Number(v));
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + deltaDays);

  const y = String(utcDate.getUTCFullYear()).padStart(4, "0");
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utcDate.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function parseDailyHistory(node: DailyHistoryData | null): {
  liters: number;
  cubicMeters: number;
  hasData: boolean;
} {
  if (!node) {
    return { liters: 0, cubicMeters: 0, hasData: false };
  }

  const liters = Number(node.total_liters ?? 0);
  const litersSafe = Number.isFinite(liters) ? liters : 0;

  const cubic = Number(node.total_m3 ?? litersSafe / 1000);
  const cubicSafe = Number.isFinite(cubic) ? cubic : litersSafe / 1000;

  return {
    liters: litersSafe,
    cubicMeters: cubicSafe,
    hasData: true,
  };
}

export default function HistoryScreen() {
  const [todayKey, setTodayKey] = useState<string>(() =>
    getDateKeyInTimezone(),
  );

  const [selectedDateInput, setSelectedDateInput] = useState<string>(() =>
    getDateKeyInTimezone(),
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    getDateKeyInTimezone(),
  );

  const [selectedLiters, setSelectedLiters] = useState<number>(0);
  const [selectedM3, setSelectedM3] = useState<number>(0);
  const [selectedHasData, setSelectedHasData] = useState<boolean>(false);

  const [todayLiters, setTodayLiters] = useState<number>(0);
  const [todayM3, setTodayM3] = useState<number>(0);
  const [todayHasData, setTodayHasData] = useState<boolean>(false);

  const [selectedLastUpdated, setSelectedLastUpdated] = useState<string>("--");
  const [todayLastUpdated, setTodayLastUpdated] = useState<string>("--");

  useEffect(() => {
    const timer = setInterval(() => {
      setTodayKey(getDateKeyInTimezone());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const selectedRef = ref(
      database,
      `tank_01/history/daily/${selectedDateKey}`,
    );

    const unsubscribe = onValue(
      selectedRef,
      (snapshot) => {
        const data = parseDailyHistory(snapshot.val());

        setSelectedLiters(data.liters);
        setSelectedM3(data.cubicMeters);
        setSelectedHasData(data.hasData);
        setSelectedLastUpdated(new Date().toLocaleTimeString());
      },
      (error) => {
        console.error("Firebase selected history onValue error:", error);
      },
    );

    return () => unsubscribe();
  }, [selectedDateKey]);

  useEffect(() => {
    const todayRef = ref(database, `tank_01/history/daily/${todayKey}`);

    const unsubscribe = onValue(
      todayRef,
      (snapshot) => {
        const data = parseDailyHistory(snapshot.val());

        setTodayLiters(data.liters);
        setTodayM3(data.cubicMeters);
        setTodayHasData(data.hasData);
        setTodayLastUpdated(new Date().toLocaleTimeString());
      },
      (error) => {
        console.error("Firebase today history onValue error:", error);
      },
    );

    return () => unsubscribe();
  }, [todayKey]);

  const applyDateFilter = (): void => {
    const trimmed = selectedDateInput.trim();

    if (!isValidDateKey(trimmed)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD (example: 2026-04-22).");
      return;
    }

    setSelectedDateKey(trimmed);
  };

  const goToToday = (): void => {
    setSelectedDateInput(todayKey);
    setSelectedDateKey(todayKey);
  };

  const goToPreviousDay = (): void => {
    const next = shiftDateKey(selectedDateKey, -1);
    setSelectedDateInput(next);
    setSelectedDateKey(next);
  };

  const goToNextDay = (): void => {
    const next = shiftDateKey(selectedDateKey, 1);
    setSelectedDateInput(next);
    setSelectedDateKey(next);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Water History</Text>
      <Text style={styles.headerSubtitle}>
        Daily consumption in cubic meters (m3)
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Date Filter</Text>
        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={selectedDateInput}
          onChangeText={setSelectedDateInput}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
        />

        <View style={styles.filterActionsRow}>
          <Pressable
            style={styles.actionBtnSecondary}
            onPress={goToPreviousDay}
          >
            <Text style={styles.actionBtnSecondaryText}>Prev</Text>
          </Pressable>

          <Pressable style={styles.actionBtnSecondary} onPress={goToToday}>
            <Text style={styles.actionBtnSecondaryText}>Today</Text>
          </Pressable>

          <Pressable style={styles.actionBtnSecondary} onPress={goToNextDay}>
            <Text style={styles.actionBtnSecondaryText}>Next</Text>
          </Pressable>
        </View>

        <Pressable style={styles.actionBtnPrimary} onPress={applyDateFilter}>
          <Text style={styles.actionBtnPrimaryText}>Apply Filter</Text>
        </Pressable>

        <Text style={styles.helperText}>Timezone: Asia/Manila (UTC+8)</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Selected Date Summary</Text>
        <Text style={styles.summaryDate}>{selectedDateKey}</Text>

        <Text style={styles.mainValue}>{selectedM3.toFixed(3)} m3</Text>
        <Text style={styles.subValue}>{selectedLiters.toFixed(1)} liters</Text>

        <Text style={styles.dataState}>
          {selectedHasData ? "Data found" : "No data for this date yet"}
        </Text>
        <Text style={styles.updatedText}>Updated: {selectedLastUpdated}</Text>
      </View>

      <View style={styles.cardRealtime}>
        <Text style={styles.sectionTitleRealtime}>Today (Realtime)</Text>
        <Text style={styles.summaryDateRealtime}>{todayKey}</Text>

        <Text style={styles.mainValueRealtime}>{todayM3.toFixed(3)} m3</Text>
        <Text style={styles.subValueRealtime}>
          {todayLiters.toFixed(1)} liters
        </Text>

        <Text style={styles.dataStateRealtime}>
          {todayHasData ? "Live counting" : "Waiting for flow data"}
        </Text>
        <Text style={styles.updatedTextRealtime}>
          Updated: {todayLastUpdated}
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
    paddingTop: 56,
    paddingBottom: 32,
    paddingHorizontal: 22,
    gap: 14,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1f2d3d",
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#7b8a97",
  },
  card: {
    backgroundColor: "#f8f9fb",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ecf0f1",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardRealtime: {
    backgroundColor: "#eef6ff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9ebff",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 10,
  },
  sectionTitleRealtime: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2b537c",
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: "#7f8c8d",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe6e9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#2c3e50",
  },
  filterActionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  actionBtnPrimary: {
    marginTop: 10,
    backgroundColor: "#3498db",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnPrimaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dfe6e9",
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnSecondaryText: {
    color: "#2c3e50",
    fontWeight: "600",
    fontSize: 13,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: "#8ea0b1",
  },
  summaryDate: {
    fontSize: 14,
    color: "#5f7184",
    marginBottom: 8,
  },
  summaryDateRealtime: {
    fontSize: 14,
    color: "#4b6f94",
    marginBottom: 8,
  },
  mainValue: {
    fontSize: 34,
    fontWeight: "800",
    color: "#2c3e50",
  },
  mainValueRealtime: {
    fontSize: 34,
    fontWeight: "800",
    color: "#24517e",
  },
  subValue: {
    marginTop: 2,
    fontSize: 15,
    color: "#6c7d8f",
  },
  subValueRealtime: {
    marginTop: 2,
    fontSize: 15,
    color: "#4b6f94",
  },
  dataState: {
    marginTop: 10,
    fontSize: 12,
    color: "#7b8a97",
  },
  dataStateRealtime: {
    marginTop: 10,
    fontSize: 12,
    color: "#4f76a0",
  },
  updatedText: {
    marginTop: 4,
    fontSize: 12,
    color: "#8ea0b1",
  },
  updatedTextRealtime: {
    marginTop: 4,
    fontSize: 12,
    color: "#4f76a0",
  },
});
