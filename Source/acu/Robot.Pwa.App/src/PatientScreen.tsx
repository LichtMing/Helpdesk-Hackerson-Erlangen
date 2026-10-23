/**
 * PatientScreen – React Native version of the team's "CT Patient Prep Assistant" design:
 * teal Siemens Healthineers header with the giraffe and "Hi! / Relax / Breathe" bubbles,
 * floating bubbles, a Hello card, Start and Emergency Call buttons, the Assistant Response
 * chat card, a "Listening..." overlay and two friendly CT characters at the bottom.
 * Rendering only; speech and network logic stay in App.tsx.
 * Staff access: long-press the header to open the robot setup.
 */
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { SpeechState } from "./lib/speechTypes";

export type ChatMessage = {
  id: string;
  role: "patient" | "assistant";
  text: string;
  source?: string;
};

export interface PatientScreenProps {
  phase: SpeechState;
  isSpeaking: boolean;
  messages: ChatMessage[];
  helpRequested: boolean;
  onRequestHelp(): void;
  onAppendMessage(message: ChatMessage): void;
  onStaffSetup?(): void;
  notice?: string;
}

const SOURCE = "Siemens CT Guide";

// Shown when the patient presses Start. Wording taken from the team's CT guide.
const START_SEQUENCE: Omit<ChatMessage, "id">[] = [
  {
    role: "assistant",
    text: "A CT scan usually takes between 10 and 20 minutes. The hospital will tell you if there is anything you need to do before your scan.",
    source: SOURCE,
  },
  {
    role: "assistant",
    text: "Please do not wear anything with metal in it, such as jewellery, clothes with zips or poppers, bras or hair clips.",
    source: SOURCE,
  },
  {
    role: "assistant",
    text: "When you are ready, just ask me anything about your scan.",
  },
];

