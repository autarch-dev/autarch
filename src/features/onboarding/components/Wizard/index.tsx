import { useOnboarding, type WizardStep } from "../../hooks/useOnboarding";
import { ApiKeysStep } from "./ApiKeysStep";
import { CompleteStep } from "./CompleteStep";
import { FeaturesSlide } from "./FeaturesSlide";
import { IntroSlide } from "./IntroSlide";
import { ModelPrefsStep } from "./ModelPrefsStep";

const STEP_COMPONENTS: Record<WizardStep, React.ComponentType> = {
	intro: IntroSlide,
	features: FeaturesSlide,
	"api-keys": ApiKeysStep,
	"model-prefs": ModelPrefsStep,
	complete: CompleteStep,
};

const STEP_ORDER: WizardStep[] = [
	"intro",
	"features",
	"api-keys",
	"model-prefs",
	"complete",
];

export function Wizard() {
	const currentStep = useOnboarding((s) => s.currentStep);
	const StepComponent = STEP_COMPONENTS[currentStep];
	const currentIndex = STEP_ORDER.indexOf(currentStep);

	return (
		<div className="min-h-screen flex flex-col items-center justify-center p-8">
			{/* Progress indicator */}
			<div className="mb-8 flex gap-2">
				{STEP_ORDER.map((step, index) => (
					<div
						key={step}
						className={`w-2 h-2 rounded-full transition-colors ${
							index <= currentIndex ? "bg-primary" : "bg-muted"
						}`}
					/>
				))}
			</div>

			{/* Current step */}
			<StepComponent />
		</div>
	);
}
