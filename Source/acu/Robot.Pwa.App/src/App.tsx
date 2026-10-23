import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  clearRobotConfig,
  loadRobotConfig,
  saveRobotConfig,
} from "./lib/configStorage";
import {
  createSessionId,
  resetConversation,
  sendChat,
  synthesizeSpeech,
} from "./lib/conversationApi";
import {
  AcuHttpError,
  checkAcuHealth,
  getRegistrationStatus,
  registerRobot,
  verifyApprovedRobot,
} from "./lib/deviceApi";
import { playWaveResponse } from "./lib/responsePlayer";
import {
  DEFAULT_ROBOT_CONFIG,
  normalizeRobotConfig,
  type RobotConfig,
} from "./lib/robotConfig";
import { createSpeechToText } from "./lib/speechToText";
import type { SpeechLanguage, SpeechState } from "./lib/speechTypes";

type AppStage = "loading" | "setup" | "connecting" | "pending" | "conversation";
type TextConfigField = Exclude<keyof RobotConfig, "language">;

const stateLabels: Record<SpeechState, string> = {
  initializing: "Loading local speech models",
  listening: "Listening — speak naturally",
  "speech-detected": "Patient is speaking",
  transcribing: "Transcribing locally on the robot",
  delivering: "Sending recognized text to ACU",
  stopped: "Listening paused",
};

