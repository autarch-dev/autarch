import { useEffect, useState } from "react";
import { Redirect, Route, Switch } from "wouter";
import { Dashboard } from "@/features/dashboard";
import { OnboardingPage, useOnboarding } from "@/features/onboarding";
import { useWebSocketStore } from "@/features/websocket";
import "./index.css";

/**
 * Root redirect component that checks onboarding status and redirects accordingly.
 */
function RootRedirect() {
	const [isLoading, setIsLoading] = useState(true);
	const [shouldOnboard, setShouldOnboard] = useState(false);
	const checkOnboardingStatus = useOnboarding((s) => s.checkOnboardingStatus);

	useEffect(() => {
		const checkStatus = async () => {
			const complete = await checkOnboardingStatus();
			setShouldOnboard(!complete);
			setIsLoading(false);
		};
		checkStatus();
	}, [checkOnboardingStatus]);

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	return <Redirect to={shouldOnboard ? "/onboarding" : "/dashboard"} />;
}

export function App() {
	const connect = useWebSocketStore((s) => s.connect);

	// Connect WebSocket on app mount
	useEffect(() => {
		connect();
	}, [connect]);

	return (
		<Switch>
			<Route path="/" component={RootRedirect} />
			<Route path="/onboarding" component={OnboardingPage} />
			<Route path="/dashboard" component={Dashboard} />
			{/* Fallback for unknown routes */}
			<Route>
				<Redirect to="/" />
			</Route>
		</Switch>
	);
}

export default App;
