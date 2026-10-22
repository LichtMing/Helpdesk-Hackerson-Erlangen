import { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { createSpeechToText } from "./lib/speechToText";
import type { SpeechLanguage } from "./lib/speechTypes";
import { sendTranscript } from "./lib/transcriptApi";

export default function App() {
  const speechToText = useMemo(() => createSpeechToText(), []);
  const [baseUrl, setBaseUrl] = useState("http://10.0.2.2:3000");
  const [deviceId, setDeviceId] = useState("robot-001");
  const [mac, setMac] = useState("AA:BB:CC:DD:EE:FF");
  const [language, setLanguage] = useState<SpeechLanguage>("auto");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");

  useEffect(() => () => {
    void speechToText.release();
  }, [speechToText]);

  const startRecording = async () => {
    setBusy(true);
    setStatus("Loading local Whisper model…");
    try {
      await speechToText.start();
      setRecording(true);
      setStatus("Recording — ask the question, then press Stop");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = async () => {
    setBusy(true);
    setStatus("Transcribing locally on the robot…");
    try {
      const text = await speechToText.stop(language);
      setTranscript(text);
      setRecording(false);
      setStatus("Transcription ready; review it before sending");
    } catch (error) {
      setRecording(false);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const transmit = async () => {
    setBusy(true);
    setStatus("Sending text to ACU…");
    try {
      const receipt = await sendTranscript({
        baseUrl,
        deviceId,
        mac,
        text: transcript,
        language,
      });
      setStatus(`ACU confirmed exact text at ${receipt.receivedAt}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Robot voice input → ACU</Text>
        <Text style={styles.subtitle}>Offline Whisper transcription and API transport check</Text>

        <View style={styles.row}>
          <Field label="ACU URL" value={baseUrl} onChangeText={setBaseUrl} />
          <Field label="Device ID" value={deviceId} onChangeText={setDeviceId} />
          <Field label="MAC" value={mac} onChangeText={setMac} />
        </View>

        <View style={styles.languageRow}>
          <Text style={styles.label}>Language</Text>
          {(["auto", "en", "de", "zh"] as const).map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, language === value && styles.chipSelected]}
              onPress={() => setLanguage(value)}
              disabled={busy || recording}
            >
              <Text style={styles.chipText}>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            label={recording ? "Stop & transcribe" : "Start recording"}
            onPress={recording ? stopRecording : startRecording}
            disabled={busy}
            danger={recording}
          />
          <Button
            label="Send text to ACU"
            onPress={transmit}
            disabled={busy || recording || !transcript.trim()}
          />
        </View>

        <Text style={styles.label}>Recognized text (editable)</Text>
        <TextInput
          style={styles.transcript}
          multiline
          value={transcript}
          onChangeText={setTranscript}
          placeholder="The local transcript will appear here"
        />
        <Text style={styles.status}>{status}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        autoCapitalize="none"
      />
    </View>
  );
}

function Button(props: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        props.danger && styles.dangerButton,
        props.disabled && styles.disabledButton,
      ]}
      onPress={props.onPress}
      disabled={props.disabled}
    >
      <Text style={styles.buttonText}>{props.label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#07191b" },
  container: { padding: 28, gap: 18 },
  title: { color: "#ffffff", fontSize: 32, fontWeight: "700" },
  subtitle: { color: "#75d5d0", fontSize: 17 },
  row: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  field: { flex: 1, minWidth: 210, gap: 6 },
  label: { color: "#b9cecf", fontSize: 14, fontWeight: "600" },
  input: {
    color: "#ffffff",
    backgroundColor: "#102a2d",
    borderColor: "#287d7d",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  languageRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: { backgroundColor: "#254043", borderRadius: 16, paddingHorizontal: 15, paddingVertical: 8 },
  chipSelected: { backgroundColor: "#008c95" },
  chipText: { color: "#ffffff", fontWeight: "700" },
  actions: { flexDirection: "row", gap: 14 },
  button: { backgroundColor: "#008c95", borderRadius: 8, paddingHorizontal: 22, paddingVertical: 14 },
  dangerButton: { backgroundColor: "#d56a16" },
  disabledButton: { opacity: 0.45 },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  transcript: {
    minHeight: 140,
    color: "#ffffff",
    backgroundColor: "#102a2d",
    borderColor: "#287d7d",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    textAlignVertical: "top",
    fontSize: 18,
  },
  status: { color: "#f0a050", fontSize: 16 },
});

