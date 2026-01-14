import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function Dashboard() {
	return (
		<div className="min-h-screen flex items-center justify-center p-8">
			<Card className="w-full max-w-lg">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold">
						Project Dashboard
					</CardTitle>
					<CardDescription>
						Welcome to Autarch! This is where your projects will appear.
					</CardDescription>
				</CardHeader>
				<CardContent className="text-center">
					<p className="text-muted-foreground">
						Dashboard coming soon. For now, your setup is complete!
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
