// This must be a class component because React does not support error boundaries via hooks.

import {
	AlertCircle,
	ClipboardCheck,
	ClipboardCopy,
	RotateCcw,
} from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
	children: React.ReactNode;
	featureName?: string;
	className?: string;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: React.ErrorInfo | null;
	resetKey: number;
	copied: boolean;
}

export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	private copiedTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			resetKey: 0,
			copied: false,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		this.setState({ errorInfo });

		const prefix = this.props.featureName
			? `Error in ${this.props.featureName}:`
			: "Error:";
		console.error(prefix, error);
		console.error(prefix, errorInfo.componentStack);
	}

	override componentWillUnmount(): void {
		if (this.copiedTimeout) {
			clearTimeout(this.copiedTimeout);
		}
	}

	handleRetry = (): void => {
		this.setState((prev) => ({
			hasError: false,
			error: null,
			errorInfo: null,
			resetKey: prev.resetKey + 1,
		}));
	};

	handleCopyDetails = (): void => {
		const { featureName } = this.props;
		const { error, errorInfo } = this.state;

		const sections: string[] = [];
		if (featureName) {
			sections.push(`Feature: ${featureName}`);
		}
		if (error?.message) {
			sections.push(`Error: ${error.message}`);
		}
		if (error?.stack) {
			sections.push(`Stack: ${error.stack}`);
		}
		if (errorInfo?.componentStack) {
			sections.push(`Component Stack: ${errorInfo.componentStack}`);
		}

		const text = sections.join("\n\n");

		navigator.clipboard.writeText(text).then(() => {
			this.setState({ copied: true });
			if (this.copiedTimeout) {
				clearTimeout(this.copiedTimeout);
			}
			this.copiedTimeout = setTimeout(
				() => this.setState({ copied: false }),
				2000,
			);
		});
	};

	override render(): React.ReactNode {
		const { children, featureName, className } = this.props;
		const { hasError, copied, resetKey } = this.state;

		if (hasError) {
			return (
				<div className={cn("px-4 py-8 text-center", className)}>
					<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
						<AlertCircle className="size-6 text-destructive" />
					</div>
					<h4 className="font-medium mb-1">
						Something went wrong{featureName ? ` in ${featureName}` : ""}
					</h4>
					<p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
						An unexpected error occurred. You can try again or copy the error
						details for a bug report.
					</p>
					<div className="flex items-center justify-center gap-2">
						<Button variant="outline" size="sm" onClick={this.handleRetry}>
							<RotateCcw className="size-4" /> Try Again
						</Button>
						<Button variant="ghost" size="sm" onClick={this.handleCopyDetails}>
							{copied ? (
								<ClipboardCheck className="size-4" />
							) : (
								<ClipboardCopy className="size-4" />
							)}
							{copied ? "Copied!" : "Copy Error Details"}
						</Button>
					</div>
				</div>
			);
		}

		return (
			<div key={resetKey} className={className}>
				{children}
			</div>
		);
	}
}
