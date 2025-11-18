import { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { resetPassword } from "../../services/api";

type Theme = "light" | "dark";

type Props = {
  visible: boolean;
  theme: Theme;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function AxisResetPasswordModal({
  visible,
  theme,
  onClose,
  onSuccess,
}: Props) {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === "dark";

  const handleSubmit = async () => {
    if (!token || !password) {
      setError("Preencha token e nova senha.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, password);
      setToken("");
      setPassword("");
      setConfirmPassword("");
      onSuccess("Senha redefinida. Faça login novamente.");
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível redefinir sua senha.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: isDark ? "#0f172a" : "#f8fafc" },
          ]}
        >
          <Text
            style={[
              styles.modalTitle,
              { color: isDark ? "#e5e7eb" : "#020617" },
            ]}
          >
            Redefinir senha
          </Text>
          <Text
            style={[
              styles.modalDescription,
              { color: isDark ? "#94a3b8" : "#334155" },
            ]}
          >
            Insira o token recebido por e-mail e uma nova senha segura.
          </Text>

          <TextInput
            placeholder="Token"
            placeholderTextColor={isDark ? "#94a3b8" : "#94a3b8"}
            value={token}
            onChangeText={setToken}
            style={[
              styles.modalInput,
              {
                backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "#fff",
                color: isDark ? "#e5e7eb" : "#020617",
              },
            ]}
          />

          <TextInput
            placeholder="Nova senha"
            placeholderTextColor={isDark ? "#94a3b8" : "#94a3b8"}
            value={password}
            secureTextEntry
            onChangeText={setPassword}
            style={[
              styles.modalInput,
              {
                backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "#fff",
                color: isDark ? "#e5e7eb" : "#020617",
              },
            ]}
          />

          <TextInput
            placeholder="Confirmar senha"
            placeholderTextColor={isDark ? "#94a3b8" : "#94a3b8"}
            value={confirmPassword}
            secureTextEntry
            onChangeText={setConfirmPassword}
            style={[
              styles.modalInput,
              {
                backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "#fff",
                color: isDark ? "#e5e7eb" : "#020617",
              },
            ]}
          />

          {error && (
            <Text style={[styles.modalError, { color: "#f87171" }]}>
              {error}
            </Text>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancel]}
              onPress={onClose}
            >
              <Text style={{ color: isDark ? "#38bdf8" : "#0f172a" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalPrimary]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {loading ? "Salvando..." : "Atualizar senha"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  modalDescription: {
    textAlign: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  modalInput: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    marginHorizontal: 4,
  },
  modalPrimary: {
    backgroundColor: "#4f46e5",
  },
  modalCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.7)",
  },
  modalError: {
    textAlign: "center",
    marginTop: 4,
  },
});
