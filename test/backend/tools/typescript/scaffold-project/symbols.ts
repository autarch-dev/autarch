export const VariableSymbol = "VariableSymbol";

export const FunctionSymbol = () => {
    return "FunctionSymbol";
}

export class ClassSymbol {}

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
}