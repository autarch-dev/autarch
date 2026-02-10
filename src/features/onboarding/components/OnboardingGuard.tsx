import { useEffect, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useOnboarding } from "../hooks/useOnboarding";

interface OnboardingGuardProps {
	children: React.ReactNode;
}

/**
 * App-wide guard that checks onboarding completeness on mount.
 * Redirects to /onboarding when required settings are missing.
 * Skips the check when already on an onboarding path to avoid redirect loops.
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
	const [isLoading, setIsLoading] = useState(true);
	const [shouldOnboard, setShouldOnboard] = useState(false);
	const [location] = useLocation();
	const checkOnboardingStatus = useOnboarding((s) => s.checkOnboardingStatus);
	const isOnboardingPath = location.startsWith("/onboarding");

	useEffect(() => {
		if (isOnboardingPath) {
			return;
		}

		const checkStatus = async () => {
			const complete = await checkOnboardingStatus();
			setShouldOnboard(!complete);
			setIsLoading(false);
		};
		checkStatus();
	}, [checkOnboardingStatus, isOnboardingPath]);

	// Skip the check entirely when on an onboarding path
	if (isOnboardingPath) {
		return <>{children}</>;
	}

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (shouldOnboard) {
		return <Redirect to="/onboarding" />;
	}

	return <>{children}</>;
}
