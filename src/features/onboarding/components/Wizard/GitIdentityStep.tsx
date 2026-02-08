import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboarding } from "../../hooks/useOnboarding";
import { WizardCard } from "./WizardCard";

export function GitIdentityStep() {
	const {
		nextStep,
		prevStep,
		gitIdentityName,
		gitIdentityEmail,
		setGitIdentityName,
		setGitIdentityEmail,
		loadGitIdentityDefaults,
		saveGitIdentity,
		isLoading,
	} = useOnboarding();

	useEffect(() => {
		loadGitIdentityDefaults();
	}, [loadGitIdentityDefaults]);

	const handleContinue = async () => {
		await saveGitIdentity();
		nextStep();
	};

	return (
		<WizardCard>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl font-bold">
					Git Author Identity
				</CardTitle>
				<CardDescription>
					Configure the name and email used for git commits. These will appear
					as the author on all changes made by Autarch.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 space-y-4">
				<div className="space-y-2">
					<Label htmlFor="git-name">Name</Label>
					<Input
						id="git-name"
						placeholder="Your Name"
						value={gitIdentityName}
						onChange={(e) => setGitIdentityName(e.target.value)}
						disabled={isLoading}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="git-email">Email</Label>
					<Input
						id="git-email"
						type="email"
						placeholder="you@example.com"
						value={gitIdentityEmail}
						onChange={(e) => setGitIdentityEmail(e.target.value)}
						disabled={isLoading}
					/>
				</div>
			</CardContent>
			<CardFooter className="justify-between">
				<Button variant="outline" onClick={prevStep}>
					Back
				</Button>
				<Button onClick={handleContinue} disabled={isLoading}>
					{isLoading ? "Saving..." : "Continue"}
				</Button>
			</CardFooter>
		</WizardCard>
	);
}
