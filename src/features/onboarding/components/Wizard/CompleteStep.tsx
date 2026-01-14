import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useOnboarding } from "../../hooks/useOnboarding";
import { WizardCard } from "./WizardCard";

export function CompleteStep() {
	const { finishOnboarding, isLoading, prevStep } = useOnboarding();
	const [, setLocation] = useLocation();

	const handleFinish = async () => {
		await finishOnboarding();
		setLocation("/dashboard");
	};

	return (
		<WizardCard>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl font-bold">You're All Set!</CardTitle>
				<CardDescription>
					Your Autarch environment is configured and ready to go.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 text-center space-y-4">
				<p className="text-muted-foreground">
					You can always update your API keys and model preferences from the
					settings menu.
				</p>
				<p className="text-muted-foreground">
					Ready to start your first project?
				</p>
			</CardContent>
			<CardFooter className="justify-between">
				<Button variant="outline" onClick={prevStep}>
					Back
				</Button>
				<Button size="lg" onClick={handleFinish} disabled={isLoading}>
					{isLoading ? "Finishing..." : "Launch Dashboard"}
				</Button>
			</CardFooter>
		</WizardCard>
	);
}