const C = {
  teal: "#00897b",
  tealDark: "#00796b",
  tealDeep: "#004d40",
  tealLight: "#41b6c4",
  mint: "#80cbc4",
  ink: "#0b1f3a",
  inkSoft: "#4f6785",
  orange: "#f29222",
  white: "#ffffff",
  emergencyBg: "#4b1c1c",
  emergencyHeader: "#992828",
};

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PatientScreen(props: PatientScreenProps) {
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const emergency = props.helpRequested;

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [props.messages.length]);

  const runSequence = async () => {
    if (isRunning) return;
    setIsRunning(true);
    props.onAppendMessage({ id: newId("p"), role: "patient", text: "Start my CT preparation." });
    for (const item of START_SEQUENCE) {
      await wait(1800);
      props.onAppendMessage({ ...item, id: newId("a") });
    }
    await wait(600);
    setIsRunning(false);
  };

  const handleEmergency = () => {
    if (emergency) return;
    props.onAppendMessage({ id: newId("a"), role: "assistant", text: "Calling emergency support..." });
    props.onRequestHelp();
  };

  const showListening = !emergency && !props.isSpeaking && props.phase === "speech-detected";

  return (
    <View style={[styles.root, emergency && { backgroundColor: C.emergencyBg }]}>
      {!emergency ? (
        <LinearGradient
          colors={["#eaf2ff", "#f7fbff", "#e6f7ff"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <FloatingBubbles />
      <CtCharacters />

      {/* Header */}
      <Pressable
        onLongPress={props.onStaffSetup}
        delayLongPress={1500}
        accessibilityRole="header"
        style={[styles.header, emergency && { backgroundColor: C.emergencyHeader }]}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandBox}>
            <Text style={styles.brandBoxText}>SIEMENS</Text>
          </View>
          <View>
            <View style={styles.brandLine}>
              <Text style={styles.brandSiemens}>SIEMENS</Text>
              <Text style={styles.brandHealthineers}>Healthineers</Text>
              <Text style={styles.brandStar}>✦</Text>
            </View>
            <Text style={styles.brandSubtitle}>CT Patient Prep Assistant</Text>
          </View>
        </View>

        <View style={styles.mascotArea}>
          <Breathing style={[styles.chip, styles.chipHi]} duration={1500}>
            <Text style={[styles.chipText, { color: C.tealDark, fontSize: 17 }]}>Hi!</Text>
          </Breathing>
          <Breathing style={[styles.chip, styles.chipRelax]} duration={1700}>
            <Text style={[styles.chipText, { color: C.orange }]}>Relax</Text>
          </Breathing>
          <Breathing style={[styles.chip, styles.chipBreathe]} duration={1900}>
            <Text style={[styles.chipText, { color: C.tealLight }]}>Breathe</Text>
          </Breathing>
          <Breathing
            style={[styles.mascotCircle, emergency && { backgroundColor: "rgba(239,83,80,0.92)" }]}
            duration={1500}
            scaleTo={1.05}
          >
            <Giraffe />
          </Breathing>
        </View>
      </Pressable>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.helloCard}>
          <Text style={styles.helloTitle}>Hello</Text>
          <Text style={styles.helloText}>I will help you prepare for your CT scan. Press Start to begin.</Text>
          <Text style={styles.statusText}>{statusLabel(props.phase, props.isSpeaking, emergency)}</Text>
          {props.notice ? <Text style={styles.notice}>{props.notice}</Text> : null}
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            disabled={isRunning}
            onPress={runSequence}
            style={({ pressed }) => [styles.buttonWrap, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={isRunning ? ["#90cbc4", "#90cbc4"] : [C.teal, "#00bfa5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Start</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency call to staff"
            onPress={handleEmergency}
            style={({ pressed }) => [styles.buttonWrap, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={["#c62828", "#ef5350"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Emergency Call</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.responseCard}>
          <Text style={styles.responseTitle}>Assistant Response</Text>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.messages}>
            <Bubble
              message={{
                id: "welcome",
                role: "assistant",
                text: "Hello! I am your CT preparation assistant. Press Start to begin your CT scan preparation.",
                source: SOURCE,
              }}
            />
            {props.messages.map((m) => <Bubble key={m.id} message={m} />)}
          </ScrollView>
        </View>
      </View>

      {showListening ? <ListeningOverlay /> : null}
    </View>
  );
}

function statusLabel(phase: SpeechState, isSpeaking: boolean, emergency: boolean): string {
  if (emergency) return "A staff member is on the way.";
  if (isSpeaking) return "Speaking…";
  switch (phase) {
    case "initializing": return "Getting ready…";
    case "listening": return "I am listening. Just ask your question.";
    case "speech-detected": return "Listening…";
    case "transcribing":
    case "delivering": return "Thinking…";
    default: return "Paused";
  }
}

function Bubble({ message }: { message: ChatMessage }) {
  const patient = message.role === "patient";
  return (
    <View style={[styles.bubble, patient ? styles.bubblePatient : styles.bubbleAssistant]}>
      <Text style={styles.bubbleText}>{message.text}</Text>
      {!patient && message.source ? <Text style={styles.sourceText}>Source: {message.source}</Text> : null}
    </View>
  );
}

/** Gently scales its content up and down ("breathing"). */
function Breathing(props: {
  style?: object;
  duration: number;
  scaleTo?: number;
  children: React.ReactNode;
}) {
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: props.scaleTo ?? 1.06, duration: props.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration: props.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, props.duration, props.scaleTo]);
  return <Animated.View style={[props.style, { transform: [{ scale: value }] }]}>{props.children}</Animated.View>;
}

/** The giraffe from the design, drawn with simple shapes (viewBox 100×120 scaled to 82×96). */
function Giraffe() {
  const sx = 0.82;
  const sy = 0.8;
  const yellow = "#f2c350";
  const brown = "#b06a2a";
  const rect = (x: number, y: number, w: number, h: number, color: string, round = 0) => ({
    position: "absolute" as const, left: x * sx, top: y * sy, width: w * sx, height: h * sy,
    backgroundColor: color, borderRadius: round,
  });
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: string) => ({
    position: "absolute" as const, left: (cx - rx) * sx, top: (cy - ry) * sy, width: 2 * rx * sx, height: 2 * ry * sy,
    backgroundColor: color, borderRadius: Math.max(rx * sx, ry * sy),
  });
  const spots: [number, number, number][] = [[34, 54, 4], [58, 62, 5], [46, 78, 4], [62, 84, 3], [32, 96, 3], [56, 108, 4], [44, 24, 3], [62, 20, 2]];
  return (
    <View style={{ width: 82, height: 96 }}>
      <View style={rect(40, 44, 20, 56, yellow, 8)} />
      <View style={ellipse(50, 104, 26, 14, yellow)} />
      <View style={ellipse(50, 30, 22, 18, yellow)} />
      <View style={ellipse(28, 22, 6, 10, yellow)} />
      <View style={ellipse(72, 22, 6, 10, yellow)} />
      <View style={rect(44, 6, 4, 10, brown, 2)} />
      <View style={rect(52, 6, 4, 10, brown, 2)} />
      <View style={ellipse(40, 30, 3, 3, "#222222")} />
      <View style={ellipse(60, 30, 3, 3, "#222222")} />
      <View style={ellipse(50, 38, 6, 4, "#e8a83c")} />
      <View
        style={{
          position: "absolute", left: 42 * sx, top: 42 * sy, width: 16 * sx, height: 6 * sy,
          borderBottomWidth: 2, borderColor: "#222222", borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
        }}
      />
      {spots.map(([cx, cy, r], i) => <View key={i} style={ellipse(cx, cy, r, r, brown)} />)}
    </View>
  );
}

type BubbleSpec = { left: number; bottom: number; size: number; delay: number; duration: number; opacity: number };

/** Glossy bubbles slowly floating in the background. */
function FloatingBubbles() {
  const [bubbles] = useState<BubbleSpec[]>(() =>
    Array.from({ length: 14 }).map(() => ({
      left: 8 + Math.random() * 84,
      bottom: 6 + Math.random() * 40,
      size: 24 + Math.random() * 42,
      delay: Math.random() * 6000,
      duration: 6000 + Math.random() * 5000,
      opacity: 0.22 + Math.random() * 0.28,
    })),
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bubbles.map((b, i) => <FloatingBubble key={i} spec={b} />)}
    </View>
  );
}

function FloatingBubble({ spec }: { spec: BubbleSpec }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: spec.duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: spec.duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), spec.delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [t, spec]);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: `${spec.left}%`,
        bottom: `${spec.bottom}%`,
        width: spec.size,
        height: spec.size,
        borderRadius: spec.size / 2,
        backgroundColor: `rgba(128, 203, 196, ${spec.opacity})`,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.6)",
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
        ],
      }}
    >
      <View
        style={{
          position: "absolute", left: spec.size * 0.18, top: spec.size * 0.15,
          width: spec.size * 0.3, height: spec.size * 0.3, borderRadius: spec.size * 0.15,
          backgroundColor: "rgba(255,255,255,0.75)",
        }}
      />
    </Animated.View>
  );
}

