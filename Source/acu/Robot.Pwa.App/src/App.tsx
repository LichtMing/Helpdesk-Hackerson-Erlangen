import { useEffect, useMemo, useRef, useState } from "react";
import {
  createSessionId,
  resetConversation,
  sendChat,
  synthesizeSpeech,
} from "./lib/conversationApi";
import { playWaveResponse } from "./lib/responsePlayer";
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
import type { SpeechLanguage, SpeechState } from "./lib/speechTypes";

const stateLabels: Record<SpeechState, string> = {
  initializing: "Loading local speech models",
  listening: "Listening — speak naturally",
  "speech-detected": "Patient is speaking",
  transcribing: "Transcribing locally on the robot",
  delivering: "Sending recognized text to ACU",
  stopped: "Listening stopped",
};

export default function App() {
  const speechToText = useMemo(() => createSpeechToText(), []);
  const [baseUrl, setBaseUrl] = useState("http://10.0.2.2:3000");
  const [deviceId, setDeviceId] = useState("robot-001");
  const [mac, setMac] = useState("AA:BB:CC:DD:EE:FF");
  const [language, setLanguage] = useState<SpeechLanguage>("auto");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<SpeechState>("initializing");
  const [message, setMessage] = useState("Starting hands-free conversation mode…");
  const sessionId = useRef(createSessionId());
  const settings = useRef({ baseUrl, deviceId, mac, language });

  useEffect(() => {
    settings.current = { baseUrl, deviceId, mac, language };
  }, [baseUrl, deviceId, mac, language]);

  useEffect(() => {
    let mounted = true;

    void speechToText.start({
      getLanguage: () => settings.current.language,
      onStateChange: (state) => {
        if (mounted) setPhase(state);
      },
      onTranscript: async (text) => {
        if (!mounted) return;
        setTranscript(text);
        setMessage("Speech recognized; waiting for the ACU answer…");
        const current = settings.current;
        const reply = await sendChat({
          baseUrl: current.baseUrl,
          deviceId: current.deviceId,
          mac: current.mac,
          sessionId: sessionId.current,
          text,
          language: current.language,
        });
        if (!mounted) return;
        setAnswer(reply.answer);
        setMessage(reply.isMock
          ? "Development response received; generating local speech…"
          : "ACU answer received; generating local speech…");

        const audio = await synthesizeSpeech(current, reply.answer, reply.language);
        if (!mounted) return;
        setMessage("The robot is speaking. Listening is paused to prevent echo.");
        await playWaveResponse(audio, reply.requestId);
        if (mounted) setMessage("Answer delivered; resuming hands-free listening.");
      },
      onError: (error) => {
        if (mounted) setMessage(error.message);
      },
    }).catch((error: unknown) => {
      if (mounted) {
        setPhase("stopped");
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      mounted = false;
      void speechToText.release();
      void resetConversation(settings.current, sessionId.current).catch(() => {
        // The server-side idle timeout remains the fallback if shutdown interrupts reset.
      });
    };
  }, [speechToText]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headingRow}>
          <View>
            <Text style={styles.title}>Hands-free patient conversation</Text>
            <Text style={styles.subtitle}>Local VAD + Whisper → ACU text API</Text>
          </View>
          <View style={[styles.indicator, indicatorStyle(phase)]} />
        </View>

        <View style={styles.statePanel}>
          <Text style={styles.state}>{stateLabels[phase]}</Text>
          <Text style={styles.hint}>
            No start/stop button is needed. After a short pause, the robot automatically transcribes and sends the sentence.
          </Text>
        </View>

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
            >
              <Text style={styles.chipText}>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Last recognized sentence</Text>
        <View style={styles.transcriptPanel}>
          <Text style={styles.transcript}>
            {transcript || "Waiting for the patient to speak…"}
          </Text>
        </View>
        <Text style={styles.label}>Last ACU answer</Text>
        <View style={styles.answerPanel}>
          <Text style={styles.transcript}>
            {answer || "Waiting for an ACU answer…"}
          </Text>
        </View>
        <Text style={styles.message}>{message}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function indicatorStyle(phase: SpeechState) {
  if (phase === "listening") return styles.indicatorListening;
  if (phase === "speech-detected") return styles.indicatorSpeaking;
  if (phase === "stopped") return styles.indicatorStopped;
  return styles.indicatorBusy;
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#07191b" },
  container: { padding: 28, gap: 18 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#ffffff", fontSize: 32, fontWeight: "700" },
  subtitle: { color: "#75d5d0", fontSize: 17, marginTop: 6 },
  indicator: { width: 22, height: 22, borderRadius: 11 },
  indicatorListening: { backgroundColor: "#29c781" },
  indicatorSpeaking: { backgroundColor: "#f0a050" },
  indicatorBusy: { backgroundColor: "#41a9e0" },
  indicatorStopped: { backgroundColor: "#d94d55" },
  statePanel: { backgroundColor: "#102a2d", borderRadius: 10, padding: 18, gap: 8 },
  state: { color: "#ffffff", fontSize: 22, fontWeight: "700" },
  hint: { color: "#b9cecf", fontSize: 15, lineHeight: 21 },
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
  transcriptPanel: {
    minHeight: 140,
    backgroundColor: "#102a2d",
    borderColor: "#287d7d",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  answerPanel: {
    minHeight: 140,
    backgroundColor: "#0d3034",
    borderColor: "#00a7ad",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  transcript: { color: "#ffffff", fontSize: 20, lineHeight: 28 },
  message: { color: "#f0a050", fontSize: 16 },
});
