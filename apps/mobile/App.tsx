import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { AxisLoginScreen } from "./src/screens/login/AxisLoginScreen";

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <AxisLoginScreen />
      <StatusBar style="light" />
    </View>
  );
}
