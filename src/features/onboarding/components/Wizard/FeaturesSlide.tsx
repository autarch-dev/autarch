import {
	CheckCircle,
	Code,
	Compass,
	type LucideIcon,
	Map as MapIcon,
	Target,
} from "lucide-react";
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

const FEATURES: { title: string; description: string; icon: LucideIcon }[] = [
	{
		title: "Scoping Agent",
		description: "Defines project requirements and boundaries",
		icon: Target,
	},
	{
		title: "Research Agent",
		description: "Explores solutions and gathers relevant information",
		icon: Compass,
	},
	{
		title: "Planning Agent",
		description: "Creates detailed implementation roadmaps",
		icon: MapIcon,
	},
	{
		title: "Execution Agent",
		description: "Writes code and implements features",
		icon: Code,
	},
	{
		title: "Review Agent",
		description: "Reviews work and provides actionable feedback",
		icon: CheckCircle,
	},
];

export function FeaturesSlide() {
	const { nextStep, prevStep } = useOnboarding();

	return (
		<WizardCard>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl font-bold">Meet Your AI Team</CardTitle>
				<CardDescription>
					Specialized agents for every phase of development
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1">
				<ul className="space-y-3">
					{FEATURES.map((feature) => (
						<li key={feature.title} className="flex gap-3 items-start">
							<div className="shrink-0 w-9 h-9 rounded-lg border border-border bg-muted flex items-center justify-center">
								<feature.icon className="w-5 h-5 text-primary" />
							</div>
							<div>
								<p className="font-medium">{feature.title}</p>
								<p className="text-sm text-muted-foreground">
									{feature.description}
								</p>
							</div>
						</li>
					))}
				</ul>
			</CardContent>
			<CardFooter className="justify-between">
				<Button variant="outline" onClick={prevStep}>
					Back
				</Button>
				<Button onClick={nextStep}>Continue</Button>
			</CardFooter>
		</WizardCard>
	);
}
