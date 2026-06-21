import { getWorkspaceStatusChecklistProgress, getWorkspaceStatusSeed } from "@app/domain";
import { themeTokens } from "@app/theme";
import { createStatusChecklistPrimitive, createWorkspaceStatusPrimitive } from "@app/ui";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

export default function App() {
  const status = getWorkspaceStatusSeed();
  const progress = getWorkspaceStatusChecklistProgress(status);
  const workspaceStatus = createWorkspaceStatusPrimitive(
    status,
    `${progress.completed} of ${progress.total} complete`
  );
  const checklist = createStatusChecklistPrimitive(status.checklist);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeTokens.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: themeTokens.spacing.lg }}>
        <View style={{ backgroundColor: themeTokens.colors.surface, borderRadius: themeTokens.radius.md, padding: 20 }}>
          <Text style={{ color: themeTokens.colors.muted }}>Workspace status</Text>
          <Text style={{ color: themeTokens.colors.foreground, fontSize: 28, fontWeight: "700", marginVertical: 8 }}>
            {workspaceStatus.status.workspaceName}
          </Text>
          <Text style={{ color: themeTokens.colors.foreground }}>
            {workspaceStatus.progressLabel}
          </Text>
          <View style={{ marginTop: 20 }}>
            {checklist.items.map((item) => (
              <View key={item.id} style={{ paddingVertical: 10 }}>
                <Text style={{ color: item.complete ? themeTokens.colors.success : themeTokens.colors.accent }}>
                  {item.complete ? "Done" : "Next"} - {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
