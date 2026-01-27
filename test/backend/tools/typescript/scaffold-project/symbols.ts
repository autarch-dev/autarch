// =============================================================================
// Basic Symbols (existing)
// =============================================================================

export const VariableSymbol = "VariableSymbol";

export function FunctionSymbol() {
	return "FunctionSymbol";
}

export class ClassSymbol {
	public classMethod(): string {
		return "classMethod";
	}

	private privateMethod(): void {}

	public static staticMethod(): number {
		return 42;
	}
}

export interface InterfaceSymbol {
	name: string;
	description: string;
	type: string;
	value: string;
}

export type TypeSymbol = {
	name: string;
	description: string;
	type: string;
	value: string;
};

// =============================================================================
// Cross-References
// =============================================================================

// Variable that uses InterfaceSymbol type
export const interfaceInstance: InterfaceSymbol = {
	name: "test",
	description: "test description",
	type: "test",
	value: "test value",
};

// Function that references ClassSymbol
export function createClassSymbol(): ClassSymbol {
	return new ClassSymbol();
}

// Function that calls FunctionSymbol
export function callsFunctionSymbol(): string {
	return FunctionSymbol();
}

// Function that uses TypeSymbol
export function usesTypeSymbol(input: TypeSymbol): string {
	return input.name;
}

// =============================================================================
// Overloaded Functions
// =============================================================================

export function overloadedFunction(value: string): string;
export function overloadedFunction(value: number): number;
export function overloadedFunction(value: string | number): string | number {
	return value;
}

// =============================================================================
// Generic Types and Classes
// =============================================================================

export type GenericType<T> = {
	value: T;
	metadata: string;
};

export interface GenericInterface<T, U> {
	first: T;
	second: U;
}

export class GenericClass<T> {
	private data: T;

	constructor(initialData: T) {
		this.data = initialData;
	}

	getData(): T {
		return this.data;
	}

	setData(newData: T): void {
		this.data = newData;
	}
}

// Usage of generic types for cross-reference testing
export const genericInstance: GenericType<string> = {
	value: "test",
	metadata: "meta",
};

export function createGenericClass<T>(data: T): GenericClass<T> {
	return new GenericClass(data);
}

// =============================================================================
// Duplicate Names in Different Contexts
// =============================================================================

// A namespace with a duplicate name of a symbol
export namespace DuplicateName {
	export const value = "namespace value";
	export function getValue(): string {
		return value;
	}
}

// A variable with the same name as the namespace
export const DuplicateNameVar = "variable with similar name";

// An interface and a class with similar naming pattern
export interface DuplicateInterface {
	id: number;
}

export class DuplicateClass implements DuplicateInterface {
	id: number;
	constructor(id: number) {
		this.id = id;
	}
}

// =============================================================================
// Additional Variable Types
// =============================================================================

export const numberVariable: number = 42;
export const booleanVariable: boolean = true;
export const mutableVariable: string = "mutable";
export const arrayVariable: string[] = ["one", "two", "three"];
export const objectVariable = { key: "value", nested: { inner: true } };
