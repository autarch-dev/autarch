import { Card } from "@/components/ui/card";

interface WizardCardProps {
	children: React.ReactNode;
}

export function WizardCard({ children }: WizardCardProps) {
	return <Card className="w-[32rem] h-[500px] flex flex-col">{children}</Card>;
}