export default function App() {
  const [stage, setStage] = useState<AppStage>("loading");
  const [config, setConfig] = useState<RobotConfig>(DEFAULT_ROBOT_CONFIG);
  const [message, setMessage] = useState("Loading saved robot configuration…");

  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      try {
        const stored = await loadRobotConfig();
        if (!mounted) return;
        if (!stored) {
          setMessage("Configure this robot before hands-free listening starts.");
          setStage("setup");
          return;
        }

        setConfig(stored);
        setStage("connecting");
        setMessage("Checking ACU and robot approval…");
        await checkAcuHealth(stored.baseUrl);
        const status = await getRegistrationStatus(stored);
        if (!mounted) return;
        await routeRegistrationStatus(stored, status, {
          onApproved: () => setStage("conversation"),
          onPending: () => setStage("pending"),
          onSetup: (detail) => {
            setMessage(detail);
            setStage("setup");
          },
        });
      } catch (error) {
        if (!mounted) return;
        setMessage(`无法恢复机器人配置或连接 ACU：${errorMessage(error)}`);
        setStage("setup");
      }
    };

    void restore();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (stage !== "pending") return;
    let mounted = true;

    const poll = async () => {
      try {
        const status = await getRegistrationStatus(config);
        if (!mounted) return;
        await routeRegistrationStatus(config, status, {
          onApproved: () => {
            setMessage("Robot approved. Starting hands-free conversation…");
            setStage("conversation");
          },
          onPending: () => setMessage("Registration sent. Waiting for ACU operator approval…"),
          onSetup: (detail) => {
            setMessage(detail);
            setStage("setup");
          },
        });
      } catch (error) {
        if (mounted) setMessage(`仍在等待审批；最近一次检查失败：${errorMessage(error)}`);
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 3_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [stage, config]);

  const connect = async () => {
    setStage("connecting");
    setMessage("Validating settings and contacting ACU…");
    try {
      const normalized = normalizeRobotConfig(config);
      setConfig(normalized);
      await checkAcuHealth(normalized.baseUrl);

      try {
        await registerRobot(normalized);
      } catch (error) {
        // A previous installation may already own this device ID. The status
        // check and MAC verification below determine whether reuse is safe.
        const sameDeviceAlreadyRegistered =
          error instanceof AcuHttpError &&
          error.status === 409 &&
          /is already registered \(status:/i.test(error.message);
        if (!sameDeviceAlreadyRegistered) throw error;
      }

      const status = await getRegistrationStatus(normalized);
      await routeRegistrationStatus(normalized, status, {
        onApproved: () => {
          setMessage("Robot approved. Starting hands-free conversation…");
          setStage("conversation");
        },
        onPending: () => {
          setMessage("Registration sent. Waiting for ACU operator approval…");
          setStage("pending");
        },
        onSetup: (detail) => {
          setMessage(detail);
          setStage("setup");
        },
      });
      await saveRobotConfig(normalized);
    } catch (error) {
      setMessage(errorMessage(error));
      setStage("setup");
    }
  };

  const forgetConfiguration = async () => {
    try {
      await clearRobotConfig();
      setConfig(DEFAULT_ROBOT_CONFIG);
      setMessage("Saved settings cleared. The ACU device record was not deleted.");
    } catch (error) {
      setMessage(`无法清除本地配置：${errorMessage(error)}`);
    }
    setStage("setup");
  };

  const changeLanguage = async (language: SpeechLanguage) => {
    const updated = { ...config, language };
    setConfig(updated);
    try {
      await saveRobotConfig(updated);
    } catch (error) {
      setMessage(`语言已切换，但保存失败：${errorMessage(error)}`);
    }
  };

  if (stage === "loading" || stage === "connecting") {
    return <StatusScreen title="Preparing robot" message={message} busy />;
  }

  if (stage === "pending") {
    return (
      <StatusScreen
        title="Waiting for ACU approval"
        message={message}
        detail={`${config.deviceId} · ${config.mac}`}
        onBack={() => setStage("setup")}
      />
    );
  }

  if (stage === "setup") {
    return (
      <SetupScreen
        config={config}
        message={message}
        onChange={setConfig}
        onConnect={() => void connect()}
        onClear={() => void forgetConfiguration()}
      />
    );
  }

  return (
    <ConversationScreen
      config={config}
      onLanguageChange={(language) => void changeLanguage(language)}
      onChangeSetup={() => {
        setMessage("Update the settings, then reconnect to ACU.");
        setStage("setup");
      }}
    />
  );
}

async function routeRegistrationStatus(
  config: RobotConfig,
  status: Awaited<ReturnType<typeof getRegistrationStatus>>,
  actions: {
    onApproved(): void;
    onPending(): void;
    onSetup(detail: string): void;
  },
) {
  if (status === "approved") {
    await verifyApprovedRobot(config);
    actions.onApproved();
  } else if (status === "pending") {
    actions.onPending();
  } else if (status === "rejected") {
    actions.onSetup("ACU operator rejected this robot. Remove or approve its device record before retrying.");
  } else {
    actions.onSetup("This robot is not registered on ACU. Review the settings and connect again.");
  }
}

function SetupScreen(props: {
  config: RobotConfig;
  message: string;
  onChange(config: RobotConfig): void;
  onConnect(): void;
  onClear(): void;
}) {
  const update = (field: TextConfigField, value: string) => {
    props.onChange({ ...props.config, [field]: value });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Robot conversation setup</Text>
        <Text style={styles.subtitle}>Connect and approve the robot before enabling its microphone.</Text>

        <View style={styles.statePanel}>
          <Text style={styles.message}>{props.message}</Text>
        </View>

        <View style={styles.row}>
          <Field label="ACU URL" value={props.config.baseUrl} onChangeText={(v) => update("baseUrl", v)} />
          <Field label="Device ID" value={props.config.deviceId} onChangeText={(v) => update("deviceId", v)} />
          <Field label="MAC / robot identifier" value={props.config.mac} onChangeText={(v) => update("mac", v)} />
        </View>
        <View style={styles.row}>
          <Field label="Robot name" value={props.config.name} onChangeText={(v) => update("name", v)} />
          <Field label="Robot IP (optional)" value={props.config.ip} onChangeText={(v) => update("ip", v)} />
          <Field label="Firmware" value={props.config.firmware} onChangeText={(v) => update("firmware", v)} />
        </View>

        <LanguageSelector
          language={props.config.language}
          onChange={(language) => props.onChange({ ...props.config, language })}
        />

        <View style={styles.buttonRow}>
          <ActionButton label="Save and connect" onPress={props.onConnect} primary />
          <ActionButton label="Clear saved settings" onPress={props.onClear} />
        </View>
        <Text style={styles.hint}>
          For the Android emulator use http://10.0.2.2:3000. On a physical robot use the ACU computer&apos;s LAN address.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ConversationScreen(props: {
  config: RobotConfig;
  onLanguageChange(language: SpeechLanguage): void;
  onChangeSetup(): void;
}) {
  const speechToText = useMemo(() => createSpeechToText(), []);
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<SpeechState>("initializing");
  const [message, setMessage] = useState("Starting hands-free conversation mode…");
  const sessionId = useRef(createSessionId());
  const configRef = useRef(props.config);

  useEffect(() => {
    configRef.current = props.config;
  }, [props.config]);

  useEffect(() => {
    let mounted = true;
    let starting = false;

    const options = {
      getLanguage: () => configRef.current.language,
      onStateChange: (state: SpeechState) => {
        if (mounted) setPhase(state);
      },
      onTranscript: async (text: string, detectedLanguage: SpeechLanguage) => {
        if (!mounted) return;
        setTranscript(text);
        setMessage("Speech recognized; waiting for the ACU answer…");
        const current = configRef.current;
        const reply = await sendChat({
          baseUrl: current.baseUrl,
          deviceId: current.deviceId,
          mac: current.mac,
          sessionId: sessionId.current,
          text,
          language: detectedLanguage,
        });
        if (!mounted) return;
        setAnswer(reply.answer);
        setMessage(reply.isMock
          ? "Development response received; requesting ACU speech…"
          : "ACU answer received; requesting ACU speech…");

        const audio = await synthesizeSpeech(current, reply.answer, reply.language);
        if (!mounted) return;
        setMessage("The robot is speaking. Listening is paused to prevent echo.");
        await playWaveResponse(audio, reply.requestId);
        if (mounted) setMessage("Answer delivered; resuming hands-free listening.");
      },
      onError: (error: Error) => {
        if (mounted) setMessage(error.message);
      },
    };

    const startListening = async () => {
      if (starting) return;
      starting = true;
      try {
        await speechToText.start(options);
      } catch (error) {
        if (mounted) {
          setPhase("stopped");
          setMessage(errorMessage(error));
        }
      } finally {
        starting = false;
      }
    };

    void startListening();
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (!mounted) return;
      if (nextState === "active") {
        setMessage("App active; resuming hands-free listening…");
        void startListening();
      } else {
        setMessage("App is in the background; microphone listening is paused.");
        void speechToText.stop();
      }
    });

    return () => {
      mounted = false;
      appStateSubscription.remove();
      void speechToText.release();
      void resetConversation(configRef.current, sessionId.current).catch(() => {
        // The server-side idle timeout remains the fallback if shutdown interrupts reset.
      });
    };
  }, [speechToText]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headingRow}>
          <View style={styles.headingText}>
            <Text style={styles.title}>Hands-free patient conversation</Text>
            <Text style={styles.subtitle}>Local VAD + Whisper → ACU text API</Text>
          </View>
          <View style={[styles.indicator, indicatorStyle(phase)]} />
        </View>

        <View style={styles.statePanel}>
          <Text style={styles.state}>{stateLabels[phase]}</Text>
          <Text style={styles.hint}>
            No recording button is needed. A short pause ends the sentence and sends only recognized text to ACU.
          </Text>
        </View>

        <View style={styles.identityPanel}>
          <Text style={styles.identity}>{props.config.deviceId}</Text>
          <Text style={styles.identityDetail}>{props.config.baseUrl} · {props.config.mac}</Text>
          <ActionButton label="Change setup" onPress={props.onChangeSetup} />
        </View>

        <LanguageSelector language={props.config.language} onChange={props.onLanguageChange} />

        <Text style={styles.label}>Last recognized sentence</Text>
        <View style={styles.transcriptPanel}>
          <Text style={styles.transcript}>{transcript || "Waiting for the patient to speak…"}</Text>
        </View>
        <Text style={styles.label}>Last ACU answer</Text>
        <View style={styles.answerPanel}>
          <Text style={styles.transcript}>{answer || "Waiting for an ACU answer…"}</Text>
        </View>
        <Text style={styles.message}>{message}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusScreen(props: {
  title: string;
  message: string;
  detail?: string;
  busy?: boolean;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.centered}>
        <View style={[styles.indicator, props.busy ? styles.indicatorBusy : styles.indicatorSpeaking]} />
        <Text style={styles.title}>{props.title}</Text>
        {props.detail ? <Text style={styles.identityDetail}>{props.detail}</Text> : null}
        <Text style={styles.message}>{props.message}</Text>
        {props.onBack ? <ActionButton label="Review setup" onPress={props.onBack} /> : null}
      </View>
    </SafeAreaView>
  );
}

