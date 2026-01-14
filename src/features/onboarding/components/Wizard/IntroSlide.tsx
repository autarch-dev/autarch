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

export function IntroSlide() {
	const nextStep = useOnboarding((s) => s.nextStep);

	return (
		<WizardCard>
			<CardHeader className="text-center">
				<CardTitle className="text-3xl font-bold">Welcome to Autarch</CardTitle>
				<CardDescription className="text-lg">
					Your AI-powered development companion
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 space-y-4 text-center">
				<p className="text-muted-foreground">
					Autarch helps you plan, scope, research, and execute software projects
					with the help of specialized AI agents.
				</p>
				<p className="text-muted-foreground">
					Let's get you set up in just a few steps.
				</p>
			</CardContent>
			<CardFooter className="justify-center">
				<Button size="lg" onClick={nextStep}>
					Get Started
				</Button>
			</CardFooter>
		</WizardCard>
	);
}
