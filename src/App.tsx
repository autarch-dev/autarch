import { useEffect } from "react";
import { Redirect, Route, Switch } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { Dashboard } from "@/features/dashboard";
import { OnboardingGuard, OnboardingPage } from "@/features/onboarding";
import { ToolTestbench } from "@/features/testbench";
import { useWebSocketStore } from "@/features/websocket";
import "./index.css";

export function App() {
	const connect = useWebSocketStore((s) => s.connect);

	// Connect WebSocket on app mount
	useEffect(() => {
		connect();
	}, [connect]);

	return (
		<>
			<OnboardingGuard>
				<Switch>
					<Route path="/">
						<Redirect to="/dashboard" />
					</Route>
					<Route path="/onboarding" component={OnboardingPage} />
					<Route path="/dashboard" nest component={Dashboard} />
					<Route path="/testbench">
						<ErrorBoundary featureName="Tool Testbench">
							<ToolTestbench />
						</ErrorBoundary>
					</Route>
					{/* Fallback for unknown routes */}
					<Route>
						<Redirect to="/" />
					</Route>
				</Switch>
			</OnboardingGuard>
			<Toaster />
		</>
	);
}

export default App;
