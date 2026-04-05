import { useOnboarding, type WizardStep } from "../../hooks/useOnboarding";
import { AgentBackendStep } from "./AgentBackendStep";
import { ApiKeysStep } from "./ApiKeysStep";
import { CcModelPrefsStep } from "./CcModelPrefsStep";
import { CompleteStep } from "./CompleteStep";
import { FeaturesSlide } from "./FeaturesSlide";
import { GitIdentityStep } from "./GitIdentityStep";
import { IntroSlide } from "./IntroSlide";
import { ModelPrefsStep } from "./ModelPrefsStep";

const STEP_COMPONENTS: Record<WizardStep, React.ComponentType> = {
	intro: IntroSlide,
	features: FeaturesSlide,
	"agent-backend": AgentBackendStep,
	"api-keys": ApiKeysStep,
	"model-prefs": ModelPrefsStep,
	"cc-model-prefs": CcModelPrefsStep,
	"git-identity": GitIdentityStep,
	complete: CompleteStep,
};

const STEP_ORDER: WizardStep[] = [
	"intro",
	"features",
	"agent-backend",
	"api-keys",
	"model-prefs",
	"cc-model-prefs",
	"git-identity",
	"complete",
];

/** Steps to skip based on the selected backend */
function getVisibleSteps(backend: "api" | "claude-code"): WizardStep[] {
	return STEP_ORDER.filter((step) => {
		if (backend === "claude-code") {
			return step !== "api-keys" && step !== "model-prefs";
		}
		return step !== "cc-model-prefs";
	});
}

export function Wizard() {
	const currentStep = useOnboarding((s) => s.currentStep);
	const agentBackend = useOnboarding((s) => s.agentBackend);
	const StepComponent = STEP_COMPONENTS[currentStep];

	const visibleSteps = getVisibleSteps(agentBackend);
	const currentIndex = visibleSteps.indexOf(currentStep);

	return (
		<div className="min-h-screen flex flex-col items-center justify-center p-8">
			{/* Progress indicator */}
			<div className="mb-8 flex gap-2">
				{visibleSteps.map((step, index) => (
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
