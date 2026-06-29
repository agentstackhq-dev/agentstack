import { StrictMode } from "react";
import { ClerkProvider, useAuth } from "@clerk/react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const runtimeConfigured = isConfigured(clerkPublishableKey) && isConfigured(convexUrl);
const convex = runtimeConfigured ? new ConvexReactClient(convexUrl!) : undefined;

function RuntimeProviders() {
  if (!runtimeConfigured || convex === undefined || clerkPublishableKey === undefined) {
    return <App runtimeReady={false} />;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App runtimeReady />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function isConfigured(value: string | undefined): value is string {
  return Boolean(value && !value.includes("replace-me") && !value.includes("replace_me"));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RuntimeProviders />
  </StrictMode>
);
