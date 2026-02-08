import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "../hooks/useSettings";

export function GitIdentitySection() {
	const { gitIdentity, loadGitIdentity, saveGitIdentity, isLoading } =
		useSettings();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");

	useEffect(() => {
		loadGitIdentity();
	}, [loadGitIdentity]);

	useEffect(() => {
		if (gitIdentity) {
			setName(gitIdentity.name);
			setEmail(gitIdentity.email);
		}
	}, [gitIdentity]);

	const handleSave = () => {
		saveGitIdentity({ name, email });
	};

	return (
		<section>
			<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
				Git Author Identity
			</h3>
			<p className="text-xs text-zinc-500 mb-4">
				These values are used as the git author on commits made by the
				application.
			</p>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label className="text-zinc-300">Author Name</Label>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g., Jane Doe"
						className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500"
						disabled={isLoading}
					/>
				</div>
				<div className="space-y-2">
					<Label className="text-zinc-300">Author Email</Label>
					<Input
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="e.g., jane@example.com"
						className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500"
						disabled={isLoading}
					/>
				</div>
				<Button
					size="sm"
					onClick={handleSave}
					disabled={isLoading}
					className="bg-emerald-600 hover:bg-emerald-500 text-white"
				>
					{isLoading ? "Saving..." : "Save"}
				</Button>
			</div>
		</section>
	);
}