/** Two faint smiling CT characters bouncing at the bottom of the screen. */
function CtCharacters() {
  return (
    <View pointerEvents="none" style={styles.charactersArea}>
      <Bouncing duration={1100}>
        <CtFace size={140} ring={C.teal} />
        <View style={{ width: 52, height: 18, backgroundColor: C.teal, marginTop: -8, borderRadius: 8 }} />
        <View style={{ width: 110, height: 12, backgroundColor: C.tealLight, borderRadius: 999, marginTop: 16 }} />
      </Bouncing>
      <Bouncing duration={1200} delay={400}>
        <CtFace size={118} ring={C.tealLight} />
        <View style={{ width: 44, height: 16, backgroundColor: C.tealLight, marginTop: -7, borderRadius: 7 }} />
        <View style={{ width: 92, height: 10, backgroundColor: C.mint, borderRadius: 999, marginTop: 14 }} />
      </Bouncing>
    </View>
  );
}

function CtFace({ size, ring }: { size: number; ring: string }) {
  const eye = Math.round(size / 10);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, borderWidth: Math.round(size / 16),
        borderColor: ring, backgroundColor: "rgba(255,255,255,0.4)",
      }}
    >
      <View style={{ position: "absolute", top: size * 0.24, left: size * 0.18, width: eye, height: eye, borderRadius: eye / 2, backgroundColor: C.tealDeep }} />
      <View style={{ position: "absolute", top: size * 0.24, right: size * 0.18, width: eye, height: eye, borderRadius: eye / 2, backgroundColor: C.tealDeep }} />
      <View
        style={{
          position: "absolute", bottom: size * 0.2, left: size / 2 - size * 0.165, width: size * 0.33, height: size * 0.15,
          borderWidth: 4, borderTopWidth: 0, borderColor: C.tealDeep,
          borderBottomLeftRadius: size * 0.2, borderBottomRightRadius: size * 0.2,
        }}
      />
    </View>
  );
}

function Bouncing(props: { duration: number; delay?: number; children: React.ReactNode }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(props.delay ?? 0),
        Animated.timing(y, { toValue: -14, duration: props.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: props.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y, props.duration, props.delay]);
  return <Animated.View style={{ alignItems: "center", transform: [{ translateY: y }] }}>{props.children}</Animated.View>;
}

/** Dimmed overlay with the white "Listening..." card, shown while the patient is speaking. */
function ListeningOverlay() {
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <View style={styles.waveRow}>
          <PulseCircle size={20} color={C.teal} delay={0} />
          <PulseCircle size={34} color={C.tealLight} delay={400} />
          <PulseCircle size={48} color={C.mint} delay={800} />
        </View>
        <Text style={styles.overlayTitle}>Listening...</Text>
        <Text style={styles.overlayText}>Speak now, I am listening to you</Text>
      </View>
    </View>
  );
}