function LanguageSelector(props: {
  language: SpeechLanguage;
  onChange(language: SpeechLanguage): void;
}) {
  return (
    <View style={styles.languageRow}>
      <Text style={styles.label}>Language</Text>
      {(["auto", "en", "de", "zh"] as const).map((value) => (
        <TouchableOpacity
          accessibilityRole="button"
          key={value}
          style={[styles.chip, props.language === value && styles.chipSelected]}
          onPress={() => props.onChange(value)}
        >
          <Text style={styles.chipText}>{value}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Field(props: { label: string; value: string; onChangeText(value: string): void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function ActionButton(props: { label: string; onPress(): void; primary?: boolean }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.button, props.primary && styles.buttonPrimary]}
      onPress={props.onPress}
    >
      <Text style={styles.buttonText}>{props.label}</Text>
    </TouchableOpacity>
  );
}

function indicatorStyle(phase: SpeechState) {
  if (phase === "listening") return styles.indicatorListening;
  if (phase === "speech-detected") return styles.indicatorSpeaking;
  if (phase === "stopped") return styles.indicatorStopped;
  return styles.indicatorBusy;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#07191b" },
  container: { padding: 28, gap: 18 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 36, gap: 20 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headingText: { flexShrink: 1 },
  title: { color: "#ffffff", fontSize: 32, fontWeight: "700", textAlign: "center" },
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
  languageRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  chip: { backgroundColor: "#254043", borderRadius: 16, paddingHorizontal: 15, paddingVertical: 8 },
  chipSelected: { backgroundColor: "#008c95" },
  chipText: { color: "#ffffff", fontWeight: "700" },
  transcriptPanel: {
    minHeight: 120,
    backgroundColor: "#102a2d",
    borderColor: "#287d7d",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  answerPanel: {
    minHeight: 120,
    backgroundColor: "#0d3034",
    borderColor: "#00a7ad",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  transcript: { color: "#ffffff", fontSize: 20, lineHeight: 28 },
  message: { color: "#f0a050", fontSize: 16, lineHeight: 23, textAlign: "center" },
  buttonRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  button: {
    borderColor: "#00a7ad",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignSelf: "flex-start",
  },
  buttonPrimary: { backgroundColor: "#008c95" },
  buttonText: { color: "#ffffff", fontWeight: "700" },
  identityPanel: { backgroundColor: "#102a2d", borderRadius: 8, padding: 14, gap: 6 },
  identity: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  identityDetail: { color: "#75d5d0", fontSize: 14, textAlign: "center" },
});
