/**
 * PatientScreen – patient-facing conversation screen (React Native version of the team's
 * "CT Patient Prep Assistant" web design). Rendering only; speech and network logic stay
 * in App.tsx. Staff access: long-press the header to open the robot setup.
 */
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { SpeechState } from "./lib/speechTypes";

export type ChatMessage = { id: string; role: "patient" | "assistant"; text: string };

export interface PatientScreenProps {
  phase: SpeechState;
  isSpeaking: boolean;
  messages: ChatMessage[];
  helpRequested: boolean;
  onRequestHelp(): void;
  onStaffSetup?(): void;
  notice?: string;
}

const C = {
  teal: "#00897b", tealDark: "#00695c", tealLight: "#41b6c4", mint: "#80cbc4",
  ink: "#0b1f3a", inkSoft: "#4f6785", bubblePatient: "#e6f4f3", bubbleAssistant: "#f4fbf9",
  bubbleBorder: "#b2dfdb", white: "#ffffff", red: "#c62828", redLight: "#ef5350",
  emergencyBg: "#4b1c1c", emergencyHeader: "#992828",
};

const WELCOME =
  "Hello! I’m your CT preparation assistant. Just ask me anything about your scan, " +
  "for example how long it takes or how to prepare.";

function statusLabel(phase: SpeechState, isSpeaking: boolean, helpRequested: boolean): string {
  if (helpRequested) return "A staff member is on the way";
  if (isSpeaking) return "Speaking…";
  switch (phase) {
    case "initializing": return "Getting ready…";
    case "listening": return "I’m listening, just speak";
    case "speech-detected": return "I’m listening…";
    case "transcribing":
    case "delivering": return "Let me think…";
    default: return "Paused";
  }
}

export default function PatientScreen(props: PatientScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const listening = !props.helpRequested && !props.isSpeaking &&
    (props.phase === "listening" || props.phase === "speech-detected");

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [props.messages.length]);

  const background = props.helpRequested
    ? ([C.emergencyBg, C.emergencyBg] as const)
    : (["#f7fbff", "#e6f7ff"] as const);

  return (
    <LinearGradient colors={background} style={styles.root}>
      <Pressable
        onLongPress={props.onStaffSetup}
        delayLongPress={1500}
        accessibilityRole="header"
        style={[styles.header, props.helpRequested && { backgroundColor: C.emergencyHeader }]}
      >
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>CT Patient Prep Assistant</Text>
          <Text style={styles.headerSubtitle}>Ask me anything about your scan</Text>
        </View>
        <Mascot />
      </Pressable>

      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent}>
        <Bubble role="assistant" text={WELCOME} />
        {props.messages.map((m) => <Bubble key={m.id} role={m.role} text={m.text} />)}
      </ScrollView>

      <View style={styles.statusCard}>
        <PulseDots active={listening} />
        <View style={styles.statusTextBox}>
          <Text style={styles.statusText}>{statusLabel(props.phase, props.isSpeaking, props.helpRequested)}</Text>
          {props.notice ? <Text style={styles.notice}>{props.notice}</Text> : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Call staff for help"
        disabled={props.helpRequested}
        onPress={props.onRequestHelp}
        style={({ pressed }) => [styles.emergencyWrap, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <LinearGradient
          colors={props.helpRequested ? [C.emergencyHeader, C.emergencyHeader] : [C.red, C.redLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emergencyButton}
        >
          <Text style={styles.emergencyText}>{props.helpRequested ? "Help is on the way" : "I need help"}</Text>
        </LinearGradient>
      </Pressable>
    </LinearGradient>
  );
}

function Bubble(props: { role: ChatMessage["role"]; text: string }) {
  const patient = props.role === "patient";
  return (
    <View style={[styles.bubble, patient ? styles.bubblePatient : styles.bubbleAssistant]}>
      <Text style={styles.bubbleText}>{props.text}</Text>
    </View>
  );
}

function Mascot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.06, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <Animated.View style={[styles.mascot, { transform: [{ scale }] }]}>
      <View style={styles.eyesRow}><View style={styles.eye} /><View style={styles.eye} /></View>
      <View style={styles.smile} />
    </Animated.View>
  );
}

function PulseDots(props: { active: boolean }) {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    if (!props.active) {
      values.forEach((v) => v.setValue(0.4));
      return;
    }
    const loops = values.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 300),
      Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [props.active, values]);
  const sizes = [20, 30, 40];
  const colors = [C.teal, C.tealLight, C.mint];
  return (
    <View style={styles.dotsRow}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: sizes[i], height: sizes[i], borderRadius: sizes[i] / 2, backgroundColor: colors[i],
            opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0.4, 1], outputRange: [0.85, 1.05] }) }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: C.teal, paddingHorizontal: 36, paddingVertical: 24, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", elevation: 6,
  },
  headerText: { flexShrink: 1, paddingRight: 24 },
  headerTitle: { color: C.white, fontSize: 34, fontWeight: "800" },
  headerSubtitle: { color: "#e0f2f1", fontSize: 22, marginTop: 6 },
  mascot: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: C.white, borderWidth: 6,
    borderColor: C.tealLight, alignItems: "center", justifyContent: "center",
  },
  eyesRow: { flexDirection: "row", gap: 26, marginTop: -6 },
  eye: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#004d40" },
  smile: {
    width: 40, height: 18, marginTop: 10, borderWidth: 4, borderTopWidth: 0, borderColor: "#004d40",
    borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
  },
  chat: { flex: 1 },
  chatContent: { padding: 32, gap: 20 },
  bubble: { paddingHorizontal: 28, paddingVertical: 22, maxWidth: "85%" },
  bubbleAssistant: {
    alignSelf: "flex-start", backgroundColor: C.bubbleAssistant, borderColor: C.bubbleBorder, borderWidth: 1,
    borderTopLeftRadius: 6, borderTopRightRadius: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  bubblePatient: {
    alignSelf: "flex-end", backgroundColor: C.bubblePatient,
    borderTopLeftRadius: 24, borderTopRightRadius: 6, borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  bubbleText: { color: C.ink, fontSize: 28, lineHeight: 40 },
  statusCard: {
    marginHorizontal: 32, marginBottom: 20, backgroundColor: C.white, borderRadius: 28,
    paddingHorizontal: 32, paddingVertical: 22, flexDirection: "row", alignItems: "center", gap: 24, elevation: 3,
  },
  dotsRow: { flexDirection: "row", alignItems: "center", gap: 8, width: 120 },
  statusTextBox: { flex: 1 },
  statusText: { color: C.tealDark, fontSize: 30, fontWeight: "700" },
  notice: { color: C.inkSoft, fontSize: 20, marginTop: 6 },
  emergencyWrap: { marginHorizontal: 32, marginBottom: 32 },
  emergencyButton: { borderRadius: 28, paddingVertical: 30, alignItems: "center", elevation: 4 },
  emergencyText: { color: C.white, fontSize: 30, fontWeight: "700" },
});