function PulseCircle({ size, color, delay }: { size: number; color: string; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.75] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] }) }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7fbff" },
  header: {
    backgroundColor: C.teal, paddingHorizontal: 36, paddingVertical: 18, flexDirection: "row",
    justifyContent: "space-between", alignItems: "center", elevation: 6, zIndex: 2,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14, flexShrink: 1 },
  brandBox: { backgroundColor: C.white, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, elevation: 2 },
  brandBoxText: { color: C.teal, fontWeight: "800", fontSize: 20, letterSpacing: 1.2 },
  brandLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandSiemens: { fontSize: 28, fontWeight: "700", color: C.tealLight, letterSpacing: 0.5 },
  brandHealthineers: { fontSize: 26, fontWeight: "700", color: C.orange },
  brandStar: { fontSize: 22, color: C.orange },
  brandSubtitle: { fontSize: 14, color: "#e0f2f1", marginTop: 4 },
  mascotArea: { width: 260, height: 140, alignItems: "flex-end", justifyContent: "center" },
  chip: { position: "absolute", backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, elevation: 2 },
  chipHi: { top: 10, left: 6, paddingHorizontal: 16, paddingVertical: 10 },
  chipRelax: { top: 54, left: 56 },
  chipBreathe: { top: 94, left: 10 },
  chipText: { fontSize: 15, fontWeight: "700" },
  mascotCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 4, borderColor: C.white, alignItems: "center", justifyContent: "center", elevation: 8,
  },
  body: { flex: 1, paddingHorizontal: 36, paddingVertical: 28, zIndex: 1 },
  helloCard: {
    backgroundColor: C.white, borderRadius: 28, paddingHorizontal: 32, paddingVertical: 28,
    borderWidth: 1, borderColor: "#eaf2ff", marginBottom: 24, elevation: 3,
  },
  helloTitle: { fontSize: 32, fontWeight: "700", color: C.ink, marginBottom: 8 },
  helloText: { fontSize: 20, color: C.inkSoft, lineHeight: 30 },
  statusText: { fontSize: 18, color: C.tealDark, fontWeight: "700", marginTop: 12 },
  notice: { fontSize: 16, color: C.inkSoft, marginTop: 6 },
  buttonRow: { flexDirection: "row", gap: 18, marginBottom: 24 },
  buttonWrap: { flex: 1 },
  pressed: { transform: [{ scale: 0.97 }] },
  button: { paddingVertical: 26, paddingHorizontal: 18, borderRadius: 24, alignItems: "center", elevation: 5 },
  buttonText: { fontSize: 22, fontWeight: "600", color: C.white },
  responseCard: {
    flex: 1, backgroundColor: C.white, borderRadius: 28, padding: 28,
    borderWidth: 1, borderColor: "#e6f4f3", elevation: 3,
  },
  responseTitle: { fontSize: 24, color: C.tealDeep, marginBottom: 16 },
  messages: { gap: 16, paddingBottom: 8 },
  bubble: { maxWidth: "85%" },
  bubblePatient: {
    alignSelf: "flex-end", backgroundColor: "#e6f4f3", paddingVertical: 18, paddingHorizontal: 22, maxWidth: "75%",
    borderTopLeftRadius: 22, borderTopRightRadius: 6, borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
  },
  bubbleAssistant: {
    alignSelf: "flex-start", backgroundColor: "#f4fbf9", paddingVertical: 20, paddingHorizontal: 24,
    borderWidth: 1, borderColor: "#b2dfdb",
    borderTopLeftRadius: 6, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
  },
  bubbleText: { fontSize: 20, lineHeight: 31, color: C.ink },
  sourceText: { fontSize: 15, marginTop: 12, color: C.tealDark },
  charactersArea: {
    position: "absolute", bottom: 30, left: 0, right: 0, height: 340, opacity: 0.22,
    flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 90,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.22)",
    alignItems: "center", justifyContent: "center", zIndex: 99, elevation: 20,
  },
  overlayCard: { backgroundColor: C.white, paddingVertical: 40, paddingHorizontal: 60, borderRadius: 32, alignItems: "center", elevation: 12 },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  overlayTitle: { fontSize: 30, fontWeight: "700", color: C.tealDark },
  overlayText: { fontSize: 20, color: C.inkSoft, marginTop: 10 },
});
