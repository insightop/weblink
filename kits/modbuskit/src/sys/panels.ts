const readFunctions = [
    "read_input_registers",
    "read_holding_registers",
    "read_coils",
    "read_discrete_inputs"] as const;


type ReadResponse = {
    fromFunction: ReadFunction;
    startAddress: number;
    data: number[] | boolean[];
}
type ReadPanelProps = {
    getData: (query: ReadQuery) => Promise<ReadResponse>;
};
type ReadFunction = typeof readFunctions[number];
type ReadQuery = {
    type: ReadFunction,
    address: number,
    quantity: number
};
type ReadMethod = (query: ReadQuery) => Promise<ReadResponse>;
type RPanelSettings = {
    autoRefreshInterval: number,
    autoRefresh: boolean,
    queryTemplate: ReadQuery
};
const regPrefixes: Record<ReadFunction | WriteFunction, string> = {
    read_holding_registers: "HR",
    read_input_registers: "IR",
    read_coils: "CR",
    read_discrete_inputs: "DI",
    write_coils: "C",
    write_registers: "HR"
};
export type {
    ReadPanelProps,
    ReadFunction,
    ReadQuery,
    RPanelSettings,
    ReadResponse,
    ReadMethod,
};
export { readFunctions, regPrefixes };

import * as z from "zod/v4-mini";
const writeFunctions = [
    "write_coils",
    "write_registers",
] as const;
type WriteFunction = typeof writeFunctions[number];


type WriteResponse = {
    fromFunction: WriteFunction;
    address: number;
    quantity: number;
};
export const WriteQuerySchema = z.object({
    type: z.enum(writeFunctions),
    address: z.number().check(z.int()),
    values: z.union([z.array(z.number()), z.array(z.boolean())]), // number[] | boolean[]
});
type WriteQuery = z.infer<typeof WriteQuerySchema>;

export type { WriteFunction, WriteQuery, WriteResponse };
export { writeFunctions };

const HEX = (n: number, width = 2) => `0x${n.toString(16).toUpperCase().padStart(width, '0')}`;
const groupBits = (s: string, size = 4, sep = '_') =>
    s.replace(new RegExp(`(.{${size}})(?=.)`, 'g'), `$1${sep}`);

const BINg = (n: number, bits = 16, group = 4, sep = '_') => {
    const raw = ((n & ((2 ** bits) - 1)) >>> 0).toString(2).padStart(bits, '0');
    return `0b${groupBits(raw, group, sep)}`;
};

export { HEX, BINg };