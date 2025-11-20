import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { BlurView, BlurViewProps } from "expo-blur";
import {
  login,
  requestPasswordReset,
} from "../../services/api";
import {
  getLastEmail,
  persistTokens,
} from "../../storage/tokenStorage";
import { AxisResetPasswordModal } from "./AxisResetPasswordModal";

import axisLogo from "../../../assets/axis-logo.png";

type Theme = "light" | "dark";

export function AxisLoginScreen() {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(
    systemScheme === "light" ? "light" : "dark",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [forgotFeedback, setForgotFeedback] = useState<string | null>(null);
  const [resetVisible, setResetVisible] = useState(false);

  const logoTranslateY = useRef(new Animated.Value(-80)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [logoTranslateY, logoOpacity, formOpacity, formTranslateY]);

  useEffect(() => {
    getLastEmail().then((value) => {
      if (value) setEmail(value);
    });
  }, []);

  useEffect(() => {
    if (systemScheme) {
      setTheme(systemScheme === "light" ? "light" : "dark");
    }
  }, [systemScheme]);

  const handleLogin = async () => {
    if (!email || !password) {
      setFeedback("Preencha login e senha.");
      return;
    }
    setFeedback(null);
    setLoading(true);
    try {
      const tokens = await login(email.trim(), password);
      await persistTokens(email.trim(), tokens);
      setFeedback("Autenticado com sucesso.");
      setPassword("");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Falha ao entrar no Axis.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setForgotFeedback("Informe seu e-mail antes de solicitar.");
      return;
    }
    setForgotFeedback(null);
    setForgotLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setForgotFeedback(
        "Se o e-mail existir, enviaremos o link em poucos minutos.",
      );
    } catch (err) {
      setForgotFeedback(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar o reset agora.",
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const isDark = theme === "dark";
  const backgroundColor = isDark ? "#020617" : "#e5f0ff";

  return (
    <>
      <SafeAreaView style={[styles.root, { backgroundColor }]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[
              styles.toggle,
              {
                backgroundColor: isDark
                  ? "rgba(15,23,42,0.75)"
                  : "rgba(255,255,255,0.85)",
              },
            ]}
            onPress={() => setTheme(isDark ? "light" : "dark")}
          >
            <Text style={{ color: isDark ? "#e5e7eb" : "#020617", fontSize: 12 }}>
              {isDark ? "☀️ Claro" : "🌙 Escuro"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.center}>
          <AxisBlurView
            intensity={80}
            tint={isDark ? "dark" : "light"}
            style={styles.card}
          >
            <Animated.View
              style={{
                alignItems: "center",
                marginBottom: 16,
                transform: [{ translateY: logoTranslateY }],
                opacity: logoOpacity,
              }}
            >
              <Image source={axisLogo} style={styles.logo} resizeMode="contain" />
            </Animated.View>

            <Animated.View
              style={{
                opacity: formOpacity,
                transform: [{ translateY: formTranslateY }],
              }}
            >
              <Text
                style={[
                  styles.title,
                  { color: isDark ? "#e5e7eb" : "#020617" },
                ]}
              >
                Entrar no AXIS
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: isDark ? "rgba(148,163,184,0.9)" : "#4b5563" },
                ]}
              >
                Acesse seu painel e PDV
              </Text>

              <View style={styles.field}>
                <Text
                  style={[
                    styles.label,
                    { color: isDark ? "#e5e7eb" : "#020617" },
                  ]}
                >
                  Login
                </Text>
                <TextInput
                  placeholder="email"
                  placeholderTextColor={
                    isDark ? "rgba(148,163,184,0.9)" : "#9ca3af"
                  }
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark
                        ? "rgba(15,23,42,0.9)"
                        : "rgba(255,255,255,0.95)",
                      color: isDark ? "#e5e7eb" : "#020617",
                    },
                  ]}
                />
              </View>

              <View style={styles.field}>
                <Text
                  style={[
                    styles.label,
                    { color: isDark ? "#e5e7eb" : "#020617" },
                  ]}
                >
                  Senha
                </Text>
                <TextInput
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={
                    isDark ? "rgba(148,163,184,0.9)" : "#9ca3af"
                  }
                  value={password}
                  onChangeText={setPassword}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark
                        ? "rgba(15,23,42,0.9)"
                        : "rgba(255,255,255,0.95)",
                      color: isDark ? "#e5e7eb" : "#020617",
                    },
                  ]}
                />
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <Text style={styles.primaryButtonText}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleForgotPassword} disabled={forgotLoading}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDark ? "#38bdf8" : "#0f172a",
                      textDecorationLine: isDark ? "none" : "underline",
                    }}
                  >
                    {forgotLoading ? "Enviando..." : "Esqueci minha senha"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setResetVisible(true)}
              >
                <Text style={{ color: isDark ? "#e5e7eb" : "#0f172a", fontSize: 12 }}>
                  Já tenho um token
                </Text>
              </TouchableOpacity>

              {feedback && (
                <Text
                  style={[
                    styles.feedbackText,
                    { color: feedback.includes("sucesso") ? "#34d399" : "#f87171" },
                  ]}
                >
                  {feedback}
                </Text>
              )}

              {forgotFeedback && (
                <Text
                  style={[
                    styles.feedbackText,
                    {
                      color: forgotFeedback.startsWith("Se o")
                        ? "#34d399"
                        : "#f87171",
                    },
                  ]}
                >
                  {forgotFeedback}
                </Text>
              )}
            </Animated.View>
          </AxisBlurView>
        </View>
      </SafeAreaView>

      <AxisResetPasswordModal
        visible={resetVisible}
        theme={theme}
        onClose={() => setResetVisible(false)}
        onSuccess={(message) => setFeedback(message)}
      />
    </>
  );
}

const AxisBlurView = BlurView as unknown as React.ComponentType<BlurViewProps>;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: "flex-end",
  },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.7)",
  },
  center: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.7)",
    overflow: "hidden",
  },
  logo: {
    width: 140,
    height: 140,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  field: {
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    marginBottom: 4,
  },
  input: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.7)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    justifyContent: "space-between",
  },
  primaryButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 10,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
  },
  feedbackText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
});
