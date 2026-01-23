import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { JSONSchemaProperty, ToolSchema } from "../types";

/**
 * Props for the SchemaForm component.
 */
export interface SchemaFormProps {
	/** The tool schema to generate the form from, or null if no tool selected */
	schema: ToolSchema | null;
	/** Callback when the form is submitted with field values */
	onSubmit: (values: Record<string, unknown>) => void;
	/** Whether the tool is currently executing (disables submit) */
	isExecuting: boolean;
}

/**
 * A dynamic form component that generates form fields from a JSON Schema.
 * Used in the Tool Testbench to create input forms for tool parameters.
 */
export function SchemaForm({ schema, onSubmit, isExecuting }: SchemaFormProps) {
	const [formValues, setFormValues] = useState<Record<string, unknown>>({});

	// Reset form values when schema changes (different tool selected)
	// biome-ignore lint/correctness/useExhaustiveDependencies: Intentional - reset form when tool selection changes
	useEffect(() => {
		setFormValues({});
	}, [schema?.name]);

	if (!schema) {
		return (
			<div className="text-muted-foreground text-sm p-4">
				Select a tool to see its input form.
			</div>
		);
	}

	const { properties, required } = schema.schema;

	const handleFieldChange = (fieldName: string, value: unknown) => {
		setFormValues((prev) => ({
			...prev,
			[fieldName]: value,
		}));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Parse JSON strings for array and object fields
		const parsedValues: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(formValues)) {
			const property = properties[key];
			if (
				property &&
				(property.type === "array" || property.type === "object") &&
				typeof value === "string" &&
				value.trim() !== ""
			) {
				try {
					parsedValues[key] = JSON.parse(value);
				} catch {
					// If parsing fails, send the raw string and let backend validation handle it
					parsedValues[key] = value;
				}
			} else {
				parsedValues[key] = value;
			}
		}

		onSubmit(parsedValues);
	};

	/**
	 * Renders a form field based on the JSON Schema property type.
	 */
	const renderField = (fieldName: string, property: JSONSchemaProperty) => {
		const fieldId = `field-${fieldName}`;
		const currentValue = formValues[fieldName];

		// Handle enum types (Select dropdown)
		if (property.enum && property.enum.length > 0) {
			return (
				<Select
					value={(currentValue as string) ?? ""}
					onValueChange={(value) => handleFieldChange(fieldName, value)}
					disabled={isExecuting}
				>
					<SelectTrigger className="w-full" id={fieldId}>
						<SelectValue placeholder={`Select ${fieldName}...`} />
					</SelectTrigger>
					<SelectContent>
						{property.enum.map((option) => (
							<SelectItem key={option} value={option}>
								{option}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		}

		// Handle based on type
		switch (property.type) {
			case "boolean":
				return (
					<div className="flex items-center gap-2">
						<Checkbox
							id={fieldId}
							checked={(currentValue as boolean) ?? false}
							onCheckedChange={(checked) =>
								handleFieldChange(fieldName, checked)
							}
							disabled={isExecuting}
						/>
						<Label htmlFor={fieldId} className="cursor-pointer">
							{property.description || fieldName}
						</Label>
					</div>
				);

			case "number":
			case "integer":
				return (
					<Input
						id={fieldId}
						type="number"
						value={(currentValue as number) ?? ""}
						onChange={(e) =>
							handleFieldChange(
								fieldName,
								e.target.value === "" ? undefined : Number(e.target.value),
							)
						}
						placeholder={property.description || `Enter ${fieldName}`}
						disabled={isExecuting}
					/>
				);

			case "array":
				return (
					<Textarea
						id={fieldId}
						value={(currentValue as string) ?? ""}
						onChange={(e) => handleFieldChange(fieldName, e.target.value)}
						placeholder={`Enter JSON array, e.g. ["item1", "item2"]`}
						disabled={isExecuting}
						className="min-h-24 font-mono text-sm"
					/>
				);

			case "object":
				return (
					<Textarea
						id={fieldId}
						value={(currentValue as string) ?? ""}
						onChange={(e) => handleFieldChange(fieldName, e.target.value)}
						placeholder={`Enter JSON object, e.g. {"key": "value"}`}
						disabled={isExecuting}
						className="min-h-24 font-mono text-sm"
					/>
				);

			default: {
				// Check if description hints at multiline content
				const isMultiline =
					property.description?.toLowerCase().includes("multiline") ||
					property.description?.toLowerCase().includes("multi-line") ||
					property.description?.toLowerCase().includes("content") ||
					property.description?.toLowerCase().includes("body") ||
					property.description?.toLowerCase().includes("text");

				if (isMultiline) {
					return (
						<Textarea
							id={fieldId}
							value={(currentValue as string) ?? ""}
							onChange={(e) => handleFieldChange(fieldName, e.target.value)}
							placeholder={property.description || `Enter ${fieldName}`}
							disabled={isExecuting}
							className="min-h-24"
						/>
					);
				}

				return (
					<Input
						id={fieldId}
						type="text"
						value={(currentValue as string) ?? ""}
						onChange={(e) => handleFieldChange(fieldName, e.target.value)}
						placeholder={property.description || `Enter ${fieldName}`}
						disabled={isExecuting}
					/>
				);
			}
		}
	};

	// Get field names, filtering out 'reason' which will be auto-populated
	const fieldNames = Object.keys(properties).filter(
		(name) => name !== "reason",
	);

	if (fieldNames.length === 0) {
		return (
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="text-muted-foreground text-sm">
					This tool has no input parameters.
				</div>
				<Button type="submit" disabled={isExecuting} className="w-full">
					{isExecuting ? "Executing..." : "Execute Tool"}
				</Button>
			</form>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{fieldNames.map((fieldName) => {
				const property = properties[fieldName];
				// Skip if property is undefined (shouldn't happen, but TypeScript safety)
				if (!property) return null;
				const isRequired = required?.includes(fieldName) ?? false;

				return (
					<div key={fieldName} className="space-y-2">
						{/* Don't render label for boolean (it's inline with checkbox) */}
						{property.type !== "boolean" && (
							<Label htmlFor={`field-${fieldName}`}>
								{fieldName}
								{isRequired && <span className="text-destructive ml-1">*</span>}
							</Label>
						)}
						{/* Render the field description if not boolean */}
						{property.type !== "boolean" && property.description && (
							<p className="text-muted-foreground text-xs">
								{property.description}
							</p>
						)}
						{renderField(fieldName, property)}
					</div>
				);
			})}
			<Button type="submit" disabled={isExecuting} className="w-full">
				{isExecuting ? "Executing..." : "Execute Tool"}
			</Button>
		</form>
	);
}
